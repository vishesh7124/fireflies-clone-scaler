"""Summary router — get summary, regenerate, edit summary items (docs/03-LLD §2.2)."""

from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Summary, SummaryItem, SummarySection
from app.schemas import SummaryItemUpdate, SummaryOut
from app.services.meeting_ai import regenerate_meeting

router = APIRouter(tags=["summaries"])


def _summary_out(meeting_id: int, db: Session) -> SummaryOut:
    summary = db.scalar(select(Summary).where(Summary.meeting_id == meeting_id))
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    sections = db.scalars(
        select(SummarySection).where(SummarySection.summary_id == summary.id).order_by(SummarySection.order_index)
    ).all()
    out_sections = []
    for sec in sections:
        items = db.scalars(
            select(SummaryItem).where(SummaryItem.section_id == sec.id).order_by(SummaryItem.order_index)
        ).all()
        out_sections.append({
            "id": sec.id, "section_type": sec.section_type, "heading": sec.heading,
            "items": [{"id": i.id, "text": i.text, "timestamp_ms": i.timestamp_ms,
                       "end_timestamp_ms": i.end_timestamp_ms, "source_segment_id": i.source_segment_id}
                      for i in items],
        })
    return {"meeting_id": meeting_id, "template": summary.template, "generated_by": summary.generated_by, "sections": out_sections}


@router.get("/meetings/{meeting_id}/summary", response_model=SummaryOut)
def get_summary(meeting_id: int, db: Session = Depends(get_db)):
    return _summary_out(meeting_id, db)


@router.post("/meetings/{meeting_id}/regenerate", response_model=SummaryOut)
async def regenerate_summary(meeting_id: int, request: Request, body: dict | None = None, db: Session = Depends(get_db)):
    """Validate complete output before replacing notes; tasks remain independent."""
    await regenerate_meeting(meeting_id, (body or {}).get("template") or "general", request.app.state.llm_client)
    return await run_in_threadpool(_summary_out, meeting_id, db)


@router.patch("/summary-items/{item_id}")
def update_summary_item(item_id: int, patch: SummaryItemUpdate, db: Session = Depends(get_db)):
    item = db.get(SummaryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Summary item not found")
    item.text = patch.text.strip()
    db.commit()
    db.refresh(item)
    return {"id": item.id, "text": item.text, "timestamp_ms": item.timestamp_ms,
            "end_timestamp_ms": item.end_timestamp_ms, "source_segment_id": item.source_segment_id}
