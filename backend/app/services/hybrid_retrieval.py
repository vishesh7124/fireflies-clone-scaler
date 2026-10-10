"""Scoped SQL/lexical/vector retrieval, fusion, bounded reranking and windows.

Exact task/count queries belong to the Phase 4 planner, not top-K retrieval.
sqlite-vec scalar cosine search scans only scoped vectors: a flat exact search,
not an ANN index. This is deliberately appropriate for the demo's small corpus.
"""

import json
import re
import struct
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError

from app.database import SessionLocal
from app.models import Meeting, Participant, RetrievalChunk, RetrievalState, TranscriptSegment
from app.services.retrieval_inference import InferenceUnavailable, validate_scores, validate_vectors
from app.services.summary_engine import STOPWORDS
from app.time_utils import utc_iso


@dataclass(frozen=True)
class SearchScope:
    meeting_ids: tuple[int, ...] | None = None  # None = workspace; () = no meetings
    date_from: date | None = None
    date_to: date | None = None
    participant_names: tuple[str, ...] = ()


def fuse_rankings(*rankings):
    scores = {}
    for ranking in rankings:
        for rank, chunk_id in enumerate(dict.fromkeys(ranking), 1):
            scores[chunk_id] = scores.get(chunk_id, 0) + 1 / (60 + rank)
    return sorted(scores, key=lambda cid: (-scores[cid], cid)), scores


class Retriever:
    def __init__(self, config, provider, session_factory=SessionLocal):
        self.config, self.provider, self.sessions = config, provider, session_factory

    def _meeting_ids(self, db, scope):
        stmt = select(Meeting.id).where(Meeting.is_deleted == False, Meeting.status == "ready")
        if scope.meeting_ids is not None:
            stmt = stmt.where(Meeting.id.in_(scope.meeting_ids))
        if scope.date_from:
            stmt = stmt.where(Meeting.meeting_date >= datetime.combine(scope.date_from, datetime.min.time()))
        if scope.date_to:
            stmt = stmt.where(Meeting.meeting_date < datetime.combine(scope.date_to + timedelta(days=1), datetime.min.time()))
        if scope.participant_names:
            stmt = stmt.where(Meeting.id.in_(select(Participant.meeting_id).where(Participant.name.in_(scope.participant_names))))
        return list(db.scalars(stmt))

    def _candidates(self, db, mids, scope):
        rows = db.scalars(select(RetrievalChunk).join(RetrievalState,
            RetrievalChunk.meeting_id == RetrievalState.meeting_id).where(
            RetrievalChunk.meeting_id.in_(mids), RetrievalChunk.revision == RetrievalState.revision,
            RetrievalState.indexed_revision == RetrievalState.revision)).all()
        # Speaker constraint applies to discovery. Neighboring replies are expanded later.
        if scope.participant_names:
            source_ids = set(db.scalars(select(TranscriptSegment.id).join(Participant,
                TranscriptSegment.speaker_id == Participant.id).where(
                TranscriptSegment.meeting_id.in_(mids), Participant.name.in_(scope.participant_names))))
            rows = [row for row in rows if any(sid in source_ids for sid in json.loads(row.segment_ids))]
        return {row.id: {"chunk_id": row.id, "meeting_id": row.meeting_id, "revision": row.revision,
                         "kind": row.kind, "text": row.text, "segment_ids": json.loads(row.segment_ids),
                         "start_ms": row.start_ms, "end_ms": row.end_ms} for row in rows}

    def retrieve(self, query, scope=SearchScope(), *, search_terms=(), limit=6, per_meeting_limit=None, cancel_event=None):
        if not isinstance(query, str) or not query.strip() or len(query) > 4000:
            return {"hits": [], "mode": "empty"}
        if scope.date_from and scope.date_to and scope.date_from > scope.date_to:
            raise ValueError("Invalid retrieval date range")
        limit = max(1, min(limit, 20))
        words = [word for word in dict.fromkeys(re.findall(r"[\w]+", " ".join([query, *search_terms]), flags=re.UNICODE))
                 if word.casefold() not in STOPWORDS][:24]
        lexical = []
        semantic = []
        vector = None
        if self.provider.enabled and not (cancel_event and cancel_event.is_set()):
            try:
                vector = validate_vectors(self.provider.embed([query]), 1, self.config.rag_embedding_dimensions)[0]
            except InferenceUnavailable:
                pass
        with self.sessions() as db:
            db.execute(text("BEGIN"))
            mids = self._meeting_ids(db, scope)
            candidates = self._candidates(db, mids, scope)
            if not candidates:
                return {"hits": [], "mode": "index_pending" if mids else "empty"}
            placeholders = ",".join(f":id{i}" for i in range(len(candidates)))
            params = {f"id{i}": cid for i, cid in enumerate(candidates)}
            if words:
                # Quote every token. User input never becomes executable FTS syntax.
                expression = " OR ".join('"' + word.replace('"', '""') + '"' for word in words)
                try:
                    rows = db.execute(text(f"""SELECT rowid FROM retrieval_fts
                        WHERE retrieval_fts MATCH :query AND rowid IN({placeholders})
                        ORDER BY bm25(retrieval_fts),rowid LIMIT :n"""),
                        {**params, "query": expression, "n": self.config.rag_candidates}).all()
                    lexical = [row[0] for row in rows]
                except OperationalError:
                    lowered = [word.casefold() for word in words]
                    lexical = sorted(candidates, key=lambda cid: (-sum(word in candidates[cid]["text"].casefold() for word in lowered), cid))
                    lexical = [cid for cid in lexical if any(word in candidates[cid]["text"].casefold() for word in lowered)][:self.config.rag_candidates]
            if vector is not None:
                try:
                    rows = db.execute(text(f"""SELECT chunk_id,vec_distance_cosine(vector,:vector) AS distance
                        FROM retrieval_embeddings WHERE chunk_id IN({placeholders})
                        AND model=:model AND dimensions=:dims
                        ORDER BY distance,chunk_id LIMIT :n"""), {**params,
                        "vector": struct.pack(f"<{len(vector)}f", *vector), "model": self.provider.identity,
                        "dims": self.config.rag_embedding_dimensions, "n": self.config.rag_candidates}).all()
                    semantic = [cid for cid, distance in rows if distance <= 1 - self.config.rag_min_similarity]
                except OperationalError:
                    pass  # native extension unavailable: keyword retrieval still works
        ordered, fused = fuse_rankings(lexical, semantic)
        reranked = False
        rerank_count = min(self.config.rag_rerank_candidates, len(ordered))
        if self.provider.enabled and rerank_count and not (cancel_event and cancel_event.is_set()):
            try:
                top = ordered[:rerank_count]
                scores = validate_scores(self.provider.rerank(query, [candidates[cid]["text"] for cid in top]), len(top))
                top = [cid for _, cid in sorted(zip(scores, top), key=lambda pair: (-pair[0], -fused[pair[1]], pair[1]))]
                ordered = top + ordered[rerank_count:]
                reranked = True
            except InferenceUnavailable:
                pass
        # Repeat source-version/scope checks after remote/local inference; edits
        # and deletions during reranking must not leak stale evidence.
        with self.sessions() as db:
            db.execute(text("BEGIN"))
            current_mids = set(self._meeting_ids(db, scope))
            current = self._candidates(db, list(current_mids), scope)
        hits = []
        meeting_counts = {}
        seen_sources = set()
        for cid in ordered:
            candidate = candidates[cid]
            if cid not in current or current[cid] != candidate:
                continue
            key = (candidate["meeting_id"], tuple(candidate["segment_ids"]), candidate["text"])
            if key in seen_sources:
                continue
            if per_meeting_limit is not None and meeting_counts.get(candidate["meeting_id"], 0) >= per_meeting_limit:
                continue
            seen_sources.add(key)
            hits.append({**candidate, "fusion_score": fused[cid]})
            meeting_counts[candidate["meeting_id"]] = meeting_counts.get(candidate["meeting_id"], 0) + 1
            if len(hits) == limit:
                break
        return {"hits": hits, "mode": "hybrid" if semantic else "lexical", "reranked": reranked}

    def expand(self, hits, scope=SearchScope(), *, neighbors=2, max_chars=24000):
        """Source-ordered windows; a discovery speaker filter does not remove replies."""
        output, seen, used = [], set(), 0
        with self.sessions() as db:
            db.execute(text("BEGIN"))
            mids = set(self._meeting_ids(db, scope))
            for hit in hits:
                mid = hit["meeting_id"]
                state = db.get(RetrievalState, mid)
                if mid not in mids or not state or state.revision != hit["revision"]:
                    continue
                meeting = db.get(Meeting, mid)
                people = {p.id: p.name for p in db.scalars(select(Participant).where(Participant.meeting_id == mid))}
                segments = list(db.scalars(select(TranscriptSegment).where(TranscriptSegment.meeting_id == mid).order_by(TranscriptSegment.start_ms)))
                anchors = {sid for sid in hit["segment_ids"]}
                positions = [i for i, segment in enumerate(segments) if segment.id in anchors]
                indexes = sorted({j for i in positions for j in range(max(0, i - neighbors), min(len(segments), i + neighbors + 1))})
                for i in indexes:
                    segment = segments[i]
                    if segment.id in seen or used + len(segment.text) > max_chars:
                        continue
                    seen.add(segment.id)
                    used += len(segment.text)
                    output.append({"id": segment.id, "meeting_id": mid, "meeting_title": meeting.title,
                        "meeting_date": utc_iso(meeting.meeting_date), "speaker_name": people.get(segment.speaker_id, "Unknown"),
                        "start_ms": segment.start_ms, "end_ms": segment.end_ms, "text": segment.text})
        return sorted(output, key=lambda row: (row["meeting_id"], row["start_ms"], row["id"]))
