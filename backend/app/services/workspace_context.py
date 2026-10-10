"""Read-only, predefined SQL scope queries and bounded context assembly."""

import hashlib
import json

from sqlalchemy import func, or_, select, text

from app.database import SessionLocal
from app.models import (ActionItem, Meeting, Participant, RetrievalState,
                        Summary, SummaryItem, SummarySection, TranscriptSegment)
from app.services.hybrid_retrieval import SearchScope
from app.services.query_planning import date_bounds, latest_meeting_id
from app.services.summary_engine import STOPWORDS
from app.time_utils import utc_iso


def meeting_query(plan, config):
    stmt = select(Meeting).where(Meeting.is_deleted == False)
    if plan.meeting_ids:
        stmt = stmt.where(Meeting.id.in_(plan.meeting_ids))
    if plan.meeting_status != "all":
        stmt = stmt.where(Meeting.status == plan.meeting_status)
    if plan.participant_names and plan.participant_role in {"attendee", "speaker"}:
        stmt = stmt.where(Meeting.id.in_(select(Participant.meeting_id).where(Participant.name.in_(plan.participant_names))))
    if plan.date_field == "meeting_date":
        start, end = date_bounds(plan, config)
        if start:
            stmt = stmt.where(Meeting.meeting_date >= start)
        if end:
            stmt = stmt.where(Meeting.meeting_date < end)
    return stmt.order_by(Meeting.id)


def task_query(plan, config):
    mids = meeting_query(plan, config).with_only_columns(Meeting.id).order_by(None)
    stmt = select(ActionItem).where(ActionItem.meeting_id.in_(mids))
    if plan.task_status == "not_done":
        stmt = stmt.where(ActionItem.status != "done")
    elif plan.task_status:
        stmt = stmt.where(ActionItem.status == plan.task_status)
    if plan.participant_names and plan.participant_role == "assignee":
        stmt = stmt.where(ActionItem.assignee_id.in_(select(Participant.id).where(Participant.name.in_(plan.participant_names))))
    if plan.participant_names and plan.participant_role == "speaker":
        stmt = stmt.where(ActionItem.source_segment_id.in_(select(TranscriptSegment.id).join(Participant,
            TranscriptSegment.speaker_id == Participant.id).where(Participant.name.in_(plan.participant_names))))
    if plan.date_field != "meeting_date":
        column = {"due_date": ActionItem.due_date, "created_at": ActionItem.created_at,
                  "completed_at": ActionItem.completed_at}[plan.date_field]
        start, end = date_bounds(plan, config)
        if start:
            stmt = stmt.where(column >= start)
        if end:
            stmt = stmt.where(column < end)
    if plan.search_terms:
        stmt = stmt.where(or_(*(ActionItem.description.ilike("%" + term.replace("%", "\\%").replace("_", "\\_") + "%", escape="\\") for term in plan.search_terms)))
    return stmt.order_by(ActionItem.id)


def _segment_rows(db, mids):
    rows = db.execute(select(TranscriptSegment, Participant.name, Meeting.title, Meeting.meeting_date)
        .join(Meeting, TranscriptSegment.meeting_id == Meeting.id)
        .outerjoin(Participant, TranscriptSegment.speaker_id == Participant.id)
        .where(TranscriptSegment.meeting_id.in_(mids)).order_by(TranscriptSegment.meeting_id, TranscriptSegment.start_ms)).all()
    return [{"id": s.id, "meeting_id": s.meeting_id, "meeting_title": title, "meeting_date": utc_iso(when),
             "speaker_name": name or "Unknown", "start_ms": s.start_ms, "end_ms": s.end_ms, "text": s.text} for s, name, title, when in rows]


def scope_stamp(db, plan, config, question=""):
    meetings = list(db.scalars(meeting_query(plan, config)))
    states = dict(db.execute(select(RetrievalState.meeting_id, RetrievalState.revision)
                            .where(RetrievalState.meeting_id.in_([m.id for m in meetings]))).all())
    payload = {"meetings": [(m.id, m.title, m.meeting_date.isoformat(), m.status, states.get(m.id)) for m in meetings]}
    import re
    if re.search(r"\b(last|latest|most recent) meeting\b", question, re.I):
        payload["latest_selector"] = latest_meeting_id(plan, config, db)
    if plan.intent == "tasks" or (plan.intent == "count" and plan.count_target == "tasks"):
        tasks = list(db.scalars(task_query(plan, config)))
    else:
        tasks = list(db.scalars(select(ActionItem).where(ActionItem.meeting_id.in_([m.id for m in meetings])).order_by(ActionItem.id)))
    if tasks:
        payload["tasks"] = [(a.id, a.meeting_id, a.description, a.assignee_id, a.status,
                             a.due_date.isoformat() if a.due_date else None,
                             a.completed_at.isoformat() if a.completed_at else None,
                             a.source_segment_id, a.updated_at.isoformat()) for a in tasks]
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def citation(row):
    return {"meeting_id": row["meeting_id"], "meeting_title": row["meeting_title"],
            "segment_id": row["id"], "start_ms": row["start_ms"], "speaker": row["speaker_name"], "quote": row["text"][:240]}


def structured_answer(plan, config, question=""):
    with SessionLocal() as db:
        db.execute(text("BEGIN"))
        stamp = scope_stamp(db, plan, config, question)
        tasks = plan.intent == "tasks" or plan.count_target == "tasks"
        query = task_query(plan, config) if tasks else meeting_query(plan, config)
        count = db.scalar(select(func.count()).select_from(query.order_by(None).subquery())) or 0
        suffix = f" ({plan.date_field.replace('_', ' ')}: {plan.date_from or 'any start'} to {plan.date_to or 'any end'})" if plan.date_from or plan.date_to else ""
        label = "tasks" if tasks else "meetings"
        answer = f"{count} matching {label}{suffix}."
        if plan.participant_names:
            answer += f" {plan.participant_role.title()}: {', '.join(plan.participant_names)}."
        if tasks and plan.task_status:
            answer += f" Status: {plan.task_status.replace('_', ' ')}."
        citations = []
        if plan.intent == "tasks":
            records = list(db.scalars(query.limit(config.global_task_limit)))
            if count > len(records):
                answer += f" Showing the first {len(records)}; the count covers all matching records."
            source_ids = [a.source_segment_id for a in records if a.source_segment_id is not None]
            mids = [a.meeting_id for a in records]
            sources = {row["id"]: row for row in _segment_rows(db, mids) if row["id"] in source_ids}
            for task in records:
                owner = db.get(Participant, task.assignee_id) if task.assignee_id else None
                due = f" · due {task.due_date.date().isoformat()}" if task.due_date else ""
                answer += f"\n• {task.description} — {owner.name if owner else 'Unassigned'} · {task.status}{due}"
                source = sources.get(task.source_segment_id)
                if source and source["meeting_id"] == task.meeting_id and len(citations) < 30 and not any(c["segment_id"] == source["id"] for c in citations):
                    citations.append(citation(source))
        return {"answer": answer, "citations": citations}, stamp


def _raw_windows(db, mids, query, terms, limit):
    """Current SQL/keyword fallback while indexes are pending/unavailable."""
    import re
    words = [word.casefold() for word in dict.fromkeys(re.findall(r"\w+", " ".join([query, *terms])))
             if word.casefold() not in STOPWORDS][:24]
    rows = _segment_rows(db, mids)
    ranked = sorted(((sum(word in row["text"].casefold() for word in words), i) for i, row in enumerate(rows)), reverse=True)
    anchors = [i for score, i in ranked if score][:limit]
    return [row for i, row in enumerate(rows) if any(abs(i - anchor) <= 2 and row["meeting_id"] == rows[anchor]["meeting_id"] for anchor in anchors)]


def discussion_context(question, plan, config, retriever, use_index=True, cancel_event=None):
    # Capture a revision stamp BEFORE retrieval. Any intervening source changes
    # cause a safe retry response at persistence rather than mixed-version evidence.
    with SessionLocal() as db:
        db.execute(text("BEGIN"))
        meetings = list(db.scalars(meeting_query(plan, config)))
        initial_stamp = scope_stamp(db, plan, config, question)
        mids = [meeting.id for meeting in meetings]
    scope = SearchScope(meeting_ids=tuple(mids), participant_names=tuple(plan.participant_names) if plan.participant_role == "speaker" else ())
    retrieval = retriever.retrieve(question, scope, search_terms=plan.search_terms,
                                  limit=config.global_meeting_limit * 2, per_meeting_limit=2,
                                  cancel_event=cancel_event) if use_index and mids else {"hits": [], "mode": "lexical"}
    windows = retriever.expand(retrieval["hits"], scope, max_chars=config.global_context_chars) if retrieval["hits"] else []
    with SessionLocal() as db:
        db.execute(text("BEGIN"))
        if scope_stamp(db, plan, config, question) != initial_stamp:
            return {"segments": [], "meetings": [], "tasks": [], "coverage": "Workspace changed; retry.", "stamp": initial_stamp}
        selected = list(dict.fromkeys(hit["meeting_id"] for hit in retrieval["hits"]))[:config.global_meeting_limit]
        states = {mid: (indexed, revision) for mid, indexed, revision in db.execute(select(
            RetrievalState.meeting_id, RetrievalState.indexed_revision, RetrievalState.revision)
            .where(RetrievalState.meeting_id.in_(mids))).all()}
        pending = [mid for mid in mids if mid not in states or states[mid][0] != states[mid][1]]
        if pending:
            current_windows = _raw_windows(db, pending, question, plan.search_terms, config.global_meeting_limit * 2)
            known = {row["id"] for row in windows}
            windows += [row for row in current_windows if row["id"] not in known]
            selected = list(dict.fromkeys([*selected, *(row["meeting_id"] for row in current_windows)]))[:config.global_meeting_limit]
        if not windows:
            windows = _raw_windows(db, mids, question, plan.search_terms, config.global_meeting_limit * 2)
            selected = list(dict.fromkeys(row["meeting_id"] for row in windows))[:config.global_meeting_limit]
        if plan.scope == "meeting" or plan.intent == "summary":
            selected = selected or mids[:config.global_meeting_limit]
        selected_set = set(selected)
        windows = [row for row in windows if row["meeting_id"] in selected_set]
        full = _segment_rows(db, selected)
        # Small selected meetings get complete context; large ones retain windows.
        if len(json.dumps(full, ensure_ascii=False)) <= config.global_context_chars:
            windows = full
        used, bounded = 0, []
        for row in windows:
            size = len(json.dumps(row, ensure_ascii=False))
            if used + size > config.global_context_chars:
                continue
            bounded.append(row)
            used += size
        metadata = []
        for mid in selected:
            meeting = db.get(Meeting, mid)
            participants = list(db.scalars(select(Participant.name).where(Participant.meeting_id == mid)))
            items = list(db.scalars(select(SummaryItem.text).join(SummarySection).join(Summary)
                         .where(Summary.meeting_id == mid).order_by(SummaryItem.id).limit(8)))
            metadata.append({"id": mid, "title": meeting.title, "date": utc_iso(meeting.meeting_date),
                             "participants": participants, "summary": [item[:400] for item in items]})
        tasks = [{"description": a.description[:1000], "status": a.status, "meeting_id": a.meeting_id,
                  "source_segment_id": a.source_segment_id} for a in db.scalars(select(ActionItem)
                  .where(ActionItem.meeting_id.in_(selected)).order_by(ActionItem.id).limit(30))]
        complete = len(selected) == len(mids) and len(bounded) == len(full)
        coverage = f"Evidence covers {len(selected)} of {len(mids)} matching meetings; " + ("full selected transcripts." if complete else "selected passages, not an exhaustive workspace review.")
        return {"segments": bounded, "meetings": metadata, "tasks": tasks, "coverage": coverage,
                "partial": not complete, "mode": retrieval["mode"], "stamp": initial_stamp}
