"""Search service — LIKE-based full-text search with snippets (docs/03-LLD §5.2).

FTS5 is the production optimization; LIKE fallback works fine for our data
size and avoids SQLite FTS5 setup complexity.
"""

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Meeting, Participant, TranscriptSegment


def _snippet(text: str, q: str, radius: int = 60) -> str:
    """Extract a snippet around the first match, with <mark> highlights."""
    idx = text.lower().find(q.lower())
    if idx < 0:
        return text[:radius * 2] + ("…" if len(text) > radius * 2 else "")
    start = max(0, idx - radius)
    end = min(len(text), idx + len(q) + radius)
    before = text[start:idx]
    match = text[idx:idx + len(q)]
    after = text[idx + len(q):end]
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    return f"{prefix}{before}<mark>{match}</mark>{after}{suffix}"


def search(q: str, db: Session, limit: int = 12) -> dict:
    """Search meetings by title and transcript text; return grouped results."""
    q = q.strip()
    if not q:
        return {"meetings": [], "transcript_matches": [], "total": 0}

    like = f"%{q}%"

    # meeting title matches
    meetings = db.scalars(
        select(Meeting).where(Meeting.is_deleted == False, Meeting.title.ilike(like))  # noqa: E712
    ).all()

    # transcript matches
    segments = db.scalars(
        select(TranscriptSegment).where(TranscriptSegment.text.ilike(like))
        .order_by(TranscriptSegment.meeting_id, TranscriptSegment.start_ms)
        .limit(limit)
    ).all()

    def meeting_item(m: Meeting) -> dict:
        participants = db.scalars(select(Participant).where(Participant.meeting_id == m.id)).all()
        return {
            "id": m.id, "title": m.title, "meeting_date": m.meeting_date.isoformat(),
            "duration_seconds": m.duration_seconds, "status": m.status, "source": m.source,
            "channel": "My Meetings", "language": m.language, "media_type": m.media_type,
            "participants": [{"name": p.name, "avatar_color": p.avatar_color} for p in participants],
            "tags": [], "action_item_counts": {"open": 0, "done": 0}, "preview": None,
        }

    transcript_matches = []
    for s in segments:
        meeting = db.get(Meeting, s.meeting_id)
        speaker = db.get(Participant, s.speaker_id) if s.speaker_id else None
        transcript_matches.append({
            "meeting_id": s.meeting_id,
            "meeting_title": meeting.title if meeting else "",
            "segment_id": s.id,
            "start_ms": s.start_ms,
            "speaker": speaker.name if speaker else "Unknown",
            "text": _snippet(s.text, q),
        })

    return {
        "meetings": [meeting_item(m) for m in meetings],
        "transcript_matches": transcript_matches,
        "total": len(meetings) + len(transcript_matches),
    }
