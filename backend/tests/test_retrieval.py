"""Phase 3: real temporary SQLite/FTS/sqlite-vec, fake inference (no models).

Run from backend: python tests/test_retrieval.py
"""

import json
import os
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from datetime import date, datetime
from pathlib import Path

TEMP = tempfile.TemporaryDirectory(prefix="fireflies-retrieval-")
os.environ["FI_REFLIES_DB_PATH"] = str(Path(TEMP.name) / "test.db")
os.environ["MEDIA_DIR"] = str(Path(TEMP.name) / "media")
os.environ["SEED_ON_START"] = "false"
os.environ["LLM_ALLOW_EXTERNAL"] = "false"
os.environ["RAG_INDEXING_ENABLED"] = "false"
os.environ["RAG_INFERENCE_MODE"] = "disabled"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError

from app.config import Settings
from app.database import SessionLocal, engine, init_db
from app.models import (Meeting, Participant, RetrievalChunk, RetrievalEmbedding,
                        RetrievalState, Summary, SummaryItem, SummarySection, TranscriptSegment, User)
from app.services.hybrid_retrieval import Retriever, SearchScope, fuse_rankings
from app.services.retrieval_indexer import Indexer, IndexWorker, make_chunks
from app.services.retrieval_inference import Inference, InferenceUnavailable, validate_vectors


class FakeInference:
    enabled = True
    identity = "fake@v1"
    fail_embed = False
    fail_rank = False
    bad_vectors = False
    on_embed = None
    on_rank = None

    def embed(self, texts):
        if self.on_embed:
            self.on_embed()
        if self.fail_embed:
            raise InferenceUnavailable("fake_failure")
        if self.bad_vectors:
            return [[float("nan"), 0, 1] for _ in texts]
        return [[1, 0, 0] if any(word in value.lower() for word in ["price", "pricing", "discount", "commercial"]) else
                [0, 1, 0] if "outage" in value.lower() else [0, 0, 1] for value in texts]

    def rerank(self, query, texts):
        if self.on_rank:
            self.on_rank()
        if self.fail_rank:
            raise InferenceUnavailable("fake_failure")
        return [2.0 if "approved" in value.lower() else 1.0 for value in texts]

    def close(self):
        pass


class RetrievalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        with SessionLocal() as db:
            user = User(name="Default", email="test@example.test", avatar_color="#7c5cff", is_default=True)
            db.add(user)
            db.commit()
            cls.uid = user.id

    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        TEMP.cleanup()

    def setUp(self):
        with SessionLocal() as db:
            db.query(Meeting).delete()
            db.commit()
        self.config = Settings(_env_file=None, rag_embedding_dimensions=3, rag_chunk_chars=100,
                               rag_candidates=20, rag_rerank_candidates=12)
        self.provider = FakeInference()
        self.indexer = Indexer(self.config, self.provider)
        self.retriever = Retriever(self.config, self.provider)
        self.price = self.meeting("Pricing", "2026-10-09T23:45:00", [
            ("Ada", "We proposed a discount."), ("Grace", "We rejected the discount and approved the unchanged price."),
        ])
        self.outage = self.meeting("Operations", "2026-10-09T12:00:00", [
            ("Bob", "We approved a rollback after the outage."), ("Alice", "Recovery takes fifteen minutes."),
        ])
        self.old = self.meeting("Old contract", "2026-09-01T12:00:00", [("Cara", "A discount was approved for commercial terms.")])
        for mid in [self.price, self.outage, self.old]:
            self.assertTrue(self.indexer.index_meeting(mid))

    def meeting(self, title, when, utterances):
        with SessionLocal() as db:
            meeting = Meeting(title=title, meeting_date=datetime.fromisoformat(when), host_id=self.uid, status="ready")
            db.add(meeting)
            db.flush()
            for i, (name, content) in enumerate(utterances):
                person = Participant(meeting_id=meeting.id, name=name, avatar_color="#7c5cff")
                db.add(person)
                db.flush()
                db.add(TranscriptSegment(meeting_id=meeting.id, speaker_id=person.id, text=content,
                    start_ms=i * 20000, end_ms=i * 20000 + 10000, order_index=i))
            db.commit()
            return meeting.id

    def scope(self):
        return SearchScope(meeting_ids=(self.price,))

    def test_native_vector_extension_and_fts(self):
        with SessionLocal() as db:
            self.assertTrue(db.scalar(text("SELECT vec_version()")))
            self.assertGreater(db.scalar(text("SELECT count(*) FROM retrieval_fts")), 0)

    def test_schema_initialization_is_repeat_safe(self):
        with SessionLocal() as db:
            before = db.scalar(select(func.count()).select_from(RetrievalChunk))
            revision = db.get(RetrievalState, self.price).indexed_revision
        init_db()
        with SessionLocal() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(RetrievalChunk)), before)
            self.assertEqual(db.get(RetrievalState, self.price).indexed_revision, revision)
            self.assertEqual(db.scalar(text("SELECT count(*) FROM retrieval_fts")), before)

    def test_semantic_match_without_shared_keywords(self):
        result = self.retriever.retrieve("commercial arrangement", self.scope())
        self.assertEqual(result["mode"], "hybrid")
        self.assertTrue(result["reranked"])
        self.assertTrue(result["hits"])
        self.assertTrue(all(hit["meeting_id"] == self.price for hit in result["hits"]))

    def test_keyword_fallback(self):
        self.provider.fail_embed = self.provider.fail_rank = True
        result = self.retriever.retrieve("price", self.scope())
        self.assertEqual(result["mode"], "lexical")
        self.assertTrue(result["hits"])

    def test_native_vector_unavailable_keeps_keyword_results(self):
        original = Session.execute
        def execute(db, statement, *args, **kwargs):
            if "vec_distance_cosine" in str(statement):
                raise OperationalError("vector search", {}, Exception("unavailable"))
            return original(db, statement, *args, **kwargs)
        with patch.object(Session, "execute", execute):
            result = self.retriever.retrieve("price", self.scope())
        self.assertEqual(result["mode"], "lexical")
        self.assertTrue(result["hits"])

    def test_fts_unavailable_uses_keyword_fallback(self):
        original = Session.execute
        def execute(db, statement, *args, **kwargs):
            if "retrieval_fts MATCH" in str(statement):
                raise OperationalError("FTS query", {}, Exception("unavailable"))
            return original(db, statement, *args, **kwargs)
        self.provider.fail_embed = True
        with patch.object(Session, "execute", execute):
            result = self.retriever.retrieve("price", self.scope())
        self.assertEqual(result["mode"], "lexical")
        self.assertTrue(result["hits"])

    def test_reranker_failure_keeps_rank_fusion(self):
        self.provider.fail_rank = True
        result = self.retriever.retrieve("price", self.scope())
        self.assertFalse(result["reranked"])
        self.assertTrue(result["hits"])

    def test_date_and_participant_scope(self):
        scope = SearchScope(date_from=date(2026, 10, 9), date_to=date(2026, 10, 9), participant_names=("Grace",))
        result = self.retriever.retrieve("commercial arrangement", scope)
        self.assertTrue(result["hits"])
        self.assertEqual({h["meeting_id"] for h in result["hits"]}, {self.price})

    def test_empty_scope_never_becomes_workspace(self):
        self.assertEqual(self.retriever.retrieve("price", SearchScope(meeting_ids=()))["hits"], [])

    def test_edit_invalidates_before_reindex(self):
        with SessionLocal() as db:
            segment = db.scalar(select(TranscriptSegment).where(TranscriptSegment.meeting_id == self.price).order_by(TranscriptSegment.id.desc()))
            segment.text = "The conversation now concerns gardening."
            db.commit()
        self.assertEqual(self.retriever.retrieve("price", self.scope())["hits"], [])
        self.assertTrue(self.indexer.index_meeting(self.price))
        with SessionLocal() as db:
            state = db.get(RetrievalState, self.price)
            self.assertEqual(state.revision, state.indexed_revision)

    def test_metadata_and_speaker_edits_invalidate(self):
        with SessionLocal() as db:
            before = db.get(RetrievalState, self.price).revision
            db.get(Meeting, self.price).title = "New title"
            db.scalar(select(Participant).where(Participant.meeting_id == self.price)).name = "Renamed"
            db.commit()
            self.assertGreater(db.get(RetrievalState, self.price).revision, before)
        self.assertEqual(self.retriever.retrieve("price", self.scope())["hits"], [])

    def test_delete_cascades_to_vectors_and_fts(self):
        with SessionLocal() as db:
            ids = list(db.scalars(select(RetrievalChunk.id).where(RetrievalChunk.meeting_id == self.price)))
            db.delete(db.get(Meeting, self.price))
            db.commit()
            self.assertIsNone(db.get(RetrievalState, self.price))
            self.assertEqual(db.scalar(select(func.count()).select_from(RetrievalEmbedding).where(RetrievalEmbedding.chunk_id.in_(ids))), 0)
            for cid in ids:
                self.assertEqual(db.scalar(text("SELECT count(*) FROM retrieval_fts WHERE rowid=:id"), {"id": cid}), 0)
        self.assertEqual(self.retriever.retrieve("price", self.scope())["hits"], [])

    def test_stale_build_cannot_publish(self):
        def mutate():
            with SessionLocal() as db:
                db.scalar(select(TranscriptSegment).where(TranscriptSegment.meeting_id == self.price)).text = "Changed during encoding"
                db.commit()
        self.provider.on_embed = mutate
        self.assertFalse(self.indexer.index_meeting(self.price))
        self.provider.on_embed = None
        self.assertEqual(self.retriever.retrieve("price", self.scope())["hits"], [])

    def test_change_during_rerank_drops_stale_hit(self):
        def mutate():
            with SessionLocal() as db:
                db.get(Meeting, self.price).is_deleted = True
                db.commit()
        self.provider.on_rank = mutate
        self.assertEqual(self.retriever.retrieve("price", self.scope())["hits"], [])

    def test_expansion_includes_replies_in_order_without_duplicates(self):
        scope = SearchScope(meeting_ids=(self.price,), participant_names=("Grace",))
        hits = self.retriever.retrieve("price", scope)["hits"]
        context = self.retriever.expand(hits + hits, scope)
        self.assertEqual({row["speaker_name"] for row in context}, {"Ada", "Grace"})
        self.assertEqual(len(context), len({row["id"] for row in context}))
        self.assertEqual([row["start_ms"] for row in context], sorted(row["start_ms"] for row in context))
        self.assertTrue(all(row["meeting_id"] == self.price for row in context))
        self.assertEqual(self.retriever.expand(hits, scope, max_chars=1), [])

    def test_expansion_rejects_stale_revision(self):
        hits = self.retriever.retrieve("price", self.scope())["hits"]
        with SessionLocal() as db:
            db.get(Meeting, self.price).title = "Changed"
            db.commit()
        self.assertEqual(self.retriever.expand(hits, self.scope()), [])

    def test_summary_is_indexed_and_edit_invalidates(self):
        with SessionLocal() as db:
            summary = Summary(meeting_id=self.price, template="general", generated_by="rules")
            db.add(summary)
            db.flush()
            section = SummarySection(summary_id=summary.id, section_type="overview", heading="Overview")
            db.add(section)
            db.flush()
            item = SummaryItem(section_id=section.id, text="Uniqueoverviewterm", source_segment_id=None)
            db.add(item)
            db.commit()
            item_id = item.id
        self.indexer.index_meeting(self.price)
        hits = self.retriever.retrieve("Uniqueoverviewterm", self.scope())["hits"]
        self.assertTrue(any(hit["kind"] == "summary" for hit in hits))
        with SessionLocal() as db:
            db.get(SummaryItem, item_id).text = "Different overview"
            db.commit()
        self.assertEqual(self.retriever.retrieve("Uniqueoverviewterm", self.scope())["hits"], [])

    def test_bad_vectors_keep_lexical_index(self):
        self.provider.bad_vectors = True
        self.assertTrue(self.indexer.index_meeting(self.price))
        self.assertTrue(self.retriever.retrieve("price", self.scope())["hits"])
        with SessionLocal() as db:
            self.assertEqual(db.get(RetrievalState, self.price).error_reason, "invalid_vectors")
            self.assertIsNone(db.get(RetrievalState, self.price).vector_model)

    def test_model_version_change_excludes_old_vectors(self):
        self.provider.identity = "fake@v2"
        result = self.retriever.retrieve("commercial arrangement", self.scope())
        self.assertEqual(result["hits"], [])
        replacement = Indexer(self.config, self.provider)
        self.assertIn(self.price, replacement.pending())
        self.assertTrue(replacement.index_meeting(self.price))
        self.assertTrue(self.retriever.retrieve("commercial arrangement", self.scope())["hits"])

    def test_queries_do_not_execute_fts_syntax(self):
        self.retriever.retrieve('price" OR *; DROP TABLE meetings;', self.scope())
        with SessionLocal() as db:
            self.assertIsNotNone(db.get(Meeting, self.price))

    def test_invalid_range_rejected(self):
        with self.assertRaises(ValueError):
            self.retriever.retrieve("price", SearchScope(date_from=date(2026, 10, 10), date_to=date(2026, 10, 9)))

    def test_background_worker_and_persisted_pending_state(self):
        with SessionLocal() as db:
            db.get(Meeting, self.price).title = "Worker updated title"
            db.commit()
        done = threading.Event()
        original = self.indexer.index_meeting
        def index(mid):
            result = original(mid)
            done.set()
            return result
        self.indexer.index_meeting = index
        worker = IndexWorker(self.indexer)
        worker.start()
        try:
            self.assertTrue(done.wait(3))
        finally:
            worker.stop()
        self.assertFalse(worker.thread.is_alive())
        self.assertNotIn(self.price, self.indexer.pending())


class InferenceTests(unittest.TestCase):
    def test_disabled_mode_does_not_import_torch(self):
        before = "torch" in sys.modules
        provider = Inference(Settings(_env_file=None, rag_inference_mode="disabled"))
        try:
            with self.assertRaises(InferenceUnavailable):
                provider.embed(["private text"])
            self.assertEqual("torch" in sys.modules, before)
        finally:
            provider.close()

    def test_invalid_vector_values(self):
        for vector in [[0, 0, 0], [1, 0], [float("nan"), 0, 1], [True, 0, 1]]:
            with self.assertRaises(InferenceUnavailable):
                validate_vectors([vector], 1, 3)

    def test_remote_contract(self):
        config = Settings(_env_file=None, rag_inference_mode="remote", rag_allow_external=True,
            rag_worker_url="https://worker.example", rag_worker_key="fake-worker-key", rag_embedding_dimensions=3)
        provider = Inference(config)
        requests = []
        def handler(request):
            requests.append(request)
            if request.url.path == "/embed":
                return httpx.Response(200, json={"identity": provider.identity, "vectors": [[1, 0, 0]]})
            return httpx.Response(200, json={"identity": config.rag_reranker_model + "@default", "scores": [0.7]})
        provider.http.close()
        provider.http = httpx.Client(transport=httpx.MockTransport(handler))
        try:
            self.assertEqual(provider.embed(["example"]), [[1, 0, 0]])
            self.assertEqual(provider.rerank("question", ["example"]), [0.7])
            self.assertEqual(requests[0].headers["authorization"], "Bearer fake-worker-key")
        finally:
            provider.close()

    def test_remote_requires_opt_in(self):
        config = Settings(_env_file=None, rag_inference_mode="remote", rag_allow_external=False,
            rag_worker_url="https://worker.example", rag_worker_key="fake-worker-key")
        provider = Inference(config)
        try:
            with self.assertRaises(InferenceUnavailable):
                provider.embed(["private text"])
        finally:
            provider.close()

    def test_rank_fusion_ignores_duplicate_ids(self):
        order, scores = fuse_rankings([1, 1, 2], [2, 3])
        self.assertEqual(order[0], 2)
        self.assertAlmostEqual(scores[1], 1 / 61)

    def test_chunk_limit_and_progress(self):
        config = Settings(_env_file=None, rag_chunk_chars=100, rag_overlap_turns=3)
        segments = [{"id": i, "text": "x" * 400, "speaker_name": "A" * 120, "start_ms": i, "end_ms": i + 1} for i in range(3)]
        chunks = make_chunks(segments, [], config)
        self.assertTrue(all(len(chunk["text"]) <= 100 for chunk in chunks))
        self.assertEqual({sid for chunk in chunks for sid in chunk["segment_ids"]}, {0, 1, 2})
        self.assertLess(len(chunks), 100)

    def test_worker_auth_and_limits_without_model_loading(self):
        from unittest.mock import patch
        from app import rag_worker
        config = Settings(_env_file=None, rag_worker_key="fake-worker-key")
        with patch.object(rag_worker, "settings", config), TestClient(rag_worker.app) as client:
            fake = FakeInference()
            original = rag_worker.app.state.inference
            rag_worker.app.state.inference = fake
            body = {"model": config.rag_embedding_model, "revision": "", "texts": ["example"]}
            headers = {"authorization": "Bearer fake-worker-key"}
            try:
                self.assertEqual(client.post("/embed", json=body).status_code, 401)
                self.assertEqual(client.post("/embed", json=body, headers=headers).status_code, 200)
                self.assertEqual(client.post("/embed", json={**body, "model": "rogue-model"}, headers=headers).status_code, 422)
                self.assertEqual(client.post("/embed", json={**body, "texts": ["x" * 4001]}, headers=headers).status_code, 422)
            finally:
                original.close()


if __name__ == "__main__":
    unittest.main()
