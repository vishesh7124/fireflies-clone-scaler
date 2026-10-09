"""Export service — txt / md / srt / vtt / json / pdf (docs/03-LLD §5.7)."""

import json
from datetime import datetime


def _ms_clock(ms: int) -> str:
    s = int(ms / 1000)
    m, sec = divmod(s, 60)
    return f"{m}:{sec:02d}"


def _ms_srt(ms: int) -> str:
    total = max(0, ms)
    h = total // 3_600_000
    m = (total % 3_600_000) // 60_000
    s = (total % 60_000) // 1000
    f = total % 1000
    return f"{h:02d}:{m:02d}:{s:02d},{f:03d}"


def export_meeting(meeting: dict, participants: list[dict], summary: dict | None,
                   action_items: list[dict], segments: list[dict], fmt: str) -> dict:
    """Return {filename, mime, content} for the requested format."""
    title = meeting["title"]
    slug = "-".join(title.lower().split())[:60]
    date = meeting.get("meeting_date", "")
    dur = meeting.get("duration_seconds") or 0
    names = ", ".join(p["name"] for p in participants)
    name_of = lambda sid: next((p["name"] for p in participants if p.get("id") == sid), "Unknown")

    if fmt == "json":
        return {"filename": f"{slug}.json", "mime": "application/json",
                "content": json.dumps({"meeting": meeting, "participants": participants,
                                        "summary": summary, "action_items": action_items,
                                        "transcript": segments}, indent=2, default=str)}

    if fmt in ("srt", "vtt"):
        cues = []
        for i, s in enumerate(segments):
            tc = _ms_srt(s["start_ms"]) if fmt == "srt" else _ms_srt(s["start_ms"]).replace(",", ".")
            te = _ms_srt(s["end_ms"]) if fmt == "srt" else _ms_srt(s["end_ms"]).replace(",", ".")
            cues.append(f"{i+1}\n{tc} --> {te}\n{name_of(s.get('speaker_id'))}: {s['text']}\n")
        header = "WEBVTT\n\n" if fmt == "vtt" else ""
        return {"filename": f"{slug}.{fmt}", "mime": "text/plain", "content": header + "\n".join(cues)}

    # summary text
    summary_text = ""
    if summary:
        for sec in summary.get("sections", []):
            lines = []
            for item in sec.get("items", []):
                if sec["section_type"] == "overview":
                    lines.append(item["text"])
                else:
                    ts = f" ({_ms_clock(item['timestamp_ms'])})" if item.get("timestamp_ms") else ""
                    lines.append(f"- {item['text']}{ts}")
            summary_text += f"{sec['heading'].upper()}\n" + "\n".join(lines) + "\n\n"
    if action_items:
        summary_text += "ACTION ITEMS\n" + "\n".join(
            f"- [{'x' if a.get('status') == 'done' else ' '}] {a['description']} — {name_of(a.get('assignee_id'))}"
            for a in action_items
        ) + "\n"

    if fmt == "md":
        transcript_md = "\n\n".join(
            f"**{name_of(s.get('speaker_id'))}** `{_ms_clock(s['start_ms'])}`\n\n{s['text']}"
            for s in segments
        )
        return {"filename": f"{slug}.md", "mime": "text/markdown",
                "content": f"# {title}\n\n_{date} · {dur//60} min · {names}_\n\n## Summary\n\n{summary_text}\n\n## Transcript\n\n{transcript_md}"}

    # txt
    transcript_txt = "\n".join(f"[{_ms_clock(s['start_ms'])}] {name_of(s.get('speaker_id'))}: {s['text']}" for s in segments)
    return {"filename": f"{slug}.txt", "mime": "text/plain",
            "content": f"{title}\n{date} · {dur//60} min\nParticipants: {names}\n\n{summary_text}\nTRANSCRIPT\n\n{transcript_txt}"}
