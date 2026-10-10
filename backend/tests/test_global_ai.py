"""Global AskFred tests: fake Groq/models, real temporary SQL/FTS/vector data."""

import json
import asyncio
import os
import sys
import tempfile
import unittest
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import patch

TEMP = tempfile.TemporaryDirectory(prefix="fireflies-global-ai-")
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
from sqlalchemy import select
from app.config import Settings
from app.database import SessionLocal, engine
from app.main import app
from app.models import ActionItem, ChatMessage, Meeting, Participant, TranscriptSegment, User
from app.services.hybrid_retrieval import Retriever
from app.services.llm_client import LLMClient
from app.services.query_planning import date_bounds, preset_dates
from app.services.retrieval_indexer import Indexer

NOW = datetime(2026, 10, 9, 12, tzinfo=timezone.utc)


class FakeModels:
    identity = "test@v1"
    enabled = True
    def embed(self, texts):
        return [[1, 0, 0] if any(word in value.lower() for word in ["price", "pricing", "discount", "commercial", "cost"])
                else [0, 1, 0] for value in texts]
    def rerank(self, query, texts):
        return [2.0 if "approved" in value.lower() else 1.0 for value in texts]


def plan(**changes):
    output = {"intent": "discussion", "scope": "workspace", "meeting_ids": [], "participant_names": [],
              "participant_role": "attendee", "meeting_status": "ready", "count_target": "meetings",
              "date_preset": "none", "date_from": None, "date_to": None, "date_field": "meeting_date",
              "task_status": None, "search_terms": ["pricing", "price"], "clarification": None}
    return {**output, **changes}


class GlobalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.client.__enter__()
        with SessionLocal() as db:
            user = User(name="Ada", email="ada@example.test", avatar_color="#7c5cff", is_default=True)
            db.add(user)
            db.commit()
            cls.uid = user.id

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        engine.dispose()
        TEMP.cleanup()

    def meeting(self, title, when, statements, status="ready"):
        with SessionLocal() as db:
            meeting = Meeting(title=title, meeting_date=datetime.fromisoformat(when), status=status, host_id=self.uid)
            db.add(meeting)
            db.flush()
            people, segments = {}, []
            for i, (name, statement) in enumerate(statements):
                if name not in people:
                    person = Participant(meeting_id=meeting.id, name=name, avatar_color="#7c5cff")
                    db.add(person)
                    db.flush()
                    people[name] = person.id
                segment = TranscriptSegment(meeting_id=meeting.id, speaker_id=people[name], start_ms=i * 10000,
                                            end_ms=i * 10000 + 8000, order_index=i, text=statement)
                db.add(segment)
                db.flush()
                segments.append(segment.id)
            db.commit()
            return meeting.id, people, segments

    def setUp(self):
        self.original_llm = app.state.llm_client
        self.original_retriever = app.state.retriever
        with SessionLocal() as db:
            db.query(ChatMessage).delete()
            db.query(Meeting).delete()
            db.commit()
        self.mid, self.people, self.sids = self.meeting("Pricing Review", "2026-10-08T12:00:00", [
            ("Ada", "I will send the pricing quote. We proposed a discount."),
            ("Bob", "We rejected that proposal and approved the unchanged price."),
        ])
        self.old, _, self.old_sids = self.meeting("Engineering Sync", "2026-09-15T12:00:00", [
            ("Grace", "We reviewed the latency outage and approved a rollback."),
        ])
        with SessionLocal() as db:
            for description, owner, due, status in [
                ("Send quote", "Ada", "2026-10-10", "open"),
                ("Completed task", "Ada", "2026-10-11", "done"),
                ("Next week task", "Ada", "2026-10-12", "open"),
                ("Bob task", "Bob", "2026-10-10", "open"),
                ("Overdue task", "Ada", "2026-10-01", "open"),
                ("Manual unsourced task", "Ada", "2026-10-10", "open"),
            ]:
                db.add(ActionItem(meeting_id=self.mid, description=description, assignee_id=self.people[owner],
                    status=status, due_date=datetime.fromisoformat(due),
                    completed_at=datetime(2026, 10, 9) if status == "done" else None,
                    source_segment_id=None if "Manual" in description else self.sids[0]))
            db.commit()
        self.config = Settings(_env_file=None, llm_allow_external=True, llm_api_key="fake-only", llm_model="test",
            llm_max_retries=0, workspace_timezone="UTC", rag_embedding_dimensions=3, rag_chunk_chars=200)
        models = FakeModels()
        self.indexer = Indexer(self.config, models)
        self.indexer.index_meeting(self.mid)
        self.indexer.index_meeting(self.old)
        app.state.retriever = Retriever(self.config, models)
        self.output_plan = plan()
        self.answer_ids = None
        self.status = 200
        self.mutate = None
        self.requests = []
        self.answer_text = "Bob rejected the discount and approved the unchanged price."
        self.delay = 0
        async def handler(request):
            payload = json.loads(request.content)
            context = json.loads(payload["messages"][1]["content"])
            self.requests.append(context)
            if self.delay:
                await asyncio.sleep(self.delay)
            if "current_date" in context:
                output = self.output_plan
            else:
                if self.mutate:
                    self.mutate()
                ids = self.answer_ids if self.answer_ids is not None else [row["id"] for row in context["segments"] if "approved" in row["text"]][:1]
                output = {"answer": self.answer_text, "source_segment_ids": ids, "insufficient_evidence": False}
            return httpx.Response(self.status, json={"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(output)}}]})
        self.http = httpx.AsyncClient(transport=httpx.MockTransport(handler), trust_env=False)
        app.state.llm_client = LLMClient(self.config, self.http)
        self.clock = patch("app.services.global_ai.current_time", return_value=NOW)
        self.clock.start()

    def tearDown(self):
        self.clock.stop()
        self.client.portal.call(self.http.aclose)
        app.state.llm_client = self.original_llm
        app.state.retriever = self.original_retriever

    def ask(self, question):
        response = self.client.post("/api/v1/chat", json={"question": question})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def task_plan(self, **changes):
        self.output_plan = plan(intent="tasks", participant_role="assignee", meeting_status="all", count_target="tasks",
                                date_field="due_date", search_terms=[], **changes)

    def test_personal_due_week_is_sql_not_top_k(self):
        self.task_plan(date_preset="this_week")
        result = self.ask("What are my tasks due this week?")
        self.assertIn("3 matching tasks", result["answer"])
        self.assertIn("2026-10-05 to 2026-10-11", result["answer"])
        self.assertNotIn("Bob task", result["answer"])
        self.assertNotIn("Next week task", result["answer"])
        self.assertEqual(len(self.requests), 1)  # no model arithmetic/formatting call

    def test_task_count_and_open_filter(self):
        self.output_plan = plan(intent="count", count_target="tasks", participant_role="assignee", meeting_status="all",
                                date_field="due_date", date_preset="this_week", task_status="open", search_terms=[])
        result = self.ask("How many of my open tasks are due this week?")
        self.assertIn("2 matching tasks", result["answer"])
        self.assertEqual(len(self.requests), 1)

    def test_count_covers_entire_workspace_not_catalog(self):
        self.config.global_catalog_limit = 1
        self.meeting("Scheduled Planning", "2026-10-14", [], "scheduled")
        self.output_plan = plan(intent="count", count_target="meetings", meeting_status="all", search_terms=[])
        self.assertIn("3 matching meetings", self.ask("How many meetings are there?")["answer"])

    def test_output_list_limit_keeps_exact_count(self):
        self.config.global_task_limit = 1
        self.task_plan(date_preset="this_week")
        result = self.ask("List my tasks due this week")
        self.assertIn("3 matching tasks", result["answer"])
        self.assertIn("Showing the first 1", result["answer"])

    def test_completed_period_is_not_due_period(self):
        self.task_plan(date_preset="this_week", task_status="done")
        self.output_plan["date_field"] = "completed_at"
        result = self.ask("Which of my tasks were completed this week?")
        self.assertIn("1 matching tasks", result["answer"])

    def test_discussion_uses_scoped_grounded_sources(self):
        self.output_plan = plan(date_preset="this_week")
        result = self.ask("What did we decide about pricing this week?")
        self.assertTrue(result["citations"])
        self.assertEqual({c["meeting_id"] for c in result["citations"]}, {self.mid})
        self.assertEqual(result["citations"][0]["segment_id"], self.sids[1])
        self.assertIn("unchanged price", result["citations"][0]["quote"])
        self.assertEqual(self.client.get("/api/v1/chat").json()[-1]["citations"], result["citations"])
        self.assertTrue(all(row["meeting_id"] == self.mid for row in self.requests[-1]["segments"]))

    def test_foreign_source_not_sent_to_model_is_rejected(self):
        self.output_plan = plan(scope="meeting", meeting_ids=[self.mid])
        self.answer_ids = [self.old_sids[0]]
        self.answer_text = "UNTRUSTED ANSWER"
        result = self.ask("What did we decide in the Pricing Review meeting?")
        self.assertNotIn("UNTRUSTED", result["answer"])
        self.assertTrue(all(c["meeting_id"] == self.mid for c in result["citations"]))

    def test_ambiguous_first_name_is_clarified(self):
        self.meeting("First Review", "2026-10-08", [("Alex Smith", "First participant.")])
        self.meeting("Second Review", "2026-10-08", [("Alex Jones", "Second participant.")])
        self.output_plan = plan(participant_names=["Alex Smith"], participant_role="speaker")
        result = self.ask("What did Alex say?")
        self.assertIn("full participant name", result["answer"])
        self.assertEqual(result["citations"], [])
        self.assertEqual(len(self.requests), 1)

    def test_unknown_meeting_is_not_widened(self):
        self.output_plan = plan(scope="meeting", meeting_ids=[999999])
        result = self.ask("Summarize meeting #999999")
        self.assertIn("couldn't identify", result["answer"])
        self.assertEqual(result["citations"], [])

    def test_model_cannot_invent_participant_filter(self):
        self.output_plan = plan(participant_names=["Grace"])
        result = self.ask("What did we decide about pricing?")
        self.assertTrue(result["citations"], result)
        self.assertTrue(all(c["meeting_id"] == self.mid for c in result["citations"]))
        self.assertEqual(self.requests[-1]["resolved_scope"]["participant_names"], [])

    def test_model_sql_is_rejected(self):
        self.task_plan(date_preset="this_week")
        self.output_plan["sql"] = "DROP TABLE meetings"
        result = self.ask("What are my tasks due this week?")
        self.assertIn("3 matching tasks", result["answer"])
        with SessionLocal() as db:
            self.assertIsNotNone(db.get(Meeting, self.mid))

    def test_disabled_provider_still_uses_exact_sql_scope(self):
        self.config.llm_allow_external = False
        result = self.ask("What are my open tasks due this week?")
        self.assertIn("2 matching tasks", result["answer"])
        self.assertEqual(self.requests, [])

    def test_provider_failure_keeps_task_filters(self):
        self.status = 503
        result = self.ask("What are my tasks due this week?")
        self.assertIn("3 matching tasks", result["answer"])
        self.assertNotIn("Bob task", result["answer"])

    def test_fallback_single_date_is_one_day(self):
        self.config.llm_allow_external = False
        result = self.ask("List my tasks due on 2026-10-10")
        self.assertIn("2 matching tasks", result["answer"])
        self.assertNotIn("Completed task", result["answer"])

    def test_bad_user_date_is_clarified(self):
        self.config.llm_allow_external = False
        result = self.ask("List my tasks due on 2026-99-99")
        self.assertIn("valid date range", result["answer"])
        self.assertEqual(result["citations"], [])

    def test_pending_index_uses_current_keywords(self):
        with SessionLocal() as db:
            db.get(Meeting, self.mid).title = "Pricing Review Updated"
            db.commit()
        result = self.ask("What did we decide about pricing?")
        self.assertTrue(result["citations"])
        self.assertTrue(all(c["meeting_title"] == "Pricing Review Updated" for c in result["citations"]))

    def test_pending_and_indexed_meetings_both_supply_comparison(self):
        mid, _, sids = self.meeting("September Pricing", "2026-09-20", [("Ada", "We approved a discount on commercial terms.")])
        self.indexer.index_meeting(mid)
        with SessionLocal() as db:
            db.get(Meeting, self.mid).title = "Pricing Review Updated"
            db.commit()
        self.output_plan = plan(date_preset="since_last_month")
        self.answer_ids = [self.sids[1], sids[0]]
        result = self.ask("How has pricing changed since last month?")
        self.assertEqual({c["meeting_id"] for c in result["citations"]}, {mid, self.mid})

    def test_follow_up_has_only_global_history(self):
        self.task_plan(date_preset="this_week")
        self.ask("What are my tasks due this week?")
        with SessionLocal() as db:
            db.add(ChatMessage(meeting_id=self.mid, role="user", content="MEETING-ONLY PRIVATE HISTORY"))
            db.commit()
        self.output_plan["date_preset"] = "last_week"
        result = self.ask("And last week?")
        self.assertIn("1 matching tasks", result["answer"])
        self.assertIn("2026-09-28 to 2026-10-04", result["answer"])
        self.assertNotIn("MEETING-ONLY", json.dumps(self.requests[-1]))
        self.assertEqual(len(self.requests[-1]["history"]), 2)

    def test_concurrent_edit_discards_model_answer(self):
        def mutate():
            with SessionLocal() as db:
                db.get(TranscriptSegment, self.sids[1]).text = "The pricing decision was reversed."
                db.commit()
        self.mutate = mutate
        result = self.ask("What did we decide about pricing?")
        self.assertIn("workspace changed", result["answer"].lower())
        self.assertEqual(result["citations"], [])

    def test_scope_specific_unknown_person_not_broadened(self):
        self.output_plan = plan(participant_names=[])
        result = self.ask("What did Xavier say about pricing?")
        self.assertIn("full participant name", result["answer"])
        self.assertEqual(result["citations"], [])

    def test_partial_context_is_disclosed(self):
        result = self.ask("What did we decide about pricing?")
        self.assertIn("Coverage:", result["answer"])
        self.assertIn("not an exhaustive", result["answer"])

    def test_question_size_limit(self):
        response = self.client.post("/api/v1/chat", json={"question": "x" * 4001})
        self.assertEqual(response.status_code, 422)

    def test_deadline_uses_sql_without_second_provider_attempt(self):
        self.config.global_chat_timeout_seconds = 0.01
        self.delay = 0.05
        result = self.ask("What are my tasks due this week?")
        self.assertIn("3 matching tasks", result["answer"])
        self.assertEqual(len(self.requests), 1)

    def test_explicit_count_does_not_use_model_arithmetic(self):
        self.output_plan = plan(search_terms=[])
        result = self.ask("How many meetings are there?")
        self.assertIn("2 matching meetings", result["answer"])
        self.assertEqual(len(self.requests), 1)

    def test_comparison_context_contains_both_periods(self):
        mid, _, sids = self.meeting("September Pricing", "2026-09-20", [("Ada", "We approved a discount on commercial terms.")])
        self.indexer.index_meeting(mid)
        self.output_plan = plan(date_preset="since_last_month")
        self.answer_ids = [self.sids[1], sids[0]]
        result = self.ask("How has pricing changed since last month?")
        self.assertEqual({c["meeting_id"] for c in result["citations"]}, {self.mid, mid})
        dates = {row["meeting_date"][:7] for row in self.requests[-1]["segments"]}
        self.assertEqual(dates, {"2026-09", "2026-10"})

    def test_latest_meeting_is_resolved_within_period(self):
        self.config.global_catalog_limit = 1
        self.output_plan = plan(intent="summary", scope="meeting", meeting_ids=[self.mid], date_preset="last_month", search_terms=[])
        self.answer_text = "Grace approved a rollback after the latency outage."
        result = self.ask("Summarize the last meeting from last month")
        self.assertTrue(result["citations"])
        self.assertEqual({c["meeting_id"] for c in result["citations"]}, {self.old})

    def test_model_cannot_omit_explicit_iso_date(self):
        self.task_plan()
        result = self.ask("List my tasks due on 2026-10-10")
        self.assertIn("2 matching tasks", result["answer"])
        self.assertNotIn("Completed task", result["answer"])

    def test_follow_up_changes_assignee_without_retaining_me(self):
        self.task_plan(date_preset="this_week")
        self.ask("List my tasks due this week")
        self.output_plan["participant_names"] = ["Bob"]
        result = self.ask("And assigned to Bob?")
        self.assertIn("1 matching tasks", result["answer"])
        self.assertIn("Bob task", result["answer"])
        self.assertNotIn("Send quote", result["answer"])

    def test_truncated_previous_question_requires_restatement(self):
        self.task_plan(date_preset="this_week")
        self.ask("Please consider " + "context " * 160 + "my tasks due this week")
        result = self.ask("And last week?")
        self.assertIn("restate", result["answer"])
        self.assertEqual(result["citations"], [])

    def test_oversized_meeting_id_is_clarified(self):
        result = self.ask("Summarize meeting #" + "9" * 100)
        self.assertIn("valid positive meeting ID", result["answer"])
        self.assertEqual(self.requests, [])

    def test_unsupported_relative_period_not_broadened(self):
        self.config.llm_allow_external = False
        result = self.ask("What did we decide about pricing in the past 2 months?")
        self.assertIn("date range", result["answer"])
        self.assertEqual(result["citations"], [])

    def test_overdue_and_unfinished_include_in_progress(self):
        with SessionLocal() as db:
            db.add(ActionItem(meeting_id=self.mid, description="In-progress overdue task", assignee_id=self.people["Ada"],
                              status="in_progress", due_date=datetime(2026, 10, 2)))
            db.commit()
        self.config.llm_allow_external = False
        result = self.ask("How many of my overdue tasks are there today?")
        self.assertIn("2 matching tasks", result["answer"])
        self.assertIn("not done", result["answer"])

    def test_new_latest_meeting_discards_stale_answer(self):
        self.output_plan = plan(scope="meeting", meeting_ids=[self.mid], search_terms=[])
        self.mutate = lambda: self.meeting("New Latest", "2026-10-09T13:00:00", [("Ada", "A new discussion took place.")])
        result = self.ask("Summarize the latest meeting")
        self.assertIn("workspace changed", result["answer"].lower())
        self.assertEqual(result["citations"], [])

    def test_weekday_fallback_requests_explicit_dates(self):
        self.config.llm_allow_external = False
        result = self.ask("List my tasks due by Friday")
        self.assertIn("date range", result["answer"])
        self.assertEqual(result["citations"], [])

    def test_meeting_offset_normalized_and_serialized_as_utc(self):
        self.config.llm_allow_external = False
        response = self.client.post("/api/v1/meetings", json={"title": "Timezone test", "meeting_date": "2026-10-09T00:30:00+05:30"})
        self.assertEqual(response.status_code, 201, response.text)
        meeting = self.client.get(f"/api/v1/meetings/{response.json()['id']}").json()
        self.assertEqual(meeting["meeting_date"], "2026-10-08T19:00:00Z")

    def test_date_filter_cannot_be_invented(self):
        self.output_plan = plan(date_preset="last_month")
        result = self.ask("What did we decide about pricing?")
        self.assertTrue(result["citations"], result)
        self.assertTrue(all(c["meeting_id"] == self.mid for c in result["citations"]))
        self.assertEqual(self.requests[-1]["resolved_scope"]["date_preset"], "none")


class CalendarTests(unittest.TestCase):
    def test_monday_week_and_month_boundary(self):
        self.assertEqual(preset_dates("this_week", date(2026, 10, 9)), (date(2026, 10, 5), date(2026, 10, 11)))
        self.assertEqual(preset_dates("last_month", date(2026, 1, 3)), (date(2025, 12, 1), date(2025, 12, 31)))
        self.assertEqual(preset_dates("since_last_month", date(2026, 10, 9)), (date(2026, 9, 1), date(2026, 10, 9)))

    def test_local_calendar_due_dates_vs_utc_meeting_times(self):
        from app.services.llm_schemas import QueryPlan
        config = Settings(_env_file=None, workspace_timezone="Asia/Kolkata")
        value = QueryPlan.model_validate(plan(date_preset="custom", date_from="2026-10-09", date_to="2026-10-09"))
        start, end = date_bounds(value, config)
        self.assertEqual(start, datetime(2026, 10, 8, 18, 30))
        self.assertEqual(end, datetime(2026, 10, 9, 18, 30))
        due = value.model_copy(update={"date_field": "due_date"})
        self.assertEqual(date_bounds(due, config), (datetime(2026, 10, 9), datetime(2026, 10, 10)))


if __name__ == "__main__":
    unittest.main()
