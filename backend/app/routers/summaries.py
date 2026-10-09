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
    m = db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    template = (body or {}).get("template", "general")

    # delete old summary
    old = db.scalar(select(Summary).where(Summary.meeting_id == meeting_id))
    if old:
        db.delete(old)
        db.flush()

    # generate new (simple rule-based: overview + notes from top segments)
    segments = db.scalars(
        select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id).order_by(TranscriptSegment.start_ms)
    ).all()
    participants = db.scalars(select(Participant).where(Participant.meeting_id == meeting_id)).all()
    if not segments:
        raise HTTPException(status_code=400, detail="No transcript to summarize")

    summary = Summary(meeting_id=meeting_id, template=template, generated_by="rules")
    db.add(summary)
    db.flush()

    # overview
    sec = SummarySection(summary_id=summary.id, section_type="overview", heading="Overview", order_index=0)
    db.add(sec)
    db.flush()
    kw = {}
    STOP = set("a an the and or but of to for with on in at by from is are was were be been this that these those we you they it our your their will would can could should shall do does did have has had not no yes so if then about into over under more most some such only own same too very just".split())
    for s in segments:
        for w in s.text.lower().replace(".", " ").replace(",", " ").split():
            if len(w) > 3 and w not in STOP:
                kw[w] = kw.get(w, 0) + 1
    top_kw = sorted(kw, key=kw.get, reverse=True)[:4]
    duration_min = round((segments[-1].end_ms or 0) / 60000) or 1
    overview = f"The {duration_min}-minute meeting covered {', '.join(top_kw)}. " + segments[0].text[:150]
    db.add(SummaryItem(section_id=sec.id, text=overview, timestamp_ms=segments[0].start_ms, source_segment_id=segments[0].id, order_index=0))

    # notes (top segments by keyword density)
    sec = SummarySection(summary_id=summary.id, section_type="notes", heading="Notes", order_index=1)
    db.add(sec)
    db.flush()
    scored = []
    for s in segments:
        words = s.text.lower().split()
        score = sum(kw.get(w.strip(".,!?"), 0) for w in words)
        scored.append((score, s))
    scored.sort(key=lambda x: -x[0])
    for i, (_, s) in enumerate(scored[:6]):
        db.add(SummaryItem(section_id=sec.id, text=s.text, timestamp_ms=s.start_ms, source_segment_id=s.id, order_index=i))

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
