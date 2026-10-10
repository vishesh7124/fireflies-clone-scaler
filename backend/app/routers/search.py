"""Search + AskFred chat + export endpoints (docs/03-LLD §2.3)."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ActionItem, Meeting, Participant, Summary, SummaryItem, SummarySection, TranscriptSegment
from app.schemas import ChatRequest, ChatResponseOut, ExportResult, SearchResultOut
from app.services.export_service import export_meeting
from app.services.search_service import search
from app.services.meeting_ai import chat_meeting as ask_meeting
from app.services.global_ai import chat_global as ask_workspace
from app.time_utils import utc_iso

router = APIRouter(tags=["search-chat-export"])


# ---------- search ----------

@router.get("/search", response_model=SearchResultOut)
def search_endpoint(q: str, db: Session = Depends(get_db)):
    return search(q, db)


# ---------- AskFred chat ----------

@router.post("/meetings/{meeting_id}/chat", response_model=ChatResponseOut)
async def chat_meeting(meeting_id: int, req: ChatRequest, request: Request):
    return await ask_meeting(meeting_id, req.question, request.app.state.llm_client)


@router.post("/chat", response_model=ChatResponseOut)
async def chat_global(req: ChatRequest, request: Request):
    return await ask_workspace(req.question, request.app.state.llm_client, request.app.state.retriever)


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
        {"title": m.title, "meeting_date": utc_iso(m.meeting_date), "duration_seconds": m.duration_seconds},
        [{"id": p.id, "name": p.name} for p in participants],
        summary_dict,
        [{"description": a.description, "assignee_id": a.assignee_id, "status": a.status} for a in actions],
        [{"speaker_id": s.speaker_id, "start_ms": s.start_ms, "end_ms": s.end_ms, "text": s.text} for s in segments],
        format,
    )
