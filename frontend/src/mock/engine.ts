/**
 * Rule-based engine — the TypeScript port of the algorithms in
 * docs/03-LOW-LEVEL-DESIGN.md §5.2-5.4 + §5.7 (the Python services mirror
 * these in Phase 6):
 *   - classifySegment  → Smart Search filters (questions/tasks/dates/metrics/pricing/fillers/sentiment)
 *   - computeStats     → speaker talk-time, WPM, sentiment, filter counts
 *   - generateSummary  → rules-based summary + action items (used when a meeting
 *                        is created from a pasted transcript, and on "reprocess")
 *   - answerQuestion   → AskFred retrieval fallback with timestamped citations
 *   - exportMeeting    → txt / md / srt / vtt / json exports
 */

import type {
  ActionItemStatus,
  ChatCitation,
  ExportFormat,
  ExportResult,
  MeetingStats,
  Sentiment,
  SummaryTemplate,
} from "@/lib/types";
import { capitalize, msToClock, msToSrt, msToVtt, slugify } from "@/lib/format";
import type { DbActionItem, DbMeeting, DbParticipant, DbSegment, MockDb } from "./load";

// ---------- classification (LLD §5.2) ----------

const QUESTION_START =
  /^(what|why|how|when|who|where|do|does|did|can|could|should|would|is|are|any|shall|will|shall)\b/i;
const TASK_RE =
  /\b(will|shall|going to|need to|needs to|let's|lets|please|can you|could you|make sure|follow up|action item|i'll|we'll|we should|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|eod|eow|friday))\b/i;
const DATE_RE =
  /\b(mon(day)?|tues(day)?|wed(nesday)?|thur(s(day)?)?|fri(day)?|sat(urday)?|sun(day)?)\b|\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t|tember)?|oct(ober)?|nov(ember)?|dec(ember)?)\s+\d{1,2}\b|\b\d{1,2}[\/-]\d{1,2}([\/-]\d{2,4})?\b|\b(next week|tomorrow|today|yesterday|eod|eow|end of (day|week|month|quarter)|q[1-4])\b/i;
const METRIC_RE =
  /\b\d+(\.\d+)?\s*(%|percent|k\b|m\b|hours?|hrs?|mins?|minutes?|ms\b|users?|seats?|calls?|days?|weeks?|months?|sprints?|components?|minutes)\b/i;
const PRICING_RE = /pric|cost|budget|discount|quote|deal size|\$/i;
const FILLER_RE = /\b(um+|uh+|you know|kind of|sort of|basically|actually|like,)\b/i;

const POSITIVE_WORDS =
  /great|good|excellent|perfect|love|excited|happy|agree|nice|win|wonderful|amazing|strong|impressive|reassuring|helpful|productive|clean|clear|best|gold|brutal/i;
const NEGATIVE_WORDS =
  /concern|worried|worry|issue|problem|blocker|blocked|risk|afraid|unfortunately|disagree|bug|fail|failing|broken|frustrat|mess|disaster|sluggish|stuck|hate|useless|brutal|outage|down/i;

export interface SegmentClass {
  question: boolean;
  task: boolean;
  date: boolean;
  metric: boolean;
  pricing: boolean;
  filler: boolean;
  sentimentScore: number; // -1..1
}

export function classifySegment(text: string): SegmentClass {
  const positive = (text.match(new RegExp(POSITIVE_WORDS, "gi")) ?? []).length;
  const negative = (text.match(new RegExp(NEGATIVE_WORDS, "gi")) ?? []).length;
  return {
    question: /\?\s*$/.test(text) || QUESTION_START.test(text),
    task: TASK_RE.test(text),
    date: DATE_RE.test(text),
    metric: METRIC_RE.test(text),
    pricing: PRICING_RE.test(text),
    filler: FILLER_RE.test(text),
    sentimentScore: positive + negative === 0 ? 0 : (positive - negative) / (positive + negative),
  };
}

function sentimentLabel(score: number): Sentiment {
  if (score > 0.15) return "positive";
  if (score < -0.15) return "negative";
  return "neutral";
}

// ---------- stats (LLD: conversation intelligence) ----------

export function computeStats(db: MockDb, meetingId: number): MeetingStats {
  const participants = db.participants.filter((p) => p.meeting_id === meetingId);
  const segments = db.segments.filter((s) => s.meeting_id === meetingId);
  const classes = segments.map((s) => classifySegment(s.text));
  const totalTalk = participants.reduce((a, p) => a + p.talk_time_ms, 0) || 1;

  const speakers = participants
    .map((p) => {
      const own = segments.filter((s) => s.speaker_id === p.id);
      const ownClasses = own.map((s) => classifySegment(s.text));
      const avg = ownClasses.length
        ? ownClasses.reduce((a, c) => a + c.sentimentScore, 0) / ownClasses.length
        : 0;
      const talkMin = p.talk_time_ms / 60000;
      return {
        name: p.name,
        avatar_color: p.avatar_color,
        talk_time_ms: p.talk_time_ms,
        talk_time_pct: Math.round((p.talk_time_ms / totalTalk) * 100),
        word_count: p.word_count,
        wpm: talkMin > 0.2 ? Math.round(p.word_count / talkMin) : 0,
        sentiment: sentimentLabel(avg),
      };
    })
    .sort((a, b) => b.talk_time_ms - a.talk_time_ms);

  const overall = classes.length
    ? classes.reduce((a, c) => a + c.sentimentScore, 0) / classes.length
    : 0;

  return {
    speakers,
    filters: {
      questions: classes.filter((c) => c.question).length,
      tasks: classes.filter((c) => c.task).length,
      dates: classes.filter((c) => c.date).length,
      metrics: classes.filter((c) => c.metric).length,
      pricing: classes.filter((c) => c.pricing).length,
      fillers: classes.filter((c) => c.filler).length,
    },
    sentiment: sentimentLabel(overall),
  };
}

// ---------- keyword scoring (LLD §5.3) ----------

const STOPWORDS = new Set(
  ("a an the and or but if then so because as of at by for with about into to from in on is are was were be been being it its this that these those i we you they he she my our your their me us them will would can could should shall do does did have has had not no yes just like really very okay yeah oh know think get got go going one two also well right now what when where who how why which there here up out down over again more most some such only own same too s t don ll ve re d m about let all")
    .split(" ")
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9$%' ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function keywordFrequency(texts: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of texts) for (const w of tokenize(t)) freq.set(w, (freq.get(w) ?? 0) + 1);
  return freq;
}

function topKeywords(texts: string[], n: number): string[] {
  return [...keywordFrequency(texts).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

function cleanSentence(s: string): string {
  return capitalize(
    s
      .replace(/^(so|and|but|yeah|okay|basically|actually|honestly|um|uh)\b[, ]*/i, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

// ---------- summary generation (LLD §5.3) ----------

export interface GeneratedSummary {
  template: SummaryTemplate;
  generated_by: "rules";
  sections: {
    section_type: "overview" | "notes" | "topics" | "metrics";
    heading: string;
    items: {
      text: string;
      timestamp_ms: number | null;
      end_timestamp_ms: number | null;
      source_segment_id: number | null;
    }[];
  }[];
  action_items: {
    description: string;
    assignee_id: number | null;
    source_segment_id: number | null;
    status: ActionItemStatus;
  }[];
}

const TEMPLATE_HEADINGS: Record<SummaryTemplate, { notes: string; topics: string }> = {
  general: { notes: "Notes", topics: "Topics" },
  sales: { notes: "Qualification notes", topics: "Call highlights" },
  one_on_one: { notes: "Wins & notes", topics: "Discussion areas" },
  bant: { notes: "Qualification notes", topics: "BANT highlights" },
};

export function generateSummary(
  segments: DbSegment[],
  participants: DbParticipant[],
  template: SummaryTemplate = "general",
): GeneratedSummary {
  const empty: GeneratedSummary = {
    template,
    generated_by: "rules",
    sections: [],
    action_items: [],
  };
  if (segments.length === 0) return empty;

  const texts = segments.map((s) => s.text);
  const freq = keywordFrequency(texts);
  const keywords = topKeywords(texts, 8);

  // scored sentences (keyword density, normalized by length)
  const sentences = segments.flatMap((s) =>
    splitSentences(s.text).map((sentence) => ({ sentence, segment: s })),
  );
  const scored = sentences
    .map(({ sentence, segment }) => {
      const words = tokenize(sentence);
      const score = words.reduce((a, w) => a + (freq.get(w) ?? 0), 0) / Math.sqrt(words.length + 1);
      return { sentence, segment, score };
    })
    .sort((a, b) => b.score - a.score);

  // overview — assembled from top keywords + the two strongest sentences
  const durationMin = Math.round(((segments.at(-1)?.end_ms ?? 0) / 60000) || 1);
  const kw = keywords.slice(0, 4);
  const overview =
    `The ${durationMin}-minute ${template === "sales" ? "call" : "meeting"} covered ${kw.join(", ")}. ` +
    [scored[0], scored[1]]
      .filter(Boolean)
      .map((s) => cleanSentence(s.sentence))
      .join(" ");

  // notes — top sentences, at most one per speaker per 5-minute window
  const seen = new Set<string>();
  const notes: { text: string; timestamp_ms: number | null; end_timestamp_ms: null; source_segment_id: number | null }[] = [];
  for (const { sentence, segment } of scored) {
    const key = `${segment.speaker_id}:${Math.floor(segment.start_ms / 300_000)}`;
    if (seen.has(key) || notes.length >= 6) continue;
    seen.add(key);
    notes.push({ text: cleanSentence(sentence), timestamp_ms: null, end_timestamp_ms: null, source_segment_id: segment.id });
  }

  // topics — 5-minute windows, titled by the window's top keywords
  const topics: GeneratedSummary["sections"][number]["items"] = [];
  const WINDOW = 5 * 60_000;
  let wStart = segments[0].start_ms;
  while (wStart < (segments.at(-1)?.end_ms ?? 0)) {
    const win = segments.filter((s) => s.start_ms >= wStart && s.start_ms < wStart + WINDOW);
    if (win.length > 0) {
      const [a, b] = topKeywords(win.map((s) => s.text), 2);
      const title = capitalize([a, b].filter(Boolean).join(" & "));
      const last = topics.at(-1);
      if (last && last.text === title && last.end_timestamp_ms) {
        last.end_timestamp_ms = win.at(-1)!.end_ms;
      } else {
        topics.push({
          text: title || "Discussion",
          timestamp_ms: win[0].start_ms,
          end_timestamp_ms: win.at(-1)!.end_ms,
          source_segment_id: win[0].id,
        });
      }
    }
    wStart += WINDOW;
  }

  // metrics — extract the numeric fragment ± context words
  const metrics: GeneratedSummary["sections"][number]["items"] = [];
  const seenMetric = new Set<string>();
  for (const seg of segments) {
    if (!METRIC_RE.test(seg.text)) continue;
    const words = seg.text.split(/\s+/);
    const idx = words.findIndex((w) => /^[$\d]/.test(w) && /\d/.test(w));
    const from = Math.max(0, idx - 4);
    const to = Math.min(words.length, idx + 5);
    const text = words.slice(from, to).join(" ").replace(/[.,]$/, "");
    if (!text || seenMetric.has(text)) continue;
    seenMetric.add(text);
    metrics.push({ text, timestamp_ms: seg.start_ms, end_timestamp_ms: null, source_segment_id: seg.id });
  }

  // action items — task-rule segments, assignee = speaker for first-person commits
  const FIRST_PERSON = /\b(i'll|i will|i can|i need to|i'm going to|i have to)\b/i;
  const seenAction = new Set<string>();
  const action_items: GeneratedSummary["action_items"] = [];
  for (const seg of segments) {
    if (!TASK_RE.test(seg.text) || !FIRST_PERSON.test(seg.text)) continue;
    const description = cleanSentence(
      seg.text
        .replace(/^.*?\b(i'll|i will|i can|i need to|i'm going to|i have to)\b\s*/i, "")
        .replace(/\s+/g, " ")
        .trim(),
    );
    const key = description.toLowerCase().slice(0, 48);
    if (!description || description.length < 12 || seenAction.has(key)) continue;
    seenAction.add(key);
    action_items.push({ description, assignee_id: seg.speaker_id, source_segment_id: seg.id, status: "open" });
  }

  const headings = TEMPLATE_HEADINGS[template];
  return {
    template,
    generated_by: "rules",
    sections: [
      { section_type: "overview", heading: "Overview", items: [{ text: overview, timestamp_ms: segments[0].start_ms, end_timestamp_ms: null, source_segment_id: segments[0].id }] },
      { section_type: "notes", heading: headings.notes, items: notes },
      { section_type: "topics", heading: headings.topics, items: topics },
      { section_type: "metrics", heading: "Metrics", items: metrics.slice(0, 8) },
    ],
    action_items: action_items.slice(0, 6),
  };
}

// ---------- AskFred (LLD §5.4 — retrieval fallback with citations) ----------

export interface AnswerContext {
  db: MockDb;
  meetingId: number | null; // null = global, across all meetings
}

function quote(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 140 ? `${t.slice(0, 140)}…` : t;
}

function citation(db: MockDb, seg: DbSegment): ChatCitation {
  const meeting = db.meetings.find((m) => m.id === seg.meeting_id)!;
  const speaker = db.participants.find((p) => p.id === seg.speaker_id);
  return {
    meeting_id: seg.meeting_id,
    meeting_title: meeting.title,
    segment_id: seg.id,
    start_ms: seg.start_ms,
    speaker: speaker?.name ?? "Unknown",
    quote: quote(seg.text),
  };
}

function scopeSegments(ctx: AnswerContext): DbSegment[] {
  const segments = ctx.db.segments.filter((s) => {
    if (ctx.meetingId != null) return s.meeting_id === ctx.meetingId;
    const m = ctx.db.meetings.find((mm) => mm.id === s.meeting_id);
    return m && !m.is_deleted && m.status === "ready";
  });
  return segments.sort((a, b) => a.meeting_id - b.meeting_id || a.start_ms - b.start_ms);
}

function contentWords(q: string): string[] {
  return tokenize(q).filter((w) => !STOPWORDS.has(w));
}

export function answerQuestion(question: string, ctx: AnswerContext): { answer: string; citations: ChatCitation[] } {
  const { db } = ctx;
  const segments = scopeSegments(ctx);
  const meeting = ctx.meetingId != null ? db.meetings.find((m) => m.id === ctx.meetingId) : null;
  const scopedName = meeting ? meeting.title : null;

  if (segments.length === 0) {
    return {
      answer: scopedName
        ? "This meeting doesn't have a transcript yet, so I can't answer questions about it."
        : "There are no processed meetings yet — once you have transcripts, ask me anything about them.",
      citations: [],
    };
  }

  const q = question.trim();
  const ql = q.toLowerCase();

  // intent: action items / todos
  if (/action item|to-?do|\btasks?\b|next steps/i.test(ql)) {
    const items = db.action_items.filter(
      (a) => (ctx.meetingId != null ? a.meeting_id === ctx.meetingId : true) && !/next steps/i.test(ql ? ql : ""),
    );
    const openItems = items.filter((a) => a.status !== "done");
    const list = (/next steps/i.test(ql) ? openItems : items).slice(0, 8);
    if (list.length === 0) {
      return { answer: "No action items were captured for this scope.", citations: [] };
    }
    const lines = list.map((a) => {
      const assignee = db.participants.find((p) => p.id === a.assignee_id)?.name ?? "Unassigned";
      const mark = a.status === "done" ? "✓" : a.status === "in_progress" ? "…" : "•";
      return `${mark} ${a.description} — ${assignee}${a.status === "done" ? " (done)" : ""}`;
    });
    const cites = list
      .map((a) => db.segments.find((s) => s.id === a.source_segment_id))
      .filter((s): s is DbSegment => !!s)
      .map((s) => citation(db, s));
    return {
      answer: `Here are the ${/next steps/i.test(ql) ? "next steps" : "action items"} I found:\n${lines.join("\n")}`,
      citations: cites,
    };
  }

  // intent: key takeaways / summary
  if (/takeaway|summar|overview|recap|what.*(?:about|discuss)/i.test(ql)) {
    const summaryMeeting = meeting ?? db.meetings.find((m) => !m.is_deleted && m.status === "ready");
    if (!summaryMeeting) return { answer: "No processed meetings to summarize yet.", citations: [] };
    const summary = db.summaries.find((s) => s.meeting_id === summaryMeeting.id);
    const overview =
      db.summary_sections
        .filter((sec) => sec.summary_id === summary?.id && sec.section_type === "overview")
        .flatMap((sec) => db.summary_items.filter((i) => i.section_id === sec.id))
        .map((i) => i.text)[0] ?? null;
    const notes =
      db.summary_sections
        .filter((sec) => sec.summary_id === summary?.id && sec.section_type === "notes")
        .flatMap((sec) => db.summary_items.filter((i) => i.section_id === sec.id))
        .map((i) => i.text)
        .slice(0, 4) ?? [];
    const generated = overview ? null : generateSummary(
      db.segments.filter((s) => s.meeting_id === summaryMeeting.id),
      db.participants.filter((p) => p.meeting_id === summaryMeeting.id),
    );
    const overviewText = overview ?? generated?.sections.find((s) => s.section_type === "overview")?.items[0]?.text ?? "";
    const bullets = notes.length ? notes : generated?.sections.find((s) => s.section_type === "notes")?.items.map((i) => i.text).slice(0, 4) ?? [];
    const firstSegs = db.segments
      .filter((s) => s.meeting_id === summaryMeeting.id)
      .sort((a, b) => a.start_ms - b.start_ms)
      .slice(0, 2);
    return {
      answer:
        `Key takeaways from "${summaryMeeting.title}":\n${overviewText}` +
        (bullets.length ? `\n\nHighlights:\n${bullets.map((b) => `• ${b}`).join("\n")}` : ""),
      citations: firstSegs.map((s) => citation(db, s)),
    };
  }

  // intent: when was X discussed
  const whenMatch = q.match(/when (?:was|is|did)\s+(.+?)\s+(?:discuss|mention|come up|talk(?:ed)? about|raise)/i);
  if (whenMatch) {
    const topic = whenMatch[1].replace(/^(the|a|an)\s+/i, "");
    const words = contentWords(topic);
    const hits = segments.filter((s) => {
      const tl = s.text.toLowerCase();
      return words.length ? words.some((w) => tl.includes(w)) : tl.includes(topic.toLowerCase());
    });
    if (hits.length === 0) {
      return { answer: `I couldn't find "${topic}" in ${scopedName ? "this meeting" : "your meetings"}.`, citations: [] };
    }
    const first = hits[0];
    const speaker = db.participants.find((p) => p.id === first.speaker_id)?.name ?? "Someone";
    const others = hits.slice(1, 3).map((s) => {
      const sp = db.participants.find((p) => p.id === s.speaker_id)?.name ?? "someone";
      return `${sp} brought it up again at ${msToClock(s.start_ms)}`;
    });
    const scoped = scopedName ? `In "${scopedName}", ${topic}` : `${capitalize(topic)}`;
    return {
      answer:
        `${scoped} first came up at ${msToClock(first.start_ms)}, when ${speaker} said: "${quote(first.text)}"` +
        (others.length ? `. ${others.join(", and ")}.` : ` — it came up ${hits.length === 1 ? "once" : `${hits.length} times`}.`),
      citations: hits.slice(0, 3).map((s) => citation(db, s)),
    };
  }

  // intent: who said X
  const whoMatch = q.match(/who said\s+(.+)/i);
  if (whoMatch) {
    const phrase = whoMatch[1].replace(/["'.?!]+$/g, "");
    const hits = segments.filter((s) => s.text.toLowerCase().includes(phrase.toLowerCase()));
    if (hits.length === 0) {
      return { answer: `Nobody in ${scopedName ? "this meeting" : "your meetings"} said "${phrase}".`, citations: [] };
    }
    const bySpeaker = new Map<string, DbSegment[]>();
    for (const s of hits) {
      const name = db.participants.find((p) => p.id === s.speaker_id)?.name ?? "Unknown";
      bySpeaker.set(name, [...(bySpeaker.get(name) ?? []), s]);
    }
    const lines = [...bySpeaker.entries()].map(
      ([name, segs]) => `${name} — ${segs.length}×, first at ${msToClock(segs[0].start_ms)}: "${quote(segs[0].text)}"`,
    );
    return { answer: `"${phrase}" came from:\n${lines.join("\n")}`, citations: hits.slice(0, 3).map((s) => citation(db, s)) };
  }

  // intent: how long / duration
  if (/how long|duration|talk.?time/i.test(ql)) {
    const stats = computeStats(db, meeting?.id ?? segments[0].meeting_id);
    const dur = meeting?.duration_seconds ?? db.meetings.find((m) => m.id === segments[0].meeting_id)?.duration_seconds ?? 0;
    const split = stats.speakers
      .slice(0, 4)
      .map((s) => `${s.name} ${s.talk_time_pct}% (${Math.round(s.talk_time_ms / 60000)} min)`)
      .join(", ");
    return {
      answer: `${scopedName ? `"${scopedName}" ran` : "That meeting ran"} ${Math.round(dur / 60)} minutes. Talk-time split: ${split}.`,
      citations: segments.slice(0, 1).map((s) => citation(db, s)),
    };
  }

  // general retrieval — keyword-scored segments, top 3
  const qWords = contentWords(q);
  const ranked = segments
    .map((s) => {
      const tl = s.text.toLowerCase();
      const score = qWords.reduce((a, w) => a + (tl.includes(w) ? 1 : 0), 0);
      return { s, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.s.start_ms - b.s.start_ms)
    .slice(0, 3);

  if (ranked.length === 0) {
    return {
      answer: `I couldn't find anything about that in ${scopedName ? "this meeting" : "your meetings"}. Try naming a topic, a person, or a number.`,
      citations: [],
    };
  }

  const lines = ranked.map(({ s }) => {
    const speaker = db.participants.find((p) => p.id === s.speaker_id)?.name ?? "Unknown";
    const from = ctx.meetingId == null ? ` (${s.meeting_id !== ranked[0].s.meeting_id ? db.meetings.find((m) => m.id === s.meeting_id)?.title : ""})` : "";
    return `• ${speaker}, ${msToClock(s.start_ms)}${from}: "${quote(s.text)}"`;
  });
  return {
    answer: `Here's what I found:\n${lines.join("\n")}`,
    citations: ranked.map(({ s }) => citation(db, s)),
  };
}

// ---------- exports (LLD §5.7) ----------

export function exportMeeting(
  db: MockDb,
  meeting: DbMeeting,
  format: ExportFormat,
): ExportResult {
  const participants = db.participants.filter((p) => p.meeting_id === meeting.id);
  const segments = db.segments
    .filter((s) => s.meeting_id === meeting.id)
    .sort((a, b) => a.start_ms - b.start_ms);
  const summary = db.summaries.find((s) => s.meeting_id === meeting.id);
  const sections = summary ? db.summary_sections.filter((sec) => sec.summary_id === summary.id).sort((a, b) => a.order_index - b.order_index) : [];
  const items = (secId: number) => db.summary_items.filter((i) => i.section_id === secId).sort((a, b) => a.order_index - b.order_index);
  const actions = db.action_items.filter((a) => a.meeting_id === meeting.id);
  const nameOf = (id: number | null) => participants.find((p) => p.id === id)?.name ?? "Unknown";
  const date = new Date(meeting.meeting_date).toUTCString();
  const base = slugify(meeting.title);

  if (format === "json") {
    return {
      filename: `${base}.json`,
      mime: "application/json",
      content: JSON.stringify({ meeting, participants, summary: { ...summary, sections: sections.map((sec) => ({ ...sec, items: items(sec.id) })) }, action_items: actions, transcript: segments }, null, 2),
    };
  }

  if (format === "srt" || format === "vtt") {
    const cues = segments
      .map((s, i) => {
        const tc = format === "srt" ? msToSrt(s.start_ms) : msToVtt(s.start_ms);
        const te = format === "srt" ? msToSrt(s.end_ms) : msToVtt(s.end_ms);
        return `${i + 1}\n${tc} --> ${te}\n${nameOf(s.speaker_id)}: ${s.text}\n`;
      })
      .join("\n");
    const header = format === "vtt" ? "WEBVTT\n\n" : "";
    return { filename: `${base}.${format}`, mime: "text/plain", content: header + cues };
  }

  const summaryText =
    sections
      .map((sec) => {
        const lines = items(sec.id)
          .map((i) => (sec.section_type === "overview" ? i.text : `- ${i.text}${i.timestamp_ms != null ? ` (${msToClock(i.timestamp_ms)})` : ""}`))
          .join("\n");
        return `${sec.heading.toUpperCase()}\n${lines}`;
      })
      .join("\n\n") +
    (actions.length
      ? `\n\nACTION ITEMS\n${actions
          .map((a) => `- [${a.status === "done" ? "x" : " "}] ${a.description} — ${nameOf(a.assignee_id)}`)
          .join("\n")}`
      : "");

  if (format === "md") {
    const transcriptMd = segments
      .map((s) => `**${nameOf(s.speaker_id)}** \`${msToClock(s.start_ms)}\`\n\n${s.text}\n`)
      .join("\n");
    return {
      filename: `${base}.md`,
      mime: "text/markdown",
      content: `# ${meeting.title}\n\n_${date} · ${Math.round((meeting.duration_seconds ?? 0) / 60)} min · ${participants.map((p) => p.name).join(", ")}_\n\n## Summary\n\n${summaryText}\n\n## Transcript\n\n${transcriptMd}`,
    };
  }

  // txt (+ pdf placeholder: the UI print-renders PDF in Phase 7)
  const transcriptTxt = segments
    .map((s) => `[${msToClock(s.start_ms)}] ${nameOf(s.speaker_id)}: ${s.text}`)
    .join("\n");
  return {
    filename: `${base}.${format}`,
    mime: "text/plain",
    content: `${meeting.title}\n${date} · ${Math.round((meeting.duration_seconds ?? 0) / 60)} min\nParticipants: ${participants.map((p) => p.name).join(", ")}\n\n${summaryText}\n\nTRANSCRIPT\n\n${transcriptTxt}`,
  };
}
