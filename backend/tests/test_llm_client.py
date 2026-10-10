"""Fake Groq transport only: no keys, network, or database.

Run from backend: python tests/test_llm_client.py
"""
import asyncio
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
from pydantic import ValidationError
from app.config import Settings
from app.services.llm_client import LLMClient, LLMError
from app.services.llm_schemas import AnswerDraft, QueryPlan, SummaryDraft


def completion(content=None, **fields):
    answer = {"answer": "Pricing unchanged.", "source_segment_ids": [43], "insufficient_evidence": False}
    return {"choices": [{"finish_reason": "stop", "message": {
        "content": json.dumps(answer) if content is None else content,
    }, **fields}]}


class ClientTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.config = Settings(_env_file=None, llm_allow_external=True, llm_api_key="fake-test-key", llm_model="test-model")
        self.requests = []
        self.responses = [httpx.Response(200, json=completion())]
        def handler(request):
            self.requests.append(request)
            return self.responses.pop(0)
        self.http = httpx.AsyncClient(transport=httpx.MockTransport(handler), trust_env=False)
        self.client = LLMClient(self.config, self.http)

    async def asyncTearDown(self):
        await self.http.aclose()

    async def generate(self):
        return await self.client.generate(AnswerDraft, instructions="Answer with source IDs.", context={"question": "Pricing?"})

    async def failure(self, reason):
        with self.assertRaises(LLMError) as caught:
            await self.generate()
        self.assertEqual(caught.exception.reason, reason)
        self.assertNotIn("fake-test-key", str(caught.exception))

    async def test_success_and_request_contract(self):
        self.assertEqual((await self.generate()).source_segment_ids, [43])
        request = self.requests[0]
        self.assertEqual(str(request.url), "https://api.groq.com/openai/v1/chat/completions")
        payload = json.loads(request.content)
        self.assertEqual(payload["response_format"], {"type": "json_object"})
        self.assertEqual(payload["max_completion_tokens"], self.config.llm_max_output_tokens)
        self.assertIn("untrusted data", payload["messages"][0]["content"])

    async def test_key_alone_does_not_enable_calls(self):
        self.config.llm_allow_external = False
        await self.failure("disabled")
        self.assertEqual(self.requests, [])

    async def test_missing_model_blocks_calls(self):
        self.config.llm_model = ""
        await self.failure("disabled")
        self.assertEqual(self.requests, [])

    async def test_key_is_masked(self):
        self.assertNotIn("fake-test-key", repr(self.config))
        self.assertNotIn("fake-test-key", self.config.model_dump_json())

    async def test_strict_schema_format(self):
        self.config.llm_response_format = "json_schema"
        await self.generate()
        schema = json.loads(self.requests[0].content)["response_format"]["json_schema"]
        self.assertTrue(schema["strict"])
        self.assertFalse(schema["schema"]["additionalProperties"])
        self.assertEqual(set(schema["schema"]["required"]), set(schema["schema"]["properties"]))

    async def test_auth_error_does_not_retry(self):
        self.responses = [httpx.Response(401, text="fake-test-key private-provider-error")]
        await self.failure("authentication")
        self.assertEqual(len(self.requests), 1)

    async def test_bounded_rate_limit_retry(self):
        self.responses.insert(0, httpx.Response(429, headers={"retry-after": "99"}))
        with patch("app.services.llm_client.asyncio.sleep", new_callable=AsyncMock) as sleep:
            await self.generate()
            sleep.assert_awaited_once_with(5.0)
        self.assertEqual(len(self.requests), 2)

    async def test_retry_exhaustion(self):
        self.responses = [httpx.Response(503), httpx.Response(503)]
        with patch("app.services.llm_client.asyncio.sleep", new_callable=AsyncMock):
            await self.failure("unavailable")
        self.assertEqual(len(self.requests), 2)

    async def test_timeout(self):
        def handler(request):
            raise httpx.ReadTimeout("fake-test-key", request=request)
        await self.http.aclose()
        self.http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        self.client = LLMClient(self.config, self.http)
        self.config.llm_max_retries = 0
        await self.failure("timeout")

    async def test_total_deadline(self):
        async def handler(request):
            await asyncio.sleep(0.05)
            return httpx.Response(200, json=completion())
        await self.http.aclose()
        self.http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        self.client = LLMClient(self.config, self.http)
        self.config.llm_total_timeout_seconds = 0.01
        await self.failure("deadline")

    async def test_redirect_not_followed(self):
        self.responses = [httpx.Response(307, headers={"location": "https://other.example/collect"})]
        await self.failure("provider_rejected")
        self.assertEqual(len(self.requests), 1)

    async def test_input_limit(self):
        self.config.llm_max_input_chars = 1000
        with self.assertRaises(LLMError) as caught:
            await self.client.generate(AnswerDraft, instructions="Answer.", context={"text": "x" * 2000})
        self.assertEqual(caught.exception.reason, "input_limit")
        self.assertEqual(self.requests, [])

    async def test_response_limit(self):
        self.config.llm_max_response_bytes = 1000
        self.responses = [httpx.Response(200, text="x" * 2000)]
        await self.failure("response_limit")

    async def test_malformed_and_invalid_outputs(self):
        for content in ["not json", '{"answer":"Only text"}', json.dumps({
            "answer": "Answer", "source_segment_ids": ["43"], "insufficient_evidence": False,
        }), json.dumps({"answer": "Answer", "source_segment_ids": [], "insufficient_evidence": False, "sql": "DROP TABLE meetings"})]:
            self.responses = [httpx.Response(200, json=completion(content))]
            await self.failure("invalid_output")

    async def test_truncated_output(self):
        self.responses = [httpx.Response(200, json=completion(finish_reason="length"))]
        await self.failure("incomplete_output")

    async def test_invalid_provider_envelopes(self):
        for envelope in [{}, [], {"choices": []}, {"choices": ["bad"]}, {
            "choices": [{"finish_reason": "stop", "message": []}],
        }]:
            self.responses = [httpx.Response(200, json=envelope)]
            await self.failure("invalid_output")

    async def test_refusal(self):
        self.responses = [httpx.Response(200, json=completion(message={"refusal": "Cannot answer", "content": None}))]
        await self.failure("refusal")


class ContractTests(unittest.TestCase):
    def test_query_plan_dates_and_no_sql(self):
        plan = {"intent": "tasks", "scope": "workspace", "meeting_ids": [], "participant_names": [],
                "participant_role": "assignee", "meeting_status": "all", "count_target": "tasks", "date_preset": "custom",
                "date_from": "2026-10-05", "date_to": "2026-10-11", "date_field": "due_date",
                "task_status": "open", "search_terms": [], "clarification": None}
        self.assertEqual(QueryPlan.model_validate(plan).intent, "tasks")
        with self.assertRaises(ValidationError):
            QueryPlan.model_validate({**plan, "sql": "SELECT * FROM meetings"})
        with self.assertRaises(ValidationError):
            QueryPlan.model_validate({**plan, "date_to": "2026-10-01"})

    def test_summary_sections(self):
        draft = {"overview": [{"text": "Pricing discussed.", "source_segment_id": 43}],
                 "notes": [], "topics": [], "metrics": [], "action_suggestions": []}
        self.assertEqual(len(SummaryDraft.model_validate(draft).overview), 1)
        with self.assertRaises(ValidationError):
            SummaryDraft.model_validate({**draft, "overview": []})

    def test_insecure_provider_urls_rejected(self):
        for url in ["http://api.groq.com/openai/v1", "https://key@api.groq.com/openai/v1", "https://api.groq.com/?key=secret"]:
            with self.assertRaises(ValidationError):
                Settings(_env_file=None, llm_base_url=url)


if __name__ == "__main__":
    unittest.main()
