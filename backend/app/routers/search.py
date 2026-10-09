"""Search + AskFred chat + export endpoints (docs/03-LLD §2.3)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ActionItem, ChatMessage, Meeting, Participant, Summary, SummaryItem, SummarySection, TranscriptSegment
from app.schemas import ChatRequest, ChatResponseOut, ExportResult, SearchResultOut
from app.services.chat_engine import answer_question
from app.services.export_service import export_meeting
from app.services.search_service import search

router = APIRouter(tags=["search-chat-export"])


# ---------- search ----------

@router.get("/search", response_model=SearchResultOut)
def search_endpoint(q: str, db: Session = Depends(get_db)):
    return search(q, db)


# ---------- AskFred chat ----------

def _segments_for(db: Session, meeting_id: int | None) -> list[dict]:
    stmt = (select(TranscriptSegment, Participant.name, Meeting.title)
            .join(Meeting, TranscriptSegment.meeting_id == Meeting.id)
            .outerjoin(Participant, TranscriptSegment.speaker_id == Participant.id)
            .where(Meeting.is_deleted == False)
            .order_by(TranscriptSegment.meeting_id, TranscriptSegment.start_ms))
    if meeting_id:
        stmt = stmt.where(TranscriptSegment.meeting_id == meeting_id)
    rows = db.execute(stmt).all()
    return [{"id": s.id, "meeting_id": s.meeting_id, "speaker_name": name or "Unknown",
             "meeting_title": title, "start_ms": s.start_ms, "end_ms": s.end_ms,
             "text": s.text} for s, name, title in rows]


def _actions_for(db: Session, meeting_id: int | None) -> list[dict]:
    stmt = select(ActionItem, Participant.name).select_from(ActionItem).join(Meeting, ActionItem.meeting_id == Meeting.id).outerjoin(
        Participant, ActionItem.assignee_id == Participant.id).where(Meeting.is_deleted == False)
    if meeting_id is not None:
        stmt = stmt.where(ActionItem.meeting_id == meeting_id)
    return [{"description": a.description, "assignee_name": name, "status": a.status,
             "source_segment_id": a.source_segment_id} for a, name in db.execute(stmt).all()]


@router.post("/meetings/{meeting_id}/chat", response_model=ChatResponseOut)
def chat_meeting(meeting_id: int, req: ChatRequest, db: Session = Depends(get_db)):
    m = db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    segments = _segments_for(db, meeting_id)
    action_dicts = _actions_for(db, meeting_id)
    result = answer_question(req.question, segments, m.title, action_dicts)
    # persist
    db.add(ChatMessage(meeting_id=meeting_id, role="user", content=req.question))
    import json
    db.add(ChatMessage(meeting_id=meeting_id, role="assistant", content=result["answer"],
                        citations=json.dumps(result["citations"]) if result["citations"] else None))
    db.commit()
    return result


@router.post("/chat", response_model=ChatResponseOut)
def chat_global(req: ChatRequest, db: Session = Depends(get_db)):
    segments = _segments_for(db, None)
    result = answer_question(req.question, segments, None, _actions_for(db, None))
    db.add(ChatMessage(meeting_id=None, role="user", content=req.question))
    import json
    db.add(ChatMessage(meeting_id=None, role="assistant", content=result["answer"],
                        citations=json.dumps(result["citations"]) if result["citations"] else None))
    db.commit()
    return result


# ---------- export ----------

@router.get("/meetings/{meeting_id}/export", response_model=ExportResult)
def export_meeting_endpoint(meeting_id: int, format: str = "txt", db: Session = Depends(get_db)):
    m = db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    participants = db.scalars(select(Participant).where(Participant.meeting_id == meeting_id)).all()
    segments = db.scalars(select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id).order_by(TranscriptSegment.start_ms)).all()
    actions = db.scalars(select(ActionItem).where(ActionItem.meeting_id == meeting_id)).all()
    summary = db.scalar(select(Summary).where(Summary.meeting_id == meeting_id))
    summary_dict = None
    if summary:
        sections = db.scalars(select(SummarySection).where(SummarySection.summary_id == summary.id).order_by(SummarySection.order_index)).all()
        summary_dict = {"template": summary.template, "sections": [
            {"section_type": s.section_type, "heading": s.heading,
             "items": [{"text": i.text, "timestamp_ms": i.timestamp_ms}
                       for i in db.scalars(select(SummaryItem).where(SummaryItem.section_id == s.id).order_by(SummaryItem.order_index)).all()]}
            for s in sections]}

    return export_meeting(
        {"title": m.title, "meeting_date": m.meeting_date.isoformat(), "duration_seconds": m.duration_seconds},
        [{"id": p.id, "name": p.name} for p in participants],
        summary_dict,
        [{"description": a.description, "assignee_id": a.assignee_id, "status": a.status} for a in actions],
        [{"speaker_id": s.speaker_id, "start_ms": s.start_ms, "end_ms": s.end_ms, "text": s.text} for s in segments],
        format,
    )
