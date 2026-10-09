"""Summary router — get summary, regenerate, edit summary items (docs/03-LLD §2.2)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ActionItem, Meeting, Participant, Summary, SummaryItem, SummarySection, TranscriptSegment
from app.schemas import SummaryItemOut, SummaryItemUpdate, SummaryOut

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
def regenerate_summary(meeting_id: int, body: dict | None = None, db: Session = Depends(get_db)):
    """Regenerate the summary using the rule-based engine (LLM in Phase 6)."""
    from app.services.summary_engine import generate_summary

    m = db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    template = (body or {}).get("template", "general")

    # delete old summary
    old = db.scalar(select(Summary).where(Summary.meeting_id == meeting_id))
    if old:
        db.delete(old)
        db.flush()

    # generate new using the rule engine
    segments = db.scalars(
        select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id).order_by(TranscriptSegment.start_ms)
    ).all()
    if not segments:
        raise HTTPException(status_code=400, detail="No transcript to summarize")

    seg_dicts = [{"id": s.id, "speaker_id": s.speaker_id, "start_ms": s.start_ms,
                  "end_ms": s.end_ms, "text": s.text} for s in segments]
    generated = generate_summary(seg_dicts, template)

    summary = Summary(meeting_id=meeting_id, template=generated["template"], generated_by="rules")
    db.add(summary)
    db.flush()

    order = 0
    for sec in generated["sections"]:
        section = SummarySection(summary_id=summary.id, section_type=sec["section_type"],
                                 heading=sec["heading"], order_index=order)
        db.add(section)
        db.flush()
        for i, item in enumerate(sec["items"]):
            db.add(SummaryItem(section_id=section.id, text=item["text"],
                               timestamp_ms=item.get("timestamp_ms"),
                               source_segment_id=item.get("source_segment_id"),
                               order_index=i))
        order += 1

    # Tasks are generated at import and managed independently afterward.
    # Reprocessing notes must not duplicate tasks or overwrite user edits/status.

    db.commit()
    return _summary_out(meeting_id, db)


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
