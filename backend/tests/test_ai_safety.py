"""Provider/IP guard tests; isolated database, fake HTTP, no external calls."""
import asyncio
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

TEMP = tempfile.TemporaryDirectory(prefix="fireflies-ai-safety-")
os.environ["FI_REFLIES_DB_PATH"] = str(Path(TEMP.name) / "test.db")
os.environ["MEDIA_DIR"] = str(Path(TEMP.name) / "media")
os.environ["LLM_ALLOW_EXTERNAL"] = "false"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
from app.ai_rate_limit import AIRateLimiter
from app.ai_rate_limit import AIRateLimitMiddleware
from app.config import Settings
from app.database import SessionLocal, engine, init_db
from app.models import ProviderUsage
from app.services.llm_client import LLMClient, LLMError
from app.services.llm_schemas import AnswerDraft
from app.services.provider_budget import BudgetExceeded, MemoryBudget, SQLiteBudget


def response():
    return httpx.Response(200, json={"usage": {"total_tokens": 50}, "choices": [{"finish_reason": "stop", "message": {
        "content": json.dumps({"answer": "Sample fact", "source_segment_ids": [1], "insufficient_evidence": False}),
    }}]})


class ClientSafety(unittest.IsolatedAsyncioTestCase):
    async def test_retry_cannot_bypass_daily_request_cap(self):
        cfg = Settings(_env_file=None, llm_allow_external=True, llm_api_key="fake", llm_model="fake", llm_requests_per_day=1)
        calls = []
        def handler(request):
            calls.append(request)
            return httpx.Response(503)
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
            ai = LLMClient(cfg, http)
            with self.assertRaises(LLMError) as caught:
                await ai.generate(AnswerDraft, instructions="Sample", context={})
            self.assertEqual(caught.exception.reason, "budget_limit")
            self.assertEqual(len(calls), 1)

    async def test_concurrent_calls_are_bounded(self):
        cfg = Settings(_env_file=None, llm_allow_external=True, llm_api_key="fake", llm_model="fake", llm_max_concurrent=1)
        entered, release = asyncio.Event(), asyncio.Event()
        async def handler(request):
            entered.set()
            await release.wait()
            return response()
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
            ai = LLMClient(cfg, http)
            first = asyncio.create_task(ai.generate(AnswerDraft, instructions="Sample", context={}))
            await entered.wait()
            try:
                with self.assertRaises(LLMError) as caught:
                    await ai.generate(AnswerDraft, instructions="Sample", context={})
                self.assertEqual(caught.exception.reason, "busy")
            finally:
                release.set()
                await first
            self.assertEqual(ai.active, 0)
            self.assertEqual(ai.stats["requests"], 1)

    async def test_confirmed_usage_refunds_only_unused_reservation(self):
        cfg = Settings(_env_file=None, llm_allow_external=True, llm_api_key="fake", llm_model="fake")
        budget = MemoryBudget(cfg)
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: response())) as http:
            ai = LLMClient(cfg, http, budget)
            await ai.generate(AnswerDraft, instructions="Sample", context={})
            self.assertEqual(next(iter(budget.days.values()))["tokens"], 50)


class BudgetSafety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        TEMP.cleanup()

    def setUp(self):
        with SessionLocal() as db:
            db.query(ProviderUsage).delete()
            db.commit()

    def test_persistent_quota_survives_new_budget_instance(self):
        cfg = Settings(_env_file=None, llm_requests_per_day=1)
        SQLiteBudget(cfg).reserve(100)
        with self.assertRaises(BudgetExceeded):
            SQLiteBudget(cfg).reserve(100)

    def test_token_cap_and_unknown_usage(self):
        cfg = Settings(_env_file=None, llm_tokens_per_day=1000)
        budget = SQLiteBudget(cfg)
        reservation = budget.reserve(900)
        budget.settle(reservation, None)
        with self.assertRaises(BudgetExceeded):
            budget.reserve(200)

    def test_minute_cap(self):
        cfg = Settings(_env_file=None, llm_requests_per_minute=1)
        budget = MemoryBudget(cfg)
        budget.reserve(100)
        with self.assertRaises(BudgetExceeded):
            budget.reserve(100)

    def test_invalid_usage_does_not_refund(self):
        cfg = Settings(_env_file=None)
        budget = MemoryBudget(cfg)
        reservation = budget.reserve(100)
        for usage in [-1, 101, True, "50"]:
            budget.settle(reservation, usage)
        self.assertEqual(next(iter(budget.days.values()))["tokens"], 100)

    def test_ip_throttle_expires_and_does_not_store_raw_ip(self):
        clock = [0]
        limiter = AIRateLimiter(2, clock=lambda: clock[0])
        self.assertTrue(limiter.allow("192.0.2.1"))
        self.assertTrue(limiter.allow("192.0.2.1"))
        self.assertFalse(limiter.allow("192.0.2.1"))
        self.assertNotIn("192.0.2.1", limiter.buckets)
        clock[0] = 61
        self.assertTrue(limiter.allow("192.0.2.1"))

    def test_ip_bucket_memory_is_bounded(self):
        limiter = AIRateLimiter(2)
        for n in range(2100):
            limiter.allow(str(n))
        self.assertEqual(len(limiter.buckets), 2048)

    def test_http_throttle_has_cors_and_cannot_be_spoofed_by_header(self):
        from fastapi import FastAPI
        from fastapi.middleware.cors import CORSMiddleware
        from fastapi.testclient import TestClient
        sample = FastAPI()
        sample.add_middleware(AIRateLimitMiddleware, limit=1)
        sample.add_middleware(CORSMiddleware, allow_origins=["https://frontend.example"], allow_methods=["*"])
        @sample.post("/api/v1/chat")
        def endpoint():
            return {"answer": "sample"}
        with TestClient(sample) as client:
            self.assertEqual(client.post("/api/v1/chat").status_code, 200)
            blocked = client.post("/api/v1/chat", headers={"origin": "https://frontend.example", "x-forwarded-for": "198.51.100.1"})
            self.assertEqual(blocked.status_code, 429)
            self.assertEqual(blocked.headers["access-control-allow-origin"], "https://frontend.example")
            self.assertEqual(blocked.headers["retry-after"], "60")


if __name__ == "__main__":
    unittest.main()
