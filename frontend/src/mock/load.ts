/**
 * Fixture loader — parses the compact fixture format (shared/fixtures/README.md)
 * into the normalized in-memory db shape. The Python seeder (Phase 5) mirrors
 * these exact rules so the same fixtures produce the same database.
 *
 * Computed here (never authored in fixtures): ids, speaker colors, *_ms
 * timestamps, talk-time/word stats, duration, anchor resolution ("at" →
 * source_segment_id / citations), assignee resolution.
 */

import type { ChatCitation, MeetingSource, MeetingStatus, SummarySectionType } from "@/lib/types";
import { FIXTURES, type FixtureMeeting } from "./fixtures";

// ---------- speaker palette (docs/01 §3) ----------

export const SPEAKER_PALETTE = [
  "#ff6fb5",
  "#ffa94d",
  "#ffd43b",
  "#63e6be",
  "#74c0fc",
  "#b197fc",
  "#f783ac",
  "#38d9a9",
  "#e599f7",
  "#ff8787",
];

const TAG_COLORS: Record<string, string> = {
  sales: "#f783ac",
  pricing: "#ffd43b",
  engineering: "#74c0fc",
  product: "#b197fc",
  marketing: "#ff6fb5",
  research: "#63e6be",
  launch: "#ffa94d",
  "1:1": "#38d9a9",
  retro: "#ff8787",
  investors: "#e599f7",
};
const TAG_FALLBACK_COLOR = "#8b7cff";

// ---------- db rows ----------

export interface DbMeeting {
  id: number;
  title: string;
  description: string | null;
  meeting_date: string;
  duration_seconds: number | null;
  status: MeetingStatus;
  source: MeetingSource;
  channel: string | null;
  language: string;
  host_id: number;
  media_url: string | null;
  media_type: "audio" | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbParticipant {
  id: number;
  meeting_id: number;
  name: string;
  email: string | null;
  avatar_color: string;
  is_host: boolean;
  talk_time_ms: number;
  word_count: number;
}

export interface DbSegment {
  id: number;
  meeting_id: number;
  speaker_id: number | null;
  start_ms: number;
  end_ms: number;
  text: string;
  is_edited: boolean;
  order_index: number;
}

export interface DbSummary {
  id: number;
  meeting_id: number;
  template: string;
  generated_by: string;
}

export interface DbSummarySection {
  id: number;
  summary_id: number;
  section_type: SummarySectionType;
  heading: string;
  order_index: number;
}

export interface DbSummaryItem {
  id: number;
  section_id: number;
  text: string;
  timestamp_ms: number | null;
  end_timestamp_ms: number | null;
  source_segment_id: number | null;
  order_index: number;
}

export interface DbActionItem {
  id: number;
  meeting_id: number;
  description: string;
  assignee_id: number | null;
  status: "open" | "in_progress" | "done";
  due_date: string | null;
  source_segment_id: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbComment {
  id: number;
  meeting_id: number;
  segment_id: number | null;
  user_name: string;
  body: string;
  created_at: string;
}

export interface DbBookmark {
  id: number;
  meeting_id: number;
  segment_id: number | null;
  label: string | null;
  created_at: string;
}

export interface DbSoundbite {
  id: number;
  meeting_id: number;
  title: string;
  start_ms: number;
  end_ms: number;
  created_at: string;
}

export interface DbChatMessage {
  id: number;
  meeting_id: number | null;
  role: "user" | "assistant";
  content: string;
  citations: ChatCitation[] | null;
  created_at: string;
}

export interface MockDb {
  user: { id: number; name: string; email: string; avatar_color: string };
  settings: {
    theme: "dark" | "light";
    default_summary_template: string;
    default_playback_speed: number;
    auto_join_meetings: boolean;
    send_recaps_to: string;
  };
  meetings: DbMeeting[];
  participants: DbParticipant[];
  segments: DbSegment[];
  summaries: DbSummary[];
  summary_sections: DbSummarySection[];
  summary_items: DbSummaryItem[];
  action_items: DbActionItem[];
  comments: DbComment[];
  bookmarks: DbBookmark[];
  soundbites: DbSoundbite[];
  chat_messages: DbChatMessage[];
  tags: { name: string; color: string }[];
  meeting_tags: { meeting_id: number; tag_name: string }[];
  seq: {
    meetings: number;
    participants: number;
    segments: number;
    summaries: number;
    summary_sections: number;
    summary_items: number;
    action_items: number;
    comments: number;
    bookmarks: number;
    soundbites: number;
    chat_messages: number;
  };
}

// ---------- parsing helpers (mirrored by the Python seeder) ----------

/** "14:32" or "1:02:03" → milliseconds. */
export function parseTimecode(tc: string): number {
  const parts = tc.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return NaN;
  if (parts.length === 3) return ((parts[0] * 60 + parts[1]) * 60 + parts[2]) * 1000;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  return NaN;
}

const LINE_RE = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+([^:]{1,40}):\s*(.+)$/;

/** One "mm:ss Name: text" line → { startMs, speaker, text }. */
export function parseTranscriptLine(line: string) {
  const m = line.trim().match(LINE_RE);
  if (!m) return null;
  const startMs = parseTimecode(m[1]);
  if (Number.isNaN(startMs)) return null;
  return { startMs, speaker: m[2].trim(), text: m[3].trim() };
}

/** Duration estimate for an utterance: ~380ms per word + 600ms overhead. */
export function estimateDurationMs(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.min(30_000, 600 + words * 380);
}

/**
 * Parse raw transcript lines → utterances with start/end ms.
 * Sorted by time; ends clamped just before the next line (150ms gap).
 */
export function parseTranscript(lines: string[]) {
  const parsed = lines
    .map(parseTranscriptLine)
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => a.startMs - b.startMs);
  return parsed.map((p, i) => {
    const next = parsed[i + 1];
    const est = p.startMs + estimateDurationMs(p.text);
    const endMs = next ? Math.max(p.startMs + 1200, Math.min(est, next.startMs - 150)) : est;
    return { ...p, endMs };
  });
}

// ---------- loader ----------

export function loadDb(): MockDb {
  const db: MockDb = {
    user: { id: 1, name: "Vishesh Gupta", email: "vishesh@northstar.io", avatar_color: "#8b7cff" },
    settings: {
      theme: "dark",
      default_summary_template: "general",
      default_playback_speed: 1,
      auto_join_meetings: true,
      send_recaps_to: "everyone",
    },
    meetings: [],
    participants: [],
    segments: [],
    summaries: [],
    summary_sections: [],
    summary_items: [],
    action_items: [],
    comments: [],
    bookmarks: [],
    soundbites: [],
    chat_messages: [],
    tags: [],
    meeting_tags: [],
    seq: {
      meetings: 0,
      participants: 0,
      segments: 0,
      summaries: 0,
      summary_sections: 0,
      summary_items: 0,
      action_items: 0,
      comments: 0,
      bookmarks: 0,
      soundbites: 0,
      chat_messages: 0,
    },
  };

  const tagColor = (name: string) => TAG_COLORS[name.toLowerCase()] ?? TAG_FALLBACK_COLOR;
  const ensureTag = (name: string) => {
    if (!db.tags.some((t) => t.name === name)) db.tags.push({ name, color: tagColor(name) });
    return name;
  };

  for (const fx of FIXTURES) {
    loadFixtureMeeting(db, fx, ensureTag);
  }
  return db;
}

function loadFixtureMeeting(db: MockDb, fx: FixtureMeeting, ensureTag: (n: string) => string) {
  const meetingId = ++db.seq.meetings;
  const hasTranscript = (fx.transcript?.length ?? 0) > 0;
  const status: MeetingStatus = fx.status ?? (hasTranscript ? "ready" : "scheduled");

  // participants (colors from the palette, in fixture order)
  const participants = fx.participants.map((p, i) => {
    const id = ++db.seq.participants;
    return {
      id,
      meeting_id: meetingId,
      name: p.name,
      email: p.email ?? null,
      avatar_color: SPEAKER_PALETTE[i % SPEAKER_PALETTE.length],
      is_host: p.host ?? false,
      talk_time_ms: 0,
      word_count: 0,
    };
  });
  db.participants.push(...participants);
  const host = participants.find((p) => p.is_host) ?? participants[0];

  // transcript segments
  let durationMs = 0;
  const segments: DbSegment[] = [];
  if (hasTranscript) {
    const utterances = parseTranscript(fx.transcript!);
    utterances.forEach((u, i) => {
      const speaker = participants.find((p) => p.name === u.speaker);
      segments.push({
        id: ++db.seq.segments,
        meeting_id: meetingId,
        speaker_id: speaker?.id ?? null,
        start_ms: u.startMs,
        end_ms: u.endMs,
        text: u.text,
        is_edited: false,
        order_index: i,
      });
    });
    db.segments.push(...segments);
    durationMs = (segments.at(-1)?.end_ms ?? 0) + 2000;
    recomputeParticipantStats(db, meetingId);
  }

  db.meetings.push({
    id: meetingId,
    title: fx.title,
    description: fx.description ?? null,
    meeting_date: fx.meeting_date,
    duration_seconds: hasTranscript ? Math.round(durationMs / 1000) : null,
    status,
    source: fx.source ?? "seed",
    channel: fx.channel ?? "My Meetings",
    language: fx.language ?? "en",
    host_id: host?.id ?? 0,
    // Mock phase: no real audio files — the player's virtual clock drives
    // playback until the backend's generated WAVs land (Phase 7).
    media_url: null,
    media_type: hasTranscript ? "audio" : null,
    is_deleted: false,
    created_at: fx.meeting_date,
    updated_at: fx.meeting_date,
  });

  // tags
  for (const t of fx.tags ?? []) db.meeting_tags.push({ meeting_id: meetingId, tag_name: ensureTag(t) });

  const segmentAt = (at: string): DbSegment | null => {
    const ms = parseTimecode(at);
    if (Number.isNaN(ms)) return null;
    return segments.find((s) => s.start_ms <= ms && ms <= s.end_ms) ?? null;
  };

  // summary → sections/items (action items feed their own table, not sections)
  const summary = fx.summary;
  if (summary && hasTranscript) {
    const summaryId = ++db.seq.summaries;
    db.summaries.push({
      id: summaryId,
      meeting_id: meetingId,
      template: summary.template ?? "general",
      generated_by: "seed",
    });

    const addSection = (type: SummarySectionType, heading: string, items: Omit<DbSummaryItem, "id" | "section_id" | "order_index">[]) => {
      if (items.length === 0) return;
      const sectionId = ++db.seq.summary_sections;
      db.summary_sections.push({
        id: sectionId,
        summary_id: summaryId,
        section_type: type,
        heading,
        order_index: db.summary_sections.filter((s) => s.summary_id === summaryId).length,
      });
      items.forEach((item, i) => {
        db.summary_items.push({
          id: ++db.seq.summary_items,
          section_id: sectionId,
          order_index: i,
          ...item,
        });
      });
    };

    addSection("overview", "Overview", [{ text: summary.overview, timestamp_ms: null, end_timestamp_ms: null, source_segment_id: segments[0]?.id ?? null }]);

    addSection(
      "notes",
      summary.template === "one_on_one" ? "Wins & notes" : "Notes",
      summary.notes.map((text) => ({ text, timestamp_ms: null, end_timestamp_ms: null, source_segment_id: null })),
    );

    addSection(
      "topics",
      "Topics",
      (summary.topics ?? []).map((t) => {
        const seg = segmentAt(t.at);
        const end = t.end ? parseTimecode(t.end) : null;
        return {
          text: t.text,
          timestamp_ms: seg?.start_ms ?? (Number.isNaN(parseTimecode(t.at)) ? null : parseTimecode(t.at)),
          end_timestamp_ms: end ?? null,
          source_segment_id: seg?.id ?? null,
        };
      }),
    );

    addSection(
      "metrics",
      "Metrics",
      (summary.metrics ?? []).map((m) => {
        const seg = m.at ? segmentAt(m.at) : null;
        return {
          text: m.text,
          timestamp_ms: seg?.start_ms ?? null,
          end_timestamp_ms: null,
          source_segment_id: seg?.id ?? null,
        };
      }),
    );

    // action items → own table (assignee = the committing speaker)
    for (const ai of summary.action_items ?? []) {
      const seg = segmentAt(ai.at);
      const assignee = participants.find((p) => p.name === ai.speaker);
      db.action_items.push({
        id: ++db.seq.action_items,
        meeting_id: meetingId,
        description: ai.text,
        assignee_id: assignee?.id ?? null,
        status: ai.status ?? "open",
        due_date: ai.due ?? null,
        source_segment_id: seg?.id ?? null,
        completed_at: (ai.status ?? "open") === "done" ? fx.meeting_date : null,
        created_at: fx.meeting_date,
        updated_at: fx.meeting_date,
      });
    }
  }

  // comments / bookmarks / soundbites (anchors resolved)
  for (const c of fx.comments ?? []) {
    db.comments.push({
      id: ++db.seq.comments,
      meeting_id: meetingId,
      segment_id: c.at ? segmentAt(c.at)?.id ?? null : null,
      user_name: c.by,
      body: c.body,
      created_at: fx.meeting_date,
    });
  }
  for (const b of fx.bookmarks ?? []) {
    db.bookmarks.push({
      id: ++db.seq.bookmarks,
      meeting_id: meetingId,
      segment_id: segmentAt(b.at)?.id ?? null,
      label: b.label ?? null,
      created_at: fx.meeting_date,
    });
  }
  for (const sb of fx.soundbites ?? []) {
    db.soundbites.push({
      id: ++db.seq.soundbites,
      meeting_id: meetingId,
      title: sb.title,
      start_ms: parseTimecode(sb.at),
      end_ms: parseTimecode(sb.end),
      created_at: fx.meeting_date,
    });
  }

  // chat thread — seeded user questions get engine-generated assistant replies
  // appended by the store on load (see store.ts), so citations stay live.
  for (const entry of fx.chat ?? []) {
    db.chat_messages.push({
      id: ++db.seq.chat_messages,
      meeting_id: meetingId,
      role: entry.role,
      content: entry.content,
      citations: null,
      created_at: fx.meeting_date,
    });
  }
}

/** Recompute talk time + word count per participant from segments. */
export function recomputeParticipantStats(db: MockDb, meetingId: number) {
  const participants = db.participants.filter((p) => p.meeting_id === meetingId);
  const segments = db.segments.filter((s) => s.meeting_id === meetingId);
  for (const p of participants) {
    const own = segments.filter((s) => s.speaker_id === p.id);
    p.talk_time_ms = own.reduce((acc, s) => acc + (s.end_ms - s.start_ms), 0);
    p.word_count = own.reduce((acc, s) => acc + s.text.split(/\s+/).filter(Boolean).length, 0);
  }
}
