"""Core regression tests. Always uses a temporary DB; never reseeds user data.

Run from backend: python tests/test_core.py
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

TEMP = tempfile.TemporaryDirectory(prefix="fireflies-core-")
os.environ["FI_REFLIES_DB_PATH"] = str(Path(TEMP.name) / "test.db")
os.environ["MEDIA_DIR"] = str(Path(TEMP.name) / "media")
os.environ["SEED_ON_START"] = "true"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app.database import engine


class CoreTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Fixtures are real; media synthesis is irrelevant to these API tests.
        cls.audio_patch = patch("app.seed.seed._generate_audio")
        cls.audio_patch.start()
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        cls.audio_patch.stop()
        engine.dispose()
        TEMP.cleanup()

    def create(self):
        response = self.client.post("/api/v1/meetings", json={
            "title": "Core regression", "meeting_date": "2026-10-09T23:45:00",
            "participants": [],
            "transcript_text": "00:01 Ada: I'll send the detailed report by Friday.\n00:15 Grace: We reviewed the launch milestones today.",
        })
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["id"]

    def test_import_and_participant_edit(self):
        mid = self.create()
        detail = self.client.get(f"/api/v1/meetings/{mid}").json()
        participants = detail["participants"]
        self.assertEqual([p["name"] for p in participants], ["Ada", "Grace"])
        self.assertGreater(participants[0]["word_count"], 0)
        ada_id = participants[0]["id"]
        participants[0]["name"] = "Ada Lovelace"
        response = self.client.patch(f"/api/v1/meetings/{mid}", json={"title": "Updated", "participants": participants})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["participants"][0]["id"], ada_id)
        transcript = self.client.get(f"/api/v1/meetings/{mid}/transcript").json()
        self.assertEqual(transcript["segments"][0]["speaker_name"], "Ada Lovelace")
        removed = self.client.patch(f"/api/v1/meetings/{mid}", json={"participants": [participants[1]]})
        self.assertEqual(removed.status_code, 200, removed.text)
        transcript = self.client.get(f"/api/v1/meetings/{mid}/transcript").json()
        self.assertIsNone(transcript["segments"][0]["speaker_id"])

    def test_task_edit_clear_and_regenerate(self):
        mid = self.create()
        task = self.client.get(f"/api/v1/tasks?meeting_id={mid}").json()[0]
        self.assertIsNotNone(task["assignee_id"])
        response = self.client.patch(f"/api/v1/action-items/{task['id']}", json={
            "description": "My edited task", "status": "done", "due_date": "2026-10-12",
        })
        self.assertEqual(response.status_code, 200, response.text)
        response = self.client.patch(f"/api/v1/action-items/{task['id']}", json={"assignee_id": None, "due_date": None})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIsNone(response.json()["assignee_id"])
        self.assertIsNone(response.json()["due_date"])
        for _ in range(2):
            self.assertEqual(self.client.post(f"/api/v1/meetings/{mid}/regenerate").status_code, 200)
        tasks = self.client.get(f"/api/v1/tasks?meeting_id={mid}").json()
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0]["description"], "My edited task")
        self.assertEqual(tasks[0]["status"], "done")

    def test_date_range_inclusive_and_invalid(self):
        mid = self.create()
        response = self.client.get("/api/v1/meetings?date_from=2026-10-09&date_to=2026-10-09")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn(mid, [m["id"] for m in response.json()["items"]])
        self.assertEqual(self.client.get("/api/v1/meetings?date_from=invalid").status_code, 422)
        self.assertEqual(self.client.get("/api/v1/meetings?date_from=2026-10-10&date_to=2026-10-09").status_code, 422)

    def test_restart_preserves_changes(self):
        mid = self.create()
        self.client.patch(f"/api/v1/meetings/{mid}", json={"title": "Keep after restart"})
        with TestClient(app) as restarted:
            response = restarted.get(f"/api/v1/meetings/{mid}")
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()["title"], "Keep after restart")

    def test_task_create_and_transcript_stats(self):
        mid = self.create()
        participant = self.client.get(f"/api/v1/meetings/{mid}").json()["participants"][0]
        response = self.client.post(f"/api/v1/meetings/{mid}/action-items", json={
            "description": "Manual task", "assignee_id": participant["id"], "due_date": "2026-10-12",
        })
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["assignee_name"], "Ada")
        segment = self.client.get(f"/api/v1/meetings/{mid}/transcript").json()["segments"][0]
        response = self.client.patch(f"/api/v1/transcript-segments/{segment['id']}", json={"text": "Two words"})
        self.assertEqual(response.status_code, 200, response.text)
        participant = self.client.get(f"/api/v1/meetings/{mid}").json()["participants"][0]
        self.assertEqual(participant["word_count"], 2)

    def test_delete_cascades(self):
        mid = self.create()
        tasks = self.client.get(f"/api/v1/tasks?meeting_id={mid}").json()
        self.assertGreater(len(tasks), 0)
        self.assertEqual(self.client.delete(f"/api/v1/meetings/{mid}").status_code, 204)
        self.assertEqual(self.client.get(f"/api/v1/meetings/{mid}").status_code, 404)
        self.assertEqual(self.client.get(f"/api/v1/tasks?meeting_id={mid}").json(), [])

    def test_invalid_import_and_cross_meeting_assignment(self):
        response = self.client.post("/api/v1/meetings", json={
            "title": "Invalid", "meeting_date": "2026-10-09", "transcript_text": "not a parsed line",
        })
        self.assertEqual(response.status_code, 422)
        first, second = self.create(), self.create()
        task = self.client.get(f"/api/v1/tasks?meeting_id={first}").json()[0]
        other = self.client.get(f"/api/v1/meetings/{second}").json()["participants"][0]["id"]
        self.assertEqual(self.client.patch(f"/api/v1/action-items/{task['id']}", json={"assignee_id": other}).status_code, 422)

    def test_chat_citations_survive_history(self):
        mid = self.create()
        for route in [f"/api/v1/meetings/{mid}/chat", "/api/v1/chat"]:
            response = self.client.post(route, json={"question": "Summarize the action items"})
            self.assertEqual(response.status_code, 200, response.text)
            citations = response.json()["citations"]
            self.assertTrue(citations)
            self.assertTrue(all(isinstance(c["meeting_title"], str) for c in citations))
            history = self.client.get(route).json()
            self.assertEqual(history[-1]["citations"], citations)
        response = self.client.post(f"/api/v1/meetings/{mid}/chat", json={"question": "How long was this meeting?"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn("minutes", response.json()["answer"])
        self.assertEqual(self.client.post("/api/v1/chat", json={"question": "  "}).status_code, 422)

    def test_search_snippet_escapes_uploaded_markup(self):
        mid = self.create()
        segment = self.client.get(f"/api/v1/meetings/{mid}/transcript").json()["segments"][0]
        self.client.patch(f"/api/v1/transcript-segments/{segment['id']}", json={
            "text": '<img src=x onerror=alert(1)> uniquelysearchable <script>alert(2)</script>',
        })
        response = self.client.get("/api/v1/search?q=uniquelysearchable")
        self.assertEqual(response.status_code, 200, response.text)
        snippet = response.json()["transcript_matches"][0]["text"]
        self.assertIn("<mark>uniquelysearchable</mark>", snippet)
        self.assertNotIn("<img", snippet)
        self.assertNotIn("<script", snippet)
        self.assertIn("&lt;img", snippet)

    def test_tags_assign_filter_and_clear(self):
        mid = self.create()
        response = self.client.post(f"/api/v1/meetings/{mid}/tags", json={"tags": [" AuditTag ", "audittag"]})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(response.json()), 1)
        self.assertIn("audittag", [t["name"] for t in self.client.get("/api/v1/tags").json()])
        self.assertIn(mid, [m["id"] for m in self.client.get("/api/v1/meetings?tag=audittag").json()["items"]])
        response = self.client.post(f"/api/v1/meetings/{mid}/tags", json={"tags": []})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), [])


if __name__ == "__main__":
    unittest.main()
