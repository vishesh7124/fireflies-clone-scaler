"""Action items router — CRUD + tasks list (docs/03-LLD §2.2)."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ActionItem, Meeting, Participant, TranscriptSegment
from app.schemas import ActionItemCreate, ActionItemOut, ActionItemUpdate

router = APIRouter(tags=["action-items"])


def _item_out(a: ActionItem, db: Session) -> ActionItemOut:
    meeting = db.get(Meeting, a.meeting_id)
    assignee = db.get(Participant, a.assignee_id) if a.assignee_id else None
    seg = db.get(TranscriptSegment, a.source_segment_id) if a.source_segment_id else None
    return {
        "id": a.id, "meeting_id": a.meeting_id,
        "meeting_title": meeting.title if meeting else "",
        "description": a.description, "assignee_id": a.assignee_id,
        "assignee_name": assignee.name if assignee else None,
        "status": a.status, "due_date": a.due_date.isoformat() if a.due_date else None,
        "source_segment_id": a.source_segment_id,
        "source_start_ms": seg.start_ms if seg else None,
        "completed_at": a.completed_at.isoformat() if a.completed_at else None,
        "created_at": a.created_at.isoformat(), "updated_at": a.updated_at.isoformat(),
    }


@router.get("/tasks")
def list_tasks(
    meeting_id: int | None = None,
    status: str | None = None,
    assignee: str | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(ActionItem)
    if meeting_id:
        stmt = stmt.where(ActionItem.meeting_id == meeting_id)
    items = db.scalars(stmt.order_by(ActionItem.created_at.desc())).all()
    if status:
        items = [a for a in items if a.status == status]
    if assignee:
        al = assignee.lower()
        items = [a for a in items if (db.get(Participant, a.assignee_id).name.lower() if a.assignee_id and db.get(Participant, a.assignee_id) else "") .find(al) >= 0]
    return [_item_out(a, db) for a in items]


@router.post("/meetings/{meeting_id}/action-items")
def create_action_item(meeting_id: int, data: ActionItemCreate, db: Session = Depends(get_db)):
    m = db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    a = ActionItem(
        meeting_id=meeting_id, description=data.description.strip(),
        assignee_id=data.assignee_id, status="open",
        due_date=datetime.fromisoformat(data.due_date) if data.due_date else None,
        source_segment_id=data.source_segment_id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return _item_out(a, db)


@router.patch("/action-items/{item_id}")
def update_action_item(item_id: int, patch: ActionItemUpdate, db: Session = Depends(get_db)):
    a = db.get(ActionItem, item_id)
    if not a:
        raise HTTPException(status_code=404, detail="Action item not found")
    if patch.description is not None:
        a.description = patch.description.strip()
    if patch.assignee_id is not None:
        a.assignee_id = patch.assignee_id
    if patch.due_date is not None:
        a.due_date = datetime.fromisoformat(patch.due_date) if patch.due_date else None
    if patch.status is not None and patch.status != a.status:
        a.status = patch.status
        a.completed_at = datetime.utcnow() if patch.status == "done" else None
    db.commit()
    db.refresh(a)
    return _item_out(a, db)


@router.delete("/action-items/{item_id}", status_code=204)
def delete_action_item(item_id: int, db: Session = Depends(get_db)):
    a = db.get(ActionItem, item_id)
    if not a:
        raise HTTPException(status_code=404, detail="Action item not found")
    db.delete(a)
    db.commit()
