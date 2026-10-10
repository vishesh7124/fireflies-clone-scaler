"""Action items router — CRUD + tasks list (docs/03-LLD §2.2)."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ActionItem, Meeting, Participant, TaskSuggestion, TranscriptSegment
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
    if not data.description.strip():
        raise HTTPException(status_code=422, detail="Task cannot be blank")
    if data.assignee_id is not None:
        participant = db.get(Participant, data.assignee_id)
        if not participant or participant.meeting_id != meeting_id:
            raise HTTPException(status_code=422, detail="Assignee must belong to this meeting")
    if data.source_segment_id is not None:
        segment = db.get(TranscriptSegment, data.source_segment_id)
        if not segment or segment.meeting_id != meeting_id:
            raise HTTPException(status_code=422, detail="Source must belong to this meeting")
    try:
        due_date = datetime.fromisoformat(data.due_date) if data.due_date else None
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid due date")
    a = ActionItem(
        meeting_id=meeting_id, description=data.description.strip(),
        assignee_id=data.assignee_id, status="open",
        due_date=due_date,
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
    if "assignee_id" in patch.model_fields_set:
        if patch.assignee_id is not None:
            participant = db.get(Participant, patch.assignee_id)
            if not participant or participant.meeting_id != a.meeting_id:
                raise HTTPException(status_code=422, detail="Assignee must belong to this meeting")
        a.assignee_id = patch.assignee_id
    if "due_date" in patch.model_fields_set:
        try:
            a.due_date = datetime.fromisoformat(patch.due_date) if patch.due_date else None
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid due date")
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


@router.get("/meetings/{meeting_id}/action-suggestions")
def list_suggestions(meeting_id: int, db: Session = Depends(get_db)):
    if not db.get(Meeting, meeting_id):
        raise HTTPException(404, "Meeting not found")
    suggestions = db.scalars(select(TaskSuggestion).where(TaskSuggestion.meeting_id == meeting_id)
                              .order_by(TaskSuggestion.id)).all()
    return [{"id": s.id, "meeting_id": s.meeting_id, "description": s.description,
             "source_segment_id": s.source_segment_id, "assignee_id": s.assignee_id,
             "due_date": s.due_date.isoformat() if s.due_date else None,
             "status": s.status, "action_item_id": s.action_item_id} for s in suggestions]


@router.post("/meetings/{meeting_id}/action-suggestions/{suggestion_id}/accept")
def accept_suggestion(meeting_id: int, suggestion_id: int, db: Session = Depends(get_db)):
    import hashlib
    db.execute(text("BEGIN IMMEDIATE"))
    suggestion = db.get(TaskSuggestion, suggestion_id)
    if not suggestion or suggestion.meeting_id != meeting_id:
        raise HTTPException(404, "Suggestion not found")
    if suggestion.status == "accepted":
        action = db.get(ActionItem, suggestion.action_item_id) if suggestion.action_item_id else None
        if not action:
            raise HTTPException(409, "The accepted task was deleted")
        return _item_out(action, db)
    if suggestion.status != "suggested":
        raise HTTPException(409, "Suggestion is no longer pending")
    source = db.get(TranscriptSegment, suggestion.source_segment_id) if suggestion.source_segment_id else None
    if not source or source.meeting_id != meeting_id or hashlib.sha256(source.text.encode()).hexdigest() != suggestion.source_text_hash:
        raise HTTPException(409, "Source transcript changed. Regenerate suggestions first.")
    if suggestion.assignee_id is not None:
        participant = db.get(Participant, suggestion.assignee_id)
        if not participant or participant.meeting_id != meeting_id:
            raise HTTPException(409, "Suggested assignee no longer exists")
    # Accepting twice must not create two tasks, even after repeated generations.
    action = db.scalar(select(ActionItem).where(ActionItem.meeting_id == meeting_id,
        ActionItem.source_segment_id == source.id, ActionItem.description == suggestion.description))
    if action is None:
        action = ActionItem(meeting_id=meeting_id, description=suggestion.description,
                            source_segment_id=source.id, assignee_id=suggestion.assignee_id,
                            due_date=suggestion.due_date, status="open")
        db.add(action)
        db.flush()
    suggestion.status = "accepted"
    suggestion.action_item_id = action.id
    db.commit()
    return _item_out(action, db)


@router.post("/meetings/{meeting_id}/action-suggestions/{suggestion_id}/dismiss", status_code=204)
def dismiss_suggestion(meeting_id: int, suggestion_id: int, db: Session = Depends(get_db)):
    db.execute(text("BEGIN IMMEDIATE"))
    suggestion = db.get(TaskSuggestion, suggestion_id)
    if not suggestion or suggestion.meeting_id != meeting_id:
        raise HTTPException(404, "Suggestion not found")
    if suggestion.status == "accepted":
        raise HTTPException(409, "Already accepted; manage the existing task instead")
    suggestion.status = "dismissed"
    db.commit()
