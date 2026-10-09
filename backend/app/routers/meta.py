"""Meta endpoints: /me, /settings, /dashboard, /health (docs/03-LLD §2)."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ActionItem, Meeting, MeetingTag, Participant, Settings, Summary, SummaryItem, SummarySection, Tag, TranscriptSegment, User
from app.schemas import DashboardOut, SettingsOut, SettingsUpdate, UserOut

router = APIRouter(tags=["meta"])


@router.get("/me", response_model=UserOut)
def get_me(db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.is_default == True))  # noqa: E712
    if not user:
        raise HTTPException(status_code=404, detail="Default user not found")
    return user


@router.get("/settings", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    settings = db.get(Settings, 1)
    if not settings:
        settings = Settings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.patch("/settings", response_model=SettingsOut)
def update_settings(patch: SettingsUpdate, db: Session = Depends(get_db)):
    settings = db.get(Settings, 1)
    if not settings:
        settings = Settings(id=1)
        db.add(settings)
    for key, value in patch.model_dump(exclude_none=True).items():
        setattr(settings, key, value)
    db.commit()
    db.refresh(settings)
    return settings


@router.get("/dashboard", response_model=DashboardOut)
def get_dashboard(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    meetings = db.scalars(
        select(Meeting).where(Meeting.is_deleted == False).order_by(Meeting.meeting_date.desc())  # noqa: E712
    ).all()
    ready = [m for m in meetings if m.status == "ready"]
    upcoming = [m for m in meetings if m.status == "scheduled"]

    total_minutes = sum(m.duration_seconds or 0 for m in ready) // 60
    meetings_this_week = sum(1 for m in meetings if m.meeting_date.replace(tzinfo=timezone.utc) >= week_ago)
    open_tasks = db.scalar(select(func.count(ActionItem.id)).where(ActionItem.status != "done")) or 0

    # top participants
    top = db.execute(
        select(Participant.name, Participant.avatar_color, func.count().label("count"))
        .group_by(Participant.name)
        .order_by(func.count().desc())
        .limit(5)
    ).all()
    top_participants = [{"name": r.name, "avatar_color": r.avatar_color, "count": r.count} for r in top]

    def item(m: Meeting) -> dict:
        preview = db.scalar(select(TranscriptSegment.text).where(TranscriptSegment.meeting_id == m.id).order_by(TranscriptSegment.start_ms)) if m.status == "ready" else None
        participants = db.scalars(select(Participant).where(Participant.meeting_id == m.id)).all()
        tags = db.execute(
            select(Tag).join(MeetingTag).where(MeetingTag.meeting_id == m.id)
        ).scalars().all()
        open_c = db.scalar(select(func.count(ActionItem.id)).where(ActionItem.meeting_id == m.id, ActionItem.status != "done")) or 0
        done_c = db.scalar(select(func.count(ActionItem.id)).where(ActionItem.meeting_id == m.id, ActionItem.status == "done")) or 0
        return {
            "id": m.id, "title": m.title, "meeting_date": m.meeting_date.isoformat(),
            "duration_seconds": m.duration_seconds, "status": m.status, "source": m.source,
            "channel": "My Meetings", "language": m.language, "media_type": m.media_type,
            "participants": [{"name": p.name, "avatar_color": p.avatar_color} for p in participants],
            "tags": [{"name": t.name, "color": t.color} for t in tags],
            "action_item_counts": {"open": open_c, "done": done_c}, "preview": preview,
        }

    # AI feed
    ai_feed = []
    for m in ready[:4]:
        summary = db.scalar(select(Summary).where(Summary.meeting_id == m.id))
        headline = m.title
        bullets: list[str] = []
        if summary:
            overview = db.scalars(
                select(SummaryItem.text).join(SummarySection).where(
                    SummarySection.summary_id == summary.id, SummarySection.section_type == "overview"
                )
            ).first()
            headline = overview or m.title
            bullets = db.scalars(
                select(SummaryItem.text).join(SummarySection).where(
                    SummarySection.summary_id == summary.id, SummarySection.section_type == "notes"
                ).limit(3)
            ).all()
        ai_feed.append({"meeting_id": m.id, "title": m.title, "meeting_date": m.meeting_date.isoformat(),
                        "headline": headline, "bullets": list(bullets)})

    return {
        "total_meetings": len(meetings), "total_minutes": total_minutes,
        "meetings_this_week": meetings_this_week, "open_tasks": open_tasks,
        "upcoming_count": len(upcoming), "top_participants": top_participants,
        "recent": [item(m) for m in ready[:5]], "upcoming_list": [item(m) for m in upcoming[:4]],
        "ai_feed": ai_feed,
    }


@router.get("/health")
def health(db: Session = Depends(get_db)):
    meetings = db.scalar(select(func.count(Meeting.id))) or 0
    return {"ok": True, "db": "sqlite", "meetings": meetings, "seed": "loaded" if meetings else "empty", "llm_enabled": False}


@router.post("/admin/reseed")
def reseed(db: Session = Depends(get_db)):
    """Wipe and reload demo data from shared/fixtures/ (Settings → Danger zone)."""
    from app.seed.seed import seed_all
    seed_all(db)
    meetings = db.scalar(select(func.count(Meeting.id))) or 0
    return {"ok": True, "meetings": meetings}
