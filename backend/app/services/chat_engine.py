"""AskFred chat engine (docs/03-LLD §5.4).

Answers questions about meetings with timestamped citations. Rule-based
intents + keyword retrieval; LLM branch activates when LLM_API_KEY is set.
"""

import re

from app.services.summary_engine import _tokenize


def _quote(text: str) -> str:
    t = re.sub(r"\s+", " ", text.strip())
    return t[:140] + "…" if len(t) > 140 else t


def _citation(seg: dict, meeting_title: str) -> dict:
    return {
        "meeting_id": seg["meeting_id"],
        "meeting_title": meeting_title or seg.get("meeting_title", "Meeting"),
        "segment_id": seg["id"],
        "start_ms": seg["start_ms"],
        "speaker": seg.get("speaker_name", "Unknown"),
        "quote": _quote(seg["text"]),
    }


def _fmt_ms(ms: int) -> str:
    s = int(ms / 1000)
    m, sec = divmod(s, 60)
    return f"{m}:{sec:02d}"


def answer_question(question: str, segments: list[dict], meeting_title: str | None = None,
                    action_items: list[dict] | None = None) -> dict:
    """Return {answer, citations} for a question.

    segments: [{id, meeting_id, speaker_name, start_ms, text}]
    meeting_title: scope label (None = global)
    """
    q = question.strip()
    ql = q.lower()
    scope = meeting_title or "your meetings"
    citations: list[dict] = []

    if not segments:
        return {"answer": "There are no processed meetings yet — once you have transcripts, ask me anything.", "citations": []}

    # intent: action items / next steps
    if re.search(r"action item|to-?do|\btasks?\b|next steps", ql):
        items = action_items or []
        if "next step" in ql:
            items = [a for a in items if a.get("status") != "done"]
        if not items:
            return {"answer": "No action items were captured for this scope.", "citations": []}
        lines = []
        for a in items[:8]:
            mark = "✓" if a.get("status") == "done" else "•"
            assignee = a.get("assignee_name") or "Unassigned"
            suffix = " (done)" if a.get("status") == "done" else ""
            lines.append(f"{mark} {a['description']} — {assignee}{suffix}")
        source_ids = {a["source_segment_id"] for a in items if a.get("source_segment_id") is not None}
        cites = [_citation(s, meeting_title) for s in segments if s["id"] in source_ids][:3]
        label = "next steps" if "next step" in ql else "action items"
        return {"answer": f"Here are the {label} I found:\n" + "\n".join(lines), "citations": cites}

    # intent: takeaways / summary
    if re.search(r"takeaway|summar|overview|recap|what.*(?:about|discuss)", ql):
        first = segments[0]
        top = sorted(segments, key=lambda s: len(s["text"]), reverse=True)[:3]
        bullets = [f"• {_quote(s['text'])}" for s in top]
        answer = f"Key takeaways from \"{scope}\":\n" + "\n".join(bullets)
        citations = [_citation(s, meeting_title) for s in top[:2]]
        return {"answer": answer, "citations": citations}

    # intent: when was X discussed
    when = re.match(r"when (?:was|is|did)\s+(.+?)\s+(?:discuss|mention|come up|talk(?:ed)? about|raise)", ql)
    if when:
        topic = re.sub(r"^(the|a|an)\s+", "", when[1])
        words = _tokenize(topic)
        hits = [s for s in segments if any(w in s["text"].lower() for w in words)]
        if not hits:
            return {"answer": f"I couldn't find \"{topic}\" in {scope}.", "citations": []}
        first = hits[0]
        speaker = first.get("speaker_name", "Someone")
        others = [f"{s.get('speaker_name','someone')} brought it up again at {_fmt_ms(s['start_ms'])}" for s in hits[1:3]]
        prefix = f"In \"{meeting_title}\", {topic}" if meeting_title else topic.capitalize()
        answer = f"{prefix} first came up at {_fmt_ms(first['start_ms'])}, when {speaker} said: \"{_quote(first['text'])}\""
        if others:
            answer += f". {', and '.join(others)}."
        else:
            answer += f" — it came up {len(hits)} time{'s' if len(hits) > 1 else ''}."
        return {"answer": answer, "citations": [_citation(s, meeting_title) for s in hits[:3]]}

    # intent: who said X
    who = re.match(r"who said\s+(.+)", ql)
    if who:
        phrase = who[1].strip("\"'.?!")
        hits = [s for s in segments if phrase.lower() in s["text"].lower()]
        if not hits:
            return {"answer": f"Nobody in {scope} said \"{phrase}\".", "citations": []}
        by_spk: dict[str, list] = {}
        for s in hits:
            by_spk.setdefault(s.get("speaker_name", "Unknown"), []).append(s)
        lines = [f"{name} — {len(segs)}×, first at {_fmt_ms(segs[0]['start_ms'])}: \"{_quote(segs[0]['text'])}\"" for name, segs in by_spk.items()]
        return {"answer": f"\"{phrase}\" came from:\n" + "\n".join(lines), "citations": [_citation(s, meeting_title) for s in hits[:3]]}

    # intent: duration / talk time
    if re.search(r"how long|duration|talk.?time", ql):
        ranges = {}
        for s in segments:
            start, end = ranges.get(s["meeting_id"], (s["start_ms"], s["end_ms"]))
            ranges[s["meeting_id"]] = (min(start, s["start_ms"]), max(end, s["end_ms"]))
        total = sum(end - start for start, end in ranges.values())
        return {"answer": f"\"{meeting_title or 'That meeting'}\" ran {round(total/60000)} minutes.", "citations": [_citation(segments[0], meeting_title)]}

    # general retrieval — keyword-scored segments
    q_words = _tokenize(q)
    ranked = []
    for s in segments:
        tl = s["text"].lower()
        score = sum(1 for w in q_words if w in tl)
        if score > 0:
            ranked.append((score, s))
    ranked.sort(key=lambda x: (-x[0], x[1]["start_ms"]))
    top = [s for _, s in ranked[:3]]
    if not top:
        return {"answer": f"I couldn't find anything about that in {scope}. Try naming a topic, a person, or a number.", "citations": []}
    lines = [f"• {s.get('speaker_name','Unknown')}, {_fmt_ms(s['start_ms'])}: \"{_quote(s['text'])}\"" for s in top]
    return {"answer": f"Here's what I found:\n" + "\n".join(lines), "citations": [_citation(s, meeting_title) for s in top]}
