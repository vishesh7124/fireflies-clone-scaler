"""Rule-based summary engine (docs/03-LLD §5.3).

Generates a structured summary (overview + notes + topics + metrics) and
action items with provenance from a transcript. LLM branch activates when
LLM_API_KEY is set (Phase 6+).
"""

import re
from collections import Counter

# stopword set (same as the TS engine)
STOPWORDS = set(
    "a an the and or but of to for with on in at by from is are was were be been "
    "this that these those we you they it our your their me us them will would "
    "can could should shall do does did have has had not no yes just like really "
    "very okay yeah know think get got go going one two also well right now what "
    "when where who how why which there here up out down over again more most some "
    "such only own same too s t don ll ve re d m about let all".split()
)

# classification rules (docs/03 §5.2)
QUESTION_START = re.compile(r"^(what|why|how|when|who|where|do|does|did|can|could|should|would|is|are|any|shall|will)\b", re.I)
TASK_RE = re.compile(
    r"\b(will|shall|going to|need to|needs to|let's|lets|please|can you|could you|make sure|follow up|action item|i'll|we'll|we should|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|eod|eow))\b", re.I
)
DATE_RE = re.compile(
    r"\b(mon(day)?|tues(day)?|wed(nesday)?|thur(s(day)?)?|fri(day)?|sat(urday)?|sun(day)?)\b"
    r"|\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t|tember)?|oct(ober)?|nov(ember)?|dec(ember)?)\s+\d{1,2}\b"
    r"|\b\d{1,2}[\/-]\d{1,2}([\/-]\d{2,4})?\b|\b(next week|tomorrow|today|yesterday|eod|eow|end of (day|week|month|quarter)|q[1-4])\b", re.I
)
METRIC_RE = re.compile(r"\b\d+(\.\d+)?\s*(%|percent|k\b|m\b|hours?|hrs?|mins?|minutes?|ms\b|users?|seats?|calls?|days?|weeks?|months?|sprints?|components?)\b|\$\d+", re.I)
PRICING_RE = re.compile(r"pric|cost|budget|discount|quote|deal size|\$", re.I)
FILLER_RE = re.compile(r"\b(um+|uh+|you know|kind of|sort of|basically|actually|like,)\b", re.I)
FIRST_PERSON = re.compile(r"\b(i'll|i will|i can|i need to|i'm going to|i have to)\b", re.I)

POSITIVE = re.compile(r"great|good|excellent|perfect|love|excited|happy|agree|nice|win|wonderful|amazing|strong|impressive|helpful|productive|clean|clear|best|gold|brutal", re.I)
NEGATIVE = re.compile(r"concern|worried|worry|issue|problem|blocker|blocked|risk|afraid|unfortunately|disagree|bug|fail|failing|broken|frustrat|mess|disaster|sluggish|stuck|hate|useless|brutal|outage|delay", re.I)


def classify(text: str) -> dict:
    """Smart-search classification (mirrors the frontend's rules)."""
    positive = len(POSITIVE.findall(text))
    negative = len(NEGATIVE.findall(text))
    score = 0 if positive + negative == 0 else (positive - negative) / (positive + negative)
    return {
        "question": text.strip().endswith("?") or bool(QUESTION_START.match(text.strip())),
        "task": bool(TASK_RE.search(text)),
        "date": bool(DATE_RE.search(text)),
        "metric": bool(METRIC_RE.search(text)),
        "pricing": bool(PRICING_RE.search(text)),
        "filler": bool(FILLER_RE.search(text)),
        "sentimentScore": score,
    }


def _tokenize(text: str) -> list[str]:
    return [w for w in re.sub(r"[^a-z0-9 ]+", " ", text.lower()).split() if len(w) > 2 and w not in STOPWORDS]


def generate_summary(segments: list[dict], template: str = "general") -> dict:
    """Generate a summary dict: sections[] + action_items[].

    segments: [{id, speaker_id, start_ms, end_ms, text}]
    """
    if not segments:
        return {"template": template, "generated_by": "rules", "sections": [], "action_items": []}

    texts = [s["text"] for s in segments]
    freq: Counter = Counter()
    for t in texts:
        freq.update(_tokenize(t))
    keywords = [w for w, _ in freq.most_common(8)]

    # score sentences by keyword density
    scored = []
    for s in segments:
        for sentence in re.split(r"(?<=[.?!])\s+", s["text"]):
            sentence = sentence.strip()
            if len(sentence) < 20:
                continue
            words = _tokenize(sentence)
            if not words:
                continue
            score = sum(freq.get(w, 0) for w in words) / (len(words) ** 0.5 + 1)
            scored.append((score, sentence, s))
    scored.sort(key=lambda x: -x[0])

    def clean(t: str) -> str:
        t = re.sub(r"^(so|and|but|yeah|okay|basically|actually|honestly|um|uh)\b[, ]*", "", t, flags=re.I).strip()
        return t[0].upper() + t[1:] if t else t

    duration_min = max(1, round((segments[-1]["end_ms"] or 0) / 60000))
    kw4 = keywords[:4]
    overview = f"The {duration_min}-minute meeting covered {', '.join(kw4)}. " + " ".join(
        clean(s) for _, s, _ in scored[:2]
    )

    # notes — top sentences, max 1 per speaker per 5-min window
    seen = set()
    notes = []
    for score, sentence, s in scored:
        key = f"{s['speaker_id']}:{s['start_ms'] // 300_000}"
        if key in seen or len(notes) >= 6:
            continue
        seen.add(key)
        notes.append({"text": clean(sentence), "timestamp_ms": s["start_ms"], "source_segment_id": s["id"]})

    # topics — 5-min window chapters
    topics = []
    window = 300_000
    w_start = segments[0]["start_ms"]
    while w_start < (segments[-1]["end_ms"] or 0):
        win = [s for s in segments if w_start <= s["start_ms"] < w_start + window]
        if win:
            w_freq = Counter()
            for s in win:
                w_freq.update(_tokenize(s["text"]))
            top2 = [w for w, _ in w_freq.most_common(2)]
            title = " & ".join(top2).capitalize() if top2 else "Discussion"
            last = topics[-1] if topics else None
            if last and last["text"] == title:
                last["end_timestamp_ms"] = win[-1]["end_ms"]
            else:
                topics.append({"text": title, "timestamp_ms": win[0]["start_ms"],
                               "end_timestamp_ms": win[-1]["end_ms"], "source_segment_id": win[0]["id"]})
        w_start += window

    # metrics
    metrics = []
    seen_m = set()
    for s in segments:
        if not METRIC_RE.search(s["text"]):
            continue
        words = s["text"].split()
        idx = next((i for i, w in enumerate(words) if w and (w[0].isdigit() or w[0] == "$")), 0)
        snippet = " ".join(words[max(0, idx - 4):idx + 5]).rstrip(".,")
        if snippet in seen_m:
            continue
        seen_m.add(snippet)
        metrics.append({"text": snippet, "timestamp_ms": s["start_ms"], "source_segment_id": s["id"]})

    # action items
    actions = []
    seen_a = set()
    for s in segments:
        if not (TASK_RE.search(s["text"]) and FIRST_PERSON.search(s["text"])):
            continue
        desc = clean(re.sub(r"^.*?\b(i'll|i will|i can|i need to|i'm going to|i have to)\b\s*", "", s["text"], flags=re.I).strip())
        key = desc.lower()[:48]
        if len(desc) < 12 or key in seen_a:
            continue
        seen_a.add(key)
        actions.append({"description": desc, "assignee_id": s["speaker_id"], "source_segment_id": s["id"], "status": "open"})

    headings = {
        "general": {"notes": "Notes", "topics": "Topics"},
        "sales": {"notes": "Qualification notes", "topics": "Call highlights"},
        "one_on_one": {"notes": "Wins & notes", "topics": "Discussion areas"},
        "bant": {"notes": "Qualification notes", "topics": "BANT highlights"},
    }.get(template, {"notes": "Notes", "topics": "Topics"})

    return {
        "template": template,
        "generated_by": "rules",
        "sections": [
            {"section_type": "overview", "heading": "Overview", "items": [{"text": overview, "timestamp_ms": segments[0]["start_ms"], "source_segment_id": segments[0]["id"]}]},
            {"section_type": "notes", "heading": headings["notes"], "items": notes},
            {"section_type": "topics", "heading": headings["topics"], "items": topics},
            {"section_type": "metrics", "heading": "Metrics", "items": metrics[:8]},
        ],
        "action_items": actions[:6],
    }
