"""Phase 2 integration tests: temporary SQLite + fake Groq only.

Run from backend: python tests/test_meeting_ai.py
"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

TEMP = tempfile.TemporaryDirectory(prefix="fireflies-meeting-ai-")
os.environ["FI_REFLIES_DB_PATH"] = str(Path(TEMP.name) / "test.db")
os.environ["MEDIA_DIR"] = str(Path(TEMP.name) / "media")
os.environ["SEED_ON_START"] = "false"
os.environ["LLM_ALLOW_EXTERNAL"] = "false"
os.environ["RAG_INDEXING_ENABLED"] = "false"
os.environ["RAG_INFERENCE_MODE"] = "disabled"
os.environ["AI_REQUESTS_PER_IP_MINUTE"] = "300"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
from fastapi.testclient import TestClient
from app.config import Settings
from app.database import SessionLocal, engine
from app.main import app
from app.models import SummaryItem, TranscriptSegment, User
from app.services.llm_client import LLMClient


class MeetingAITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.client.__enter__()
        with SessionLocal() as db:
            db.add(User(name="Ada", email="ada@example.test", avatar_color="#7c5cff", is_default=True))
            db.commit()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        engine.dispose()
        TEMP.cleanup()

    def create(self):
        original = app.state.llm_client
        app.state.llm_client = self.disabled_client
        try:
            response = self.client.post("/api/v1/meetings", json={
                "title": "AI test meeting", "meeting_date": "2026-10-09T12:00:00",
                "transcript_text": "00:01 Ada: I'll send the detailed report by Friday.\n00:20 Grace: I commit to schedule a security review tomorrow.",
            })
            self.assertEqual(response.status_code, 201, response.text)
            return response.json()["id"]
        finally:
            app.state.llm_client = original

    def setUp(self):
        self.disabled_client = app.state.llm_client
        self.mid = self.create()
        self.segments = self.client.get(f"/api/v1/meetings/{self.mid}/transcript").json()["segments"]
        self.people = self.client.get(f"/api/v1/meetings/{self.mid}").json()["participants"]
        self.status = 200
        self.requests = []
        self.mutate_during_call = None
        self.reply = self.summary_draft()
        async def handler(request):
            payload = json.loads(request.content)
            self.requests.append(payload)
            context = json.loads(payload["messages"][1]["content"])
            if self.mutate_during_call:
                self.mutate_during_call()
            content = self.reply(context) if callable(self.reply) else self.reply
            return httpx.Response(self.status, json={"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(content)}}]})
        self.http = httpx.AsyncClient(transport=httpx.MockTransport(handler), trust_env=False)
        self.config = Settings(_env_file=None, llm_allow_external=True, llm_api_key="fake-only",
                               llm_model="fake-model", llm_max_retries=0)
        app.state.llm_client = LLMClient(self.config, self.http)

    def tearDown(self):
        self.client.portal.call(self.http.aclose)
        app.state.llm_client = self.disabled_client

    def summary_draft(self):
        sid = self.segments[0]["id"]
        return {"overview": [{"text": "A report and security review were discussed.", "source_segment_id": sid}],
                "notes": [{"text": "Ada committed to sending the report.", "source_segment_id": sid}],
                "topics": [], "metrics": [], "action_suggestions": []}

    def answer_draft(self):
        return {"answer": "Ada committed to sending the report.", "source_segment_ids": [self.segments[0]["id"]], "insufficient_evidence": False}

    def regenerate(self):
        return self.client.post(f"/api/v1/meetings/{self.mid}/regenerate", json={"template": "general"})

    def test_summary_output_and_stored_timestamps(self):
        response = self.regenerate()
        self.assertEqual(response.status_code, 200, response.text)
        summary = response.json()
        self.assertEqual(summary["generated_by"], "llm")
        bullet = summary["sections"][1]["items"][0]
        self.assertEqual(bullet["timestamp_ms"], self.segments[0]["start_ms"])
        self.assertEqual(bullet["source_segment_id"], self.segments[0]["id"])

    def test_chat_sources_and_history(self):
        self.reply = self.answer_draft()
        path = f"/api/v1/meetings/{self.mid}/chat"
        response = self.client.post(path, json={"question": "Who sends the report?"})
        self.assertEqual(response.status_code, 200, response.text)
        citation = response.json()["citations"][0]
        self.assertEqual(citation["meeting_id"], self.mid)
        self.assertEqual(citation["quote"], self.segments[0]["text"])
        self.assertEqual(citation["speaker"], "Ada")
        self.assertEqual(self.client.get(path).json()[-1]["citations"], response.json()["citations"])
        self.client.post(path, json={"question": "What about the deadline?"})
        context = json.loads(self.requests[-1]["messages"][1]["content"])
        self.assertEqual(len(context["history"]), 2)

    def test_foreign_chat_source_falls_back(self):
        other = self.create()
        foreign = self.client.get(f"/api/v1/meetings/{other}/transcript").json()["segments"][0]["id"]
        self.reply = {**self.answer_draft(), "answer": "UNTRUSTED MODEL TEXT", "source_segment_ids": [foreign]}
        response = self.client.post(f"/api/v1/meetings/{self.mid}/chat", json={"question": "report"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertNotIn("UNTRUSTED", response.json()["answer"])
        self.assertTrue(all(c["meeting_id"] == self.mid for c in response.json()["citations"]))

    def test_summary_foreign_source_falls_back(self):
        self.reply["notes"][0]["source_segment_id"] = 999999
        response = self.regenerate()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["generated_by"], "rules")

    def test_provider_failure_is_usable(self):
        self.status = 503
        self.assertEqual(self.regenerate().json()["generated_by"], "rules")
        response = self.client.post(f"/api/v1/meetings/{self.mid}/chat", json={"question": "report"})
        self.assertEqual(response.status_code, 200, response.text)

    def test_input_budget_falls_back_without_request(self):
        self.config.llm_max_input_chars = 1000
        response = self.regenerate()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["generated_by"], "rules")
        self.assertEqual(self.requests, [])

    def test_insufficient_evidence_abstains(self):
        self.reply = {"answer": "Unsupported confident answer", "source_segment_ids": [], "insufficient_evidence": True}
        response = self.client.post(f"/api/v1/meetings/{self.mid}/chat", json={"question": "What was the secret budget?"})
        self.assertIn("enough evidence", response.json()["answer"])
        self.assertEqual(response.json()["citations"], [])

    def test_tasks_preserved_on_regeneration(self):
        tasks = self.client.get(f"/api/v1/tasks?meeting_id={self.mid}").json()
        self.client.patch(f"/api/v1/action-items/{tasks[0]['id']}", json={"description": "Manual edit", "status": "done"})
        expected = self.client.get(f"/api/v1/tasks?meeting_id={self.mid}").json()
        self.regenerate()
        self.regenerate()
        self.assertEqual(self.client.get(f"/api/v1/tasks?meeting_id={self.mid}").json(), expected)

    def add_suggestion(self):
        self.reply["action_suggestions"] = [{"description": "Schedule security review", "source_segment_id": self.segments[1]["id"],
                                             "assignee_id": self.people[1]["id"], "due_date": None}]
        self.assertEqual(self.regenerate().status_code, 200)
        return self.client.get(f"/api/v1/meetings/{self.mid}/action-suggestions").json()[0]

    def test_suggestion_accept_is_explicit_and_idempotent(self):
        before = len(self.client.get(f"/api/v1/tasks?meeting_id={self.mid}").json())
        suggestion = self.add_suggestion()
        self.regenerate()
        self.assertEqual(len(self.client.get(f"/api/v1/meetings/{self.mid}/action-suggestions").json()), 1)
        self.assertEqual(len(self.client.get(f"/api/v1/tasks?meeting_id={self.mid}").json()), before)
        path = f"/api/v1/meetings/{self.mid}/action-suggestions/{suggestion['id']}/accept"
        first = self.client.post(path)
        second = self.client.post(path)
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(first.json()["id"], second.json()["id"])
        self.assertEqual(len(self.client.get(f"/api/v1/tasks?meeting_id={self.mid}").json()), before + 1)

    def test_edited_source_cannot_be_accepted(self):
        suggestion = self.add_suggestion()
        self.client.patch(f"/api/v1/transcript-segments/{self.segments[1]['id']}", json={"text": "That plan was cancelled."})
        response = self.client.post(f"/api/v1/meetings/{self.mid}/action-suggestions/{suggestion['id']}/accept")
        self.assertEqual(response.status_code, 409, response.text)

    def test_dismissed_suggestion_stays_dismissed(self):
        suggestion = self.add_suggestion()
        path = f"/api/v1/meetings/{self.mid}/action-suggestions/{suggestion['id']}"
        self.assertEqual(self.client.post(path + "/dismiss").status_code, 204)
        self.regenerate()
        self.assertEqual(self.client.post(path + "/accept").status_code, 409)
        self.assertEqual(len(self.client.get(f"/api/v1/meetings/{self.mid}/action-suggestions").json()), 1)

    def test_concurrent_manual_summary_edit_preserved(self):
        before = self.client.get(f"/api/v1/meetings/{self.mid}/summary").json()
        item_id = before["sections"][0]["items"][0]["id"]
        def edit():
            with SessionLocal() as db:
                db.get(SummaryItem, item_id).text = "User edited while Groq was working"
                db.commit()
        self.mutate_during_call = edit
        response = self.regenerate()
        self.assertEqual(response.status_code, 409, response.text)
        current = self.client.get(f"/api/v1/meetings/{self.mid}/summary").json()
        self.assertEqual(current["sections"][0]["items"][0]["text"], "User edited while Groq was working")

    def test_import_uses_llm_when_explicitly_enabled(self):
        def reply(context):
            return {"overview": [
                {"text": "Imported transcript summarized.", "source_segment_id": context["segments"][0]["id"]},
            ], "notes": [], "topics": [], "metrics": [], "action_suggestions": []}
        self.reply = reply
        response = self.client.post("/api/v1/meetings", json={"title": "Import", "meeting_date": "2026-10-09",
            "transcript_text": "00:01 Ada: We discussed our launch and next steps."})
        self.assertEqual(response.status_code, 201, response.text)
        summary = self.client.get(f"/api/v1/meetings/{response.json()['id']}/summary").json()
        self.assertEqual(summary["generated_by"], "llm")

    def test_bad_template_no_provider_call(self):
        response = self.client.post(f"/api/v1/meetings/{self.mid}/regenerate", json={"template": "unknown"})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.requests, [])

    def test_concurrent_transcript_edit_drops_stale_answer(self):
        self.reply = {**self.answer_draft(), "answer": "STALE GENERATED ANSWER"}
        def edit():
            with SessionLocal() as db:
                db.get(TranscriptSegment, self.segments[0]["id"]).text = "The report has been cancelled."
                db.commit()
        self.mutate_during_call = edit
        response = self.client.post(f"/api/v1/meetings/{self.mid}/chat", json={"question": "report"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertNotIn("STALE", response.json()["answer"])
        self.assertTrue(all("cancelled" in c["quote"] for c in response.json()["citations"]))

    def test_suggestion_cannot_be_accepted_in_other_meeting(self):
        suggestion = self.add_suggestion()
        other = self.create()
        response = self.client.post(f"/api/v1/meetings/{other}/action-suggestions/{suggestion['id']}/accept")
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
