"""Seed the database from shared/fixtures/*.json.

The fixtures use the compact format documented in shared/fixtures/README.md.
This loader mirrors the TypeScript loader (frontend/src/mock/load.ts) so both
sides produce identical data: ids, speaker colors, *_ms timestamps, talk-time
stats, anchor resolution ("at" → source_segment_id), assignee resolution.
"""

import json
import re
from datetime import datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import (
    ActionItem,
    Bookmark,
    Channel,
    ChatMessage,
    Comment,
    Meeting,
    MeetingTag,
    Participant,
    Settings,
    Soundbite,
    Summary,
    SummaryItem,
    SummarySection,
    Tag,
    TranscriptSegment,
    User,
)

FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent.parent / "shared" / "fixtures"

SPEAKER_PALETTE = [
    "#ff6fb5", "#ffa94d", "#ffd43b", "#63e6be", "#74c0fc",
    "#b197fc", "#f783ac", "#38d9a9", "#e599f7", "#ff8787",
]

TAG_COLORS = {
    "sales": "#f783ac", "pricing": "#ffd43b", "engineering": "#74c0fc",
    "product": "#b197fc", "marketing": "#ff6fb5", "research": "#63e6be",
    "launch": "#ffa94d", "1:1": "#38d9a9", "retro": "#ff8787",
    "investors": "#e599f7",
}

LINE_RE = re.compile(r"^(\d{1,2}:\d{2}(?::\d{2})?)\s+([^:]{1,40}):\s*(.+)$")


def parse_timecode(tc: str) -> int:
    """"14:32" or "1:02:03" → milliseconds."""
    parts = [int(p) for p in tc.split(":")]
    if len(parts) == 3:
        return ((parts[0] * 60 + parts[1]) * 60 + parts[2]) * 1000
    return (parts[0] * 60 + parts[1]) * 1000


def parse_iso(s: str | None) -> datetime | None:
    """"2026-10-08T10:00:00Z" → datetime (SQLite DateTime needs datetime objects)."""
    if not s:
        return None
    s = s.replace("Z", "+00:00")
    return datetime.fromisoformat(s)


def estimate_duration_ms(text: str) -> int:
    words = len(text.split())
    return min(30_000, 600 + words * 380)


def parse_transcript(lines: list[str]) -> list[dict]:
    parsed = []
    for line in lines:
        m = LINE_RE.match(line.strip())
        if not m:
            continue
        parsed.append({"startMs": parse_timecode(m.group(1)), "speaker": m.group(2).strip(), "text": m.group(3).strip()})
    parsed.sort(key=lambda x: x["startMs"])
    result = []
    for i, p in enumerate(parsed):
        nxt = parsed[i + 1] if i + 1 < len(parsed) else None
        est = p["startMs"] + estimate_duration_ms(p["text"])
        end = max(p["startMs"] + 1200, min(est, nxt["startMs"] - 150)) if nxt else est
        result.append({**p, "endMs": end})
    return result


def resolve_note_anchor(note: str, segments: list[TranscriptSegment]) -> TranscriptSegment | None:
    STOP = set("a an the and or but of to for with on in at by from is are was were be been this that these those we you they it our your their will would can could should shall do does did have has had not no yes so if then about into over under more most some such only own same too very just".split())
    words = list({w for w in re.sub(r"[^a-z0-9 ]+", " ", note.lower()).split() if len(w) > 3 and w not in STOP})[:6]
    if not words:
        return None
    best, best_score = None, 0
    for seg in segments:
        tl = seg.text.lower()
        score = sum(1 for w in words if w in tl)
        if score >= 2 and score > best_score:
            best, best_score = seg, score
    return best


def seed_all(db: Session) -> None:
    """Idempotent seed — wipes and reloads from fixtures."""
    # wipe (order matters for FKs)
    for model in [ChatMessage, Soundbite, Bookmark, Comment, MeetingTag, Tag,
                  ActionItem, SummaryItem, SummarySection, Summary,
                  TranscriptSegment, Participant, Meeting, Channel, Settings, User]:
        db.query(model).delete()
    db.commit()

    # default user + channel + settings
    user = User(name="Vishesh Gupta", email="vishesh@northstar.io", avatar_color="#8b7cff", is_default=True)
    db.add(user)
    db.flush()
    channel = Channel(name="My Meetings", is_default=True)
    db.add(channel)
    db.flush()
    db.add(Settings(id=1))
    db.commit()

    fixture_files = sorted(FIXTURES_DIR.glob("meeting-*.json"))
    for fpath in fixture_files:
        fx = json.loads(fpath.read_text(encoding="utf-8"))
        _seed_meeting(db, fx, user, channel)

    db.commit()

    # generate placeholder WAV audio for meetings with transcripts
    _generate_audio(db)


def _seed_meeting(db: Session, fx: dict, user: User, channel: Channel) -> None:
    has_transcript = bool(fx.get("transcript"))
    status = fx.get("status") or ("ready" if has_transcript else "scheduled")

    meeting = Meeting(
        title=fx["title"],
        description=fx.get("description"),
        meeting_date=parse_iso(fx["meeting_date"]),
        duration_seconds=None,
        host_id=user.id,
        channel_id=channel.id,
        source=fx.get("source", "seed"),
        status=status,
        language=fx.get("language", "en"),
        media_type="audio" if has_transcript else None,
    )
    db.add(meeting)
    db.flush()

    # participants (colors from the palette, in fixture order)
    participants = []
    for i, p in enumerate(fx["participants"]):
        part = Participant(
            meeting_id=meeting.id,
            name=p["name"],
            email=p.get("email"),
            avatar_color=SPEAKER_PALETTE[i % len(SPEAKER_PALETTE)],
            is_host=bool(p.get("host")),
        )
        db.add(part)
        participants.append(part)
    db.flush()

    # transcript
    segments: list[TranscriptSegment] = []
    if has_transcript:
        utterances = parse_transcript(fx["transcript"])
        for i, u in enumerate(utterances):
            speaker = next((p for p in participants if p.name == u["speaker"]), None)
            seg = TranscriptSegment(
                meeting_id=meeting.id,
                speaker_id=speaker.id if speaker else None,
                start_ms=u["startMs"],
                end_ms=u["endMs"],
                text=u["text"],
                order_index=i,
            )
            db.add(seg)
            segments.append(seg)
        db.flush()
        meeting.duration_seconds = round(((segments[-1].end_ms if segments else 0) + 2000) / 1000)
        _recompute_stats(db, meeting.id, participants, segments)

    seg_at = lambda ms: next((s for s in segments if s.start_ms <= ms <= s.end_ms), None)

    # summary
    summary_data = fx.get("summary")
    if summary_data and has_transcript:
        summary = Summary(meeting_id=meeting.id, template=summary_data.get("template", "general"), generated_by="seed")
        db.add(summary)
        db.flush()
        order = 0
        # overview
        first = segments[0] if segments else None
        db.add(SummarySection(summary_id=summary.id, section_type="overview", heading="Overview", order_index=order))
        db.flush()
        db.add(SummaryItem(
            section_id=db.query(SummarySection).filter_by(summary_id=summary.id).order_by(SummarySection.id.desc()).first().id,
            text=summary_data["overview"],
            timestamp_ms=first.start_ms if first else None,
            source_segment_id=first.id if first else None,
            order_index=0,
        ))
        order += 1
        # notes (with anchor resolution)
        notes_heading = "Wins & notes" if summary_data.get("template") == "one_on_one" else "Notes"
        sec = SummarySection(summary_id=summary.id, section_type="notes", heading=notes_heading, order_index=order)
        db.add(sec)
        db.flush()
        for i, note in enumerate(summary_data.get("notes", [])):
            seg = resolve_note_anchor(note, segments)
            db.add(SummaryItem(section_id=sec.id, text=note,
                               timestamp_ms=seg.start_ms if seg else None,
                               source_segment_id=seg.id if seg else None,
                               order_index=i))
        order += 1
        # topics
        if summary_data.get("topics"):
            sec = SummarySection(summary_id=summary.id, section_type="topics", heading="Topics", order_index=order)
            db.add(sec)
            db.flush()
            for i, t in enumerate(summary_data["topics"]):
                seg = seg_at(parse_timecode(t["at"])) if t.get("at") else None
                db.add(SummaryItem(section_id=sec.id, text=t["text"],
                                   timestamp_ms=seg.start_ms if seg else parse_timecode(t["at"]) if t.get("at") else None,
                                   end_timestamp_ms=parse_timecode(t["end"]) if t.get("end") else None,
                                   source_segment_id=seg.id if seg else None,
                                   order_index=i))
            order += 1
        # metrics
        if summary_data.get("metrics"):
            sec = SummarySection(summary_id=summary.id, section_type="metrics", heading="Metrics", order_index=order)
            db.add(sec)
            db.flush()
            for i, m in enumerate(summary_data["metrics"]):
                seg = seg_at(parse_timecode(m["at"])) if m.get("at") else None
                db.add(SummaryItem(section_id=sec.id, text=m["text"],
                                   timestamp_ms=seg.start_ms if seg else None,
                                   source_segment_id=seg.id if seg else None,
                                   order_index=i))
        # action items
        for i, ai in enumerate(summary_data.get("action_items", [])):
            seg = seg_at(parse_timecode(ai["at"])) if ai.get("at") else None
            assignee = next((p for p in participants if p.name == ai.get("speaker")), None)
            from datetime import datetime as _dt
            db.add(ActionItem(
                meeting_id=meeting.id,
                description=ai["text"],
                assignee_id=assignee.id if assignee else None,
                status=ai.get("status", "open"),
                due_date=parse_iso(ai.get("due")),
                source_segment_id=seg.id if seg else None,
                completed_at=meeting.meeting_date if ai.get("status") == "done" else None,
                order_index=i,
            ))

    # tags
    for tname in fx.get("tags", []):
        tag = db.query(Tag).filter_by(name=tname).first()
        if not tag:
            tag = Tag(name=tname, color=TAG_COLORS.get(tname.lower(), "#8b7cff"))
            db.add(tag)
            db.flush()
        db.add(MeetingTag(meeting_id=meeting.id, tag_id=tag.id))

    # comments
    for c in fx.get("comments", []):
        seg = seg_at(parse_timecode(c["at"])) if c.get("at") else None
        db.add(Comment(meeting_id=meeting.id, segment_id=seg.id if seg else None,
                       user_id=user.id, body=c["body"]))

    # bookmarks
    for b in fx.get("bookmarks", []):
        seg = seg_at(parse_timecode(b["at"])) if b.get("at") else None
        db.add(Bookmark(meeting_id=meeting.id, segment_id=seg.id if seg else None,
                        label=b.get("label")))

    # soundbites
    for sb in fx.get("soundbites", []):
        db.add(Soundbite(meeting_id=meeting.id, title=sb["title"],
                         start_ms=parse_timecode(sb["at"]), end_ms=parse_timecode(sb["end"]),
                         created_by=user.id))

    # chat (user questions → engine-generated answers happen at query time in Phase 6;
    # for now seed the user messages and leave the answers for the engine)
    for entry in fx.get("chat", []):
        db.add(ChatMessage(meeting_id=meeting.id, role=entry["role"], content=entry["content"]))


def _recompute_stats(db: Session, meeting_id: int, participants: list[Participant], segments: list[TranscriptSegment]) -> None:
    for p in participants:
        own = [s for s in segments if s.speaker_id == p.id]
        p.talk_time_ms = sum(s.end_ms - s.start_ms for s in own)
        p.word_count = sum(len(s.text.split()) for s in own)


def _generate_audio(db: Session) -> None:
    """Generate placeholder WAV audio for meetings with transcripts (docs/03 §5.6)."""
    try:
        from app.services.media_synth import synthesize_wav
        from app.config import settings
        from pathlib import Path
        media_dir = Path(settings.media_dir)
        meetings = db.scalars(select(Meeting).where(Meeting.status == "ready")).all()
        for m in meetings:
            if m.media_path:
                continue  # already generated
            segments = db.scalars(
                select(TranscriptSegment).where(TranscriptSegment.meeting_id == m.id).order_by(TranscriptSegment.start_ms)
            ).all()
            if not segments:
                continue
            participants = db.scalars(select(Participant).where(Participant.meeting_id == m.id)).all()
            speaker_ids = {p.id: i for i, p in enumerate(participants)}
            seg_dicts = [{"start_ms": s.start_ms, "end_ms": s.end_ms, "speaker_id": s.speaker_id} for s in segments]
            out_path = media_dir / f"meeting_{m.id}.wav"
            media_path = synthesize_wav(seg_dicts, speaker_ids, out_path)
            if media_path:
                m.media_path = media_path
        db.commit()
    except Exception as exc:
        print(f"[media_synth] skipped: {exc}")


if __name__ == "__main__":
    with SessionLocal() as session:
        seed_all(session)
        print(f"Seeded {len(list(FIXTURES_DIR.glob('meeting-*.json')))} meetings from {FIXTURES_DIR}")
