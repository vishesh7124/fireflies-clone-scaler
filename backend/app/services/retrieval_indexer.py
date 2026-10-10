"""Revision-aware derived indexes. Inference runs outside SQLite write locks."""

import hashlib
import json
import logging
import struct
import threading
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text

from app.config import Settings
from app.database import SessionLocal
from app.models import (Meeting, Participant, RetrievalChunk, RetrievalEmbedding,
                        RetrievalState, Summary, SummaryItem, SummarySection, TranscriptSegment)
from app.services.retrieval_inference import Inference, InferenceUnavailable, validate_vectors

logger = logging.getLogger(__name__)


def profile(config, provider):
    recipe = {"version": 1, "chars": config.rag_chunk_chars, "overlap": config.rag_overlap_turns,
              "model": provider.identity if provider.enabled else "disabled", "dimensions": config.rag_embedding_dimensions}
    return hashlib.sha256(json.dumps(recipe, sort_keys=True).encode()).hexdigest()


def make_chunks(segments, summary_items, config):
    """Character-bounded units retain source IDs; not an exact tokenizer budget.

    Local encoding rejects over-token-limit input instead of silently truncating.
    Long individual turns split into pieces with the same original source ID.
    """
    sources = {s["id"]: s for s in segments}
    units = []
    cap = config.rag_chunk_chars
    for segment in segments:
        prefix = segment["speaker_name"][:min(120, cap // 4)] + ": "
        size = max(1, cap - len(prefix))
        for start in range(0, len(segment["text"]), size):
            units.append({"text": prefix + segment["text"][start:start + size], "ids": [segment["id"]],
                          "start_ms": segment["start_ms"], "end_ms": segment["end_ms"]})
    chunks = []
    i = 0
    while i < len(units):
        group = [units[i]]
        j = i + 1
        used = len(units[i]["text"])
        while j < len(units) and used + len(units[j]["text"]) + 1 <= cap:
            group.append(units[j])
            used += len(units[j]["text"]) + 1
            j += 1
        chunks.append({"kind": "transcript", "text": "\n".join(u["text"] for u in group),
                       "segment_ids": list(dict.fromkeys(sid for u in group for sid in u["ids"])),
                       "start_ms": group[0]["start_ms"], "end_ms": max(u["end_ms"] for u in group)})
        if j == len(units):
            break
        overlap = min(config.rag_overlap_turns, len(group) - 1)
        i = max(i + 1, j - overlap)
    for item in summary_items:
        source = sources.get(item["source_segment_id"])
        content = item["heading"] + ": " + item["text"]
        for start in range(0, len(content), cap):
            chunks.append({"kind": "summary", "text": content[start:start + cap],
                           "segment_ids": [source["id"]] if source else [],
                           "start_ms": source["start_ms"] if source else None,
                           "end_ms": source["end_ms"] if source else None})
    return chunks


class Indexer:
    def __init__(self, config: Settings, provider: Inference, session_factory=SessionLocal):
        self.config, self.provider, self.sessions = config, provider, session_factory
        self.profile = profile(config, provider)

    def _snapshot(self, mid):
        with self.sessions() as db:
            db.execute(text("BEGIN"))  # consistent read snapshot, closed before encoding
            state = db.get(RetrievalState, mid)
            meeting = db.get(Meeting, mid)
            if not state or not meeting or meeting.is_deleted or meeting.status != "ready":
                return None
            people = {p.id: p.name for p in db.scalars(select(Participant).where(Participant.meeting_id == mid))}
            segments = [{"id": s.id, "text": s.text, "start_ms": s.start_ms, "end_ms": s.end_ms,
                         "speaker_name": people.get(s.speaker_id, "Unknown")} for s in db.scalars(
                select(TranscriptSegment).where(TranscriptSegment.meeting_id == mid).order_by(TranscriptSegment.start_ms))]
            summaries = db.execute(select(SummaryItem, SummarySection.heading).join(
                SummarySection, SummaryItem.section_id == SummarySection.id).join(
                Summary, SummarySection.summary_id == Summary.id).where(Summary.meeting_id == mid)).all()
            items = [{"text": item.text, "source_segment_id": item.source_segment_id, "heading": heading} for item, heading in summaries]
            return state.revision, make_chunks(segments, items, self.config)

    def index_meeting(self, mid):
        snapshot = self._snapshot(mid)
        if snapshot is None:
            return False
        revision, chunks = snapshot
        vectors = None
        reason = None
        if self.provider.enabled and chunks:
            try:
                vectors = []
                deadline = time.monotonic() + self.config.rag_max_index_seconds
                for start in range(0, len(chunks), self.config.rag_batch_size):
                    if time.monotonic() >= deadline:
                        raise InferenceUnavailable("index_budget")
                    batch = chunks[start:start + self.config.rag_batch_size]
                    values = self.provider.embed([chunk["text"] for chunk in batch])
                    vectors.extend(validate_vectors(values, len(batch), self.config.rag_embedding_dimensions))
            except InferenceUnavailable as error:
                reason, vectors = error.reason, None
        with self.sessions() as db:
            db.execute(text("BEGIN IMMEDIATE"))
            state = db.get(RetrievalState, mid)
            meeting = db.get(Meeting, mid)
            if not state or not meeting or meeting.is_deleted or state.revision != revision:
                return False  # never publish evidence built from an older transcript
            db.query(RetrievalChunk).filter(RetrievalChunk.meeting_id == mid).delete()
            for i, chunk in enumerate(chunks):
                row = RetrievalChunk(meeting_id=mid, revision=revision, kind=chunk["kind"], text=chunk["text"],
                    segment_ids=json.dumps(chunk["segment_ids"]), start_ms=chunk["start_ms"], end_ms=chunk["end_ms"])
                db.add(row)
                db.flush()
                if vectors is not None:
                    db.add(RetrievalEmbedding(chunk_id=row.id, model=self.provider.identity,
                        dimensions=self.config.rag_embedding_dimensions,
                        vector=struct.pack(f"<{len(vectors[i])}f", *vectors[i])))
            state.indexed_revision, state.profile = revision, self.profile
            state.vector_model = self.provider.identity if vectors is not None else None
            state.error_reason, state.attempted_at = reason, datetime.now(timezone.utc).replace(tzinfo=None)
            db.commit()
        return True

    def pending(self):
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=self.config.rag_retry_seconds)
        with self.sessions() as db:
            states = db.scalars(select(RetrievalState).join(Meeting).where(
                Meeting.is_deleted == False, Meeting.status == "ready").order_by(RetrievalState.meeting_id)).all()
            return [s.meeting_id for s in states if s.indexed_revision != s.revision or s.profile != self.profile or
                    (self.provider.enabled and s.vector_model != self.provider.identity and
                     (s.attempted_at is None or s.attempted_at < cutoff))][:10]


class IndexWorker:
    """One bounded polling thread; persisted revision state survives restarts."""
    def __init__(self, indexer: Indexer):
        self.indexer = indexer
        self.stop_event = threading.Event()
        self.thread = threading.Thread(target=self._run, name="retrieval-indexer", daemon=True)

    def start(self):
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        self.thread.join()  # app runs this join in a thread, not on the event loop

    def _run(self):
        while not self.stop_event.is_set():
            try:
                mids = self.indexer.pending()
                for mid in mids:
                    if self.stop_event.is_set():
                        return
                    self.indexer.index_meeting(mid)
            except Exception:
                logger.warning("Retrieval indexing failed; retry scheduled")  # no content/secrets
            self.stop_event.wait(self.indexer.config.rag_poll_seconds)
