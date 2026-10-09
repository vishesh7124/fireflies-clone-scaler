"""Tag vocabulary and meeting tag assignment."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Meeting, MeetingTag, Tag
from app.schemas import TagOut

router = APIRouter(tags=["tags"])


class TagAssignment(BaseModel):
    tags: list[str] = Field(max_length=30)


@router.get("/tags", response_model=list[TagOut])
def list_tags(db: Session = Depends(get_db)):
    return db.scalars(select(Tag).order_by(Tag.name)).all()


@router.post("/meetings/{meeting_id}/tags", response_model=list[TagOut])
def set_tags(meeting_id: int, body: TagAssignment, db: Session = Depends(get_db)):
    meeting = db.get(Meeting, meeting_id)
    if not meeting or meeting.is_deleted:
        raise HTTPException(status_code=404, detail="Meeting not found")
    names = list(dict.fromkeys(name.strip().lower() for name in body.tags))
    if any(not name or len(name) > 120 for name in names):
        raise HTTPException(status_code=422, detail="Tags must contain 1–120 characters")
    db.query(MeetingTag).filter(MeetingTag.meeting_id == meeting_id).delete()
    assigned = []
    for name in names:
        tag = db.scalar(select(Tag).where(func.lower(Tag.name) == name))
        if tag is None:
            tag = Tag(name=name, color="#7c5cff")
            db.add(tag)
            db.flush()
        db.add(MeetingTag(meeting_id=meeting_id, tag_id=tag.id))
        assigned.append(tag)
    db.commit()
    return assigned
