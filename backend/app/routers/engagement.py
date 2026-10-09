"""Engagement endpoints: comments, bookmarks, soundbites (docs/03-LLD §2.3)."""

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Bookmark, ChatMessage, Comment, Soundbite, User
from app.schemas import (
    BookmarkCreate,
    BookmarkOut,
    CommentCreate,
    CommentOut,
    SoundbiteCreate,
    SoundbiteOut,
)

router = APIRouter(tags=["engagement"])


# ---------- comments ----------

@router.get("/meetings/{meeting_id}/comments")
def list_comments(meeting_id: int, db: Session = Depends(get_db)):
    comments = db.scalars(select(Comment).where(Comment.meeting_id == meeting_id).order_by(Comment.created_at)).all()
    out = []
    for c in comments:
        user = db.get(User, c.user_id) if c.user_id else None
        out.append({"id": c.id, "meeting_id": c.meeting_id, "segment_id": c.segment_id,
                    "user_name": user.name if user else "User", "body": c.body,
                    "created_at": c.created_at.isoformat()})
    return out


@router.post("/meetings/{meeting_id}/comments")
def add_comment(meeting_id: int, data: CommentCreate, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.is_default == True))  # noqa: E712
    c = Comment(meeting_id=meeting_id, segment_id=data.segment_id,
                user_id=user.id if user else None, body=data.body.strip())
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "meeting_id": c.meeting_id, "segment_id": c.segment_id,
            "user_name": user.name if user else "User", "body": c.body, "created_at": c.created_at.isoformat()}


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: int, db: Session = Depends(get_db)):
    c = db.get(Comment, comment_id)
    if not c:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(c)
    db.commit()


# ---------- bookmarks ----------

@router.get("/meetings/{meeting_id}/bookmarks")
def list_bookmarks(meeting_id: int, db: Session = Depends(get_db)):
    bookmarks = db.scalars(select(Bookmark).where(Bookmark.meeting_id == meeting_id).order_by(Bookmark.created_at)).all()
    return [{"id": b.id, "meeting_id": b.meeting_id, "segment_id": b.segment_id,
             "label": b.label, "created_at": b.created_at.isoformat()} for b in bookmarks]


@router.post("/meetings/{meeting_id}/bookmarks")
def add_bookmark(meeting_id: int, data: BookmarkCreate, db: Session = Depends(get_db)):
    b = Bookmark(meeting_id=meeting_id, segment_id=data.segment_id, label=data.label)
    db.add(b)
    db.commit()
    db.refresh(b)
    return {"id": b.id, "meeting_id": b.meeting_id, "segment_id": b.segment_id,
            "label": b.label, "created_at": b.created_at.isoformat()}


@router.delete("/bookmarks/{bookmark_id}", status_code=204)
def delete_bookmark(bookmark_id: int, db: Session = Depends(get_db)):
    b = db.get(Bookmark, bookmark_id)
    if not b:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    db.delete(b)
    db.commit()


# ---------- soundbites ----------

@router.get("/meetings/{meeting_id}/soundbites")
def list_soundbites(meeting_id: int, db: Session = Depends(get_db)):
    soundbites = db.scalars(select(Soundbite).where(Soundbite.meeting_id == meeting_id).order_by(Soundbite.created_at)).all()
    return [{"id": s.id, "meeting_id": s.meeting_id, "title": s.title,
             "start_ms": s.start_ms, "end_ms": s.end_ms, "created_at": s.created_at.isoformat()} for s in soundbites]


@router.post("/meetings/{meeting_id}/soundbites")
def add_soundbite(meeting_id: int, data: SoundbiteCreate, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.is_default == True))  # noqa: E712
    s = Soundbite(meeting_id=meeting_id, title=data.title, start_ms=data.start_ms,
                  end_ms=data.end_ms, created_by=user.id if user else None)
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id, "meeting_id": s.meeting_id, "title": s.title,
            "start_ms": s.start_ms, "end_ms": s.end_ms, "created_at": s.created_at.isoformat()}


@router.delete("/soundbites/{soundbite_id}", status_code=204)
def delete_soundbite(soundbite_id: int, db: Session = Depends(get_db)):
    s = db.get(Soundbite, soundbite_id)
    if not s:
        raise HTTPException(status_code=404, detail="Soundbite not found")
    db.delete(s)
    db.commit()


# ---------- chat history ----------

@router.get("/meetings/{meeting_id}/chat")
def get_chat(meeting_id: int, db: Session = Depends(get_db)):
    msgs = db.scalars(select(ChatMessage).where(ChatMessage.meeting_id == meeting_id).order_by(ChatMessage.created_at)).all()
    return [{"id": m.id, "meeting_id": m.meeting_id, "role": m.role, "content": m.content,
             "citations": json.loads(m.citations) if m.citations else None, "created_at": m.created_at.isoformat()} for m in msgs]


@router.get("/chat")
def get_global_chat(db: Session = Depends(get_db)):
    msgs = db.scalars(select(ChatMessage).where(ChatMessage.meeting_id == None).order_by(ChatMessage.created_at)).all()  # noqa: E711
    return [{"id": m.id, "meeting_id": m.meeting_id, "role": m.role, "content": m.content,
             "citations": json.loads(m.citations) if m.citations else None, "created_at": m.created_at.isoformat()} for m in msgs]


@router.delete("/chat", status_code=204)
def clear_global_chat(db: Session = Depends(get_db)):
    """Clear the global AskFred thread (New Chat button)."""
    db.query(ChatMessage).filter(ChatMessage.meeting_id == None).delete()  # noqa: E711
    db.commit()


@router.delete("/meetings/{meeting_id}/chat", status_code=204)
def clear_meeting_chat(meeting_id: int, db: Session = Depends(get_db)):
    """Clear a meeting-scoped AskFred thread (New Chat button)."""
    db.query(ChatMessage).filter(ChatMessage.meeting_id == meeting_id).delete()
    db.commit()
