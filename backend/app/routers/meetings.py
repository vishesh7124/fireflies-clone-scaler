"""Meetings router — list/create/get/update/delete + transcript + stats
(docs/03-LLD §2.1-2.2)."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    ActionItem,
    Bookmark,
    ChatMessage,
    Comment,
    Meeting,
    MeetingTag,
    Participant,
    Soundbite,
    Summary,
    SummaryItem,
    SummarySection,
    Tag,
    TranscriptSegment,
    User,
)
from app.schemas import (
    CreateMeetingInput,
    MeetingListItem,
    MeetingOut,
    MeetingStatsOut,
    TranscriptOut,
    TranscriptSegmentOut,
    UpdateMeetingInput,
)

router = APIRouter(tags=["meetings"])


# ---------- helpers ----------

def _item(m: Meeting, db: Session) -> MeetingListItem:
    participants = db.scalars(select(Participant).where(Participant.meeting_id == m.id)).all()
    tags = db.execute(
        select(Tag).join(MeetingTag).where(MeetingTag.meeting_id == m.id)
    ).scalars().all()
    open_c = db.scalar(select(func.count(ActionItem.id)).where(ActionItem.meeting_id == m.id, ActionItem.status != "done")) or 0
    done_c = db.scalar(select(func.count(ActionItem.id)).where(ActionItem.meeting_id == m.id, ActionItem.status == "done")) or 0
    preview = None
    if m.status == "ready":
        first = db.scalar(
            select(TranscriptSegment.text)
            .where(TranscriptSegment.meeting_id == m.id)
            .order_by(TranscriptSegment.start_ms)
        )
        preview = first
    return {
        "id": m.id, "title": m.title, "meeting_date": m.meeting_date.isoformat(),
        "duration_seconds": m.duration_seconds, "status": m.status, "source": m.source,
        "channel": "My Meetings", "language": m.language, "media_type": m.media_type,
        "participants": [{"name": p.name, "avatar_color": p.avatar_color} for p in participants],
        "tags": [{"name": t.name, "color": t.color} for t in tags],
        "action_item_counts": {"open": open_c, "done": done_c}, "preview": preview,
    }


# ---------- meetings CRUD ----------

@router.get("/meetings")
def list_meetings(
    q: str | None = None,
    participant: str | None = None,
    tag: str | None = None,
    channel: str | None = None,
    source: str | None = None,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    min_duration: int | None = None,
    sort: str = "recent",
    order: str = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    stmt = select(Meeting).where(Meeting.is_deleted == False)  # noqa: E712
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Meeting.title.ilike(like), Meeting.description.ilike(like)))
    if status:
        stmt = stmt.where(Meeting.status == status)
    if source:
        stmt = stmt.where(Meeting.source == source)
    if date_from:
        stmt = stmt.where(Meeting.meeting_date >= datetime.fromisoformat(date_from))
    if date_to:
        stmt = stmt.where(Meeting.meeting_date <= datetime.fromisoformat(date_to))
    if min_duration:
        stmt = stmt.where(Meeting.duration_seconds >= min_duration)

    meetings = db.scalars(stmt).all()

    # post-filter (joins in Python for simplicity on SQLite)
    if participant:
        p_like = participant.lower()
        meetings = [m for m in meetings if any(p_like in p.name.lower()
                     for p in db.scalars(select(Participant).where(Participant.meeting_id == m.id)).all())]
    if tag:
        meetings = [m for m in meetings if any(t.name.lower() == tag.lower()
                     for t in db.execute(select(Tag).join(MeetingTag).where(MeetingTag.meeting_id == m.id)).scalars().all())]

    dir_ = 1 if order == "asc" else -1
    if sort == "title":
        meetings.sort(key=lambda m: m.title, reverse=dir_ == -1)
    elif sort == "duration":
        meetings.sort(key=lambda m: m.duration_seconds or 0, reverse=dir_ == -1)
    else:  # recent / date
        meetings.sort(key=lambda m: m.meeting_date, reverse=dir_ == -1)

    total = len(meetings)
    items = meetings[(page - 1) * page_size: page * page_size]
    return {"items": [_item(m, db) for m in items], "page": page, "page_size": page_size, "total": total}


@router.post("/meetings", status_code=201)
def create_meeting(data: CreateMeetingInput, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.is_default == True))  # noqa: E712
    if not user:
        raise HTTPException(status_code=500, detail="Default user missing")
    has_transcript = bool(data.transcript_text and data.transcript_text.strip())
    meeting = Meeting(
        title=data.title,
        description=data.description,
        meeting_date=datetime.fromisoformat(data.meeting_date),
        host_id=user.id,
        source="paste" if has_transcript else "schedule",
        status="processing" if has_transcript else "scheduled",
        media_type="audio" if has_transcript else None,
    )
    db.add(meeting)
    db.flush()

    # participants (default to the current user)
    names = data.participants or [{"name": user.name}]
    for i, p in enumerate(names):
        db.add(Participant(meeting_id=meeting.id, name=p["name"], email=p.get("email"),
                           avatar_color="#7c5cff", is_host=i == 0))
    db.flush()

    if has_transcript:
        # parse transcript lines (same format as the frontend loader)
        from app.seed.seed import parse_transcript
        utterances = parse_transcript(data.transcript_text.splitlines())
        for i, u in enumerate(utterances):
            speaker = db.scalar(select(Participant).where(Participant.meeting_id == meeting.id, Participant.name == u["speaker"]))
            db.add(TranscriptSegment(meeting_id=meeting.id, speaker_id=speaker.id if speaker else None,
                                     start_ms=u["startMs"], end_ms=u["endMs"], text=u["text"], order_index=i))
        db.flush()
        meeting.duration_seconds = round(((db.scalar(select(TranscriptSegment.end_ms).where(TranscriptSegment.meeting_id == meeting.id).order_by(TranscriptSegment.end_ms.desc())) or 0) + 2000) / 1000)
        # TODO: BackgroundTask to generate summary + flip to ready (Phase 6)
        meeting.status = "ready"

    db.commit()
    return {"id": meeting.id, "status": meeting.status}


@router.get("/meetings/{meeting_id}")
def get_meeting(meeting_id: int, db: Session = Depends(get_db)):
    m = db.get(Meeting, meeting_id)
    if not m or m.is_deleted:
        raise HTTPException(status_code=404, detail="Meeting not found")
    item = _item(m, db)
    return {
        **item,
        "description": m.description, "host_id": m.host_id, "media_url": m.media_path,
        "counts": {
            "comments": db.scalar(select(func.count(Comment.id)).where(Comment.meeting_id == m.id)) or 0,
            "bookmarks": db.scalar(select(func.count(Bookmark.id)).where(Bookmark.meeting_id == m.id)) or 0,
            "soundbites": db.scalar(select(func.count(Soundbite.id)).where(Soundbite.meeting_id == m.id)) or 0,
        },
        "created_at": m.created_at.isoformat(), "updated_at": m.updated_at.isoformat(),
    }


@router.patch("/meetings/{meeting_id}")
def update_meeting(meeting_id: int, patch: UpdateMeetingInput, db: Session = Depends(get_db)):
    m = db.get(Meeting, meeting_id)
    if not m or m.is_deleted:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if patch.title is not None:
        m.title = patch.title
    if patch.description is not None:
        m.description = patch.description
    if patch.meeting_date is not None:
        m.meeting_date = datetime.fromisoformat(patch.meeting_date)
    if patch.channel is not None:
        pass  # channel update TODO
    if patch.language is not None:
        m.language = patch.language
    db.commit()
    db.refresh(m)
    return get_meeting(meeting_id, db)


@router.delete("/meetings/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: int, db: Session = Depends(get_db)):
    m = db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    db.delete(m)  # cascades to participants, segments, summary, action items, etc.
    db.commit()


# ---------- transcript ----------

@router.get("/meetings/{meeting_id}/transcript", response_model=TranscriptOut)
def get_transcript(meeting_id: int, db: Session = Depends(get_db)):
    m = db.get(Meeting, meeting_id)
    if not m or m.is_deleted:
        raise HTTPException(status_code=404, detail="Meeting not found")
    segments = db.scalars(
        select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id).order_by(TranscriptSegment.start_ms)
    ).all()
    out = []
    for s in segments:
        speaker = db.get(Participant, s.speaker_id) if s.speaker_id else None
        out.append({
            "id": s.id, "meeting_id": s.meeting_id, "speaker_id": s.speaker_id,
            "speaker_name": speaker.name if speaker else "Unknown",
            "avatar_color": speaker.avatar_color if speaker else "#8b7cff",
            "start_ms": s.start_ms, "end_ms": s.end_ms, "text": s.text, "is_edited": bool(s.is_edited),
        })
    return {"meeting_id": meeting_id, "duration_ms": (out[-1]["end_ms"] + 2000) if out else 0, "segments": out}


@router.patch("/transcript-segments/{segment_id}")
def update_segment(segment_id: int, body: dict, db: Session = Depends(get_db)):
    seg = db.get(TranscriptSegment, segment_id)
    if not seg:
        raise HTTPException(status_code=404, detail="Segment not found")
    seg.text = body.get("text", seg.text).strip()
    seg.is_edited = True
    db.commit()
    db.refresh(seg)
    speaker = db.get(Participant, seg.speaker_id) if seg.speaker_id else None
    return {
        "id": seg.id, "meeting_id": seg.meeting_id, "speaker_id": seg.speaker_id,
        "speaker_name": speaker.name if speaker else "Unknown",
        "avatar_color": speaker.avatar_color if speaker else "#8b7cff",
        "start_ms": seg.start_ms, "end_ms": seg.end_ms, "text": seg.text, "is_edited": True,
    }


# ---------- stats ----------

@router.get("/meetings/{meeting_id}/stats", response_model=MeetingStatsOut)
def get_stats(meeting_id: int, db: Session = Depends(get_db)):
    m = db.get(Meeting, meeting_id)
    if not m or m.is_deleted:
        raise HTTPException(status_code=404, detail="Meeting not found")
    segments = db.scalars(select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id)).all()
    participants = db.scalars(select(Participant).where(Participant.meeting_id == meeting_id)).all()
    total_talk = sum(p.talk_time_ms for p in participants) or 1

    # sentiment (simple rule-based)
    POS = "great good excellent perfect love excited happy agree nice win wonderful amazing strong impressive helpful productive clean clear best gold".split()
    NEG = "concern worried worry issue problem blocker blocked risk afraid unfortunately disagree bug fail failing broken frustrat mess disaster sluggish stuck hate useless brutal outage delay".split()
    def sentiment(text: str) -> int:
        tl = text.lower()
        p = sum(1 for w in POS if w in tl)
        n = sum(1 for w in NEG if w in tl)
        return (p - n) if p + n else 0

    speakers = []
    for p in sorted(participants, key=lambda x: -x.talk_time_ms):
        own = [s for s in segments if s.speaker_id == p.id]
        scores = [sentiment(s.text) for s in own]
        avg = sum(scores) / len(scores) if scores else 0
        talk_min = p.talk_time_ms / 60000
        speakers.append({
            "name": p.name, "avatar_color": p.avatar_color,
            "talk_time_ms": p.talk_time_ms,
            "talk_time_pct": round(p.talk_time_ms / total_talk * 100),
            "word_count": p.word_count,
            "wpm": round(p.word_count / talk_min) if talk_min > 0.2 else 0,
            "sentiment": "positive" if avg > 0.15 else "negative" if avg < -0.15 else "neutral",
        })

    # filter counts (rule-based, mirroring docs/03 §5.2)
    def classify(text: str) -> dict:
        tl = text.lower()
        return {
            "questions": "?" in text or any(text.lower().startswith(w) for w in ["what", "why", "how", "when", "who", "where", "do", "does", "did", "can", "could", "should", "would", "is", "are", "any"]),
            "tasks": any(w in tl for w in ["will", "shall", "going to", "need to", "needs to", "let's", "please", "can you", "could you", "make sure", "follow up", "action item", "i'll", "we'll", "we should"]),
            "dates": any(w in tl for w in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "next week", "tomorrow", "today", "yesterday", "eod", "end of"]),
            "metrics": any(c.isdigit() for c in text) and any(w in tl for w in ["%", "percent", "hours", "mins", "minutes", "users", "seats", "calls", "days", "weeks", "months", "sprints", "components", "$"]),
            "pricing": any(w in tl for w in ["price", "pricing", "cost", "budget", "discount", "quote", "deal size"]),
            "fillers": any(w in tl for w in ["um", "uh", "you know", "kind of", "sort of", "basically", "actually"]),
        }

    counts = {"questions": 0, "tasks": 0, "dates": 0, "metrics": 0, "pricing": 0, "fillers": 0}
    for s in segments:
        c = classify(s.text)
        for k in counts:
            if c[k]:
                counts[k] += 1

    all_scores = [sentiment(s.text) for s in segments]
    avg_all = sum(all_scores) / len(all_scores) if all_scores else 0
    return {
        "speakers": speakers, "filters": counts,
        "sentiment": "positive" if avg_all > 0.15 else "negative" if avg_all < -0.15 else "neutral",
    }
