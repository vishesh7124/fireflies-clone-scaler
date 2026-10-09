/**
 * Mock store — the in-memory database the mock API talks to.
 *
 * - Seeds from fixtures on first load (load.ts)
 * - Persists every mutation to localStorage so the app feels real
 *   (creates, edits, completed action items, chat… survive refresh)
 * - Simulates the real backend's async "processing → ready" flow when a
 *   meeting is created from a pasted transcript
 * - Resolves seeded AskFred questions through the engine on first access
 *
 * Reset from Settings → Danger zone (reseed) or by bumping FIXTURES_VERSION.
 */

import { FIXTURES_VERSION } from "./fixtures";
import { loadDb, parseTranscript, recomputeParticipantStats, type MockDb } from "./load";
import { answerQuestion, generateSummary } from "./engine";

const STORAGE_KEY = "fireflies-mock-db";

let db: MockDb = loadDb();

if (typeof window !== "undefined") {
  hydrate();
}

function save() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: FIXTURES_VERSION, db }));
  } catch {
    // storage full/blocked — the app still works, just without persistence
  }
}

function hydrate() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return finishBoot();
    const parsed = JSON.parse(raw) as { version: number; db: MockDb };
    if (parsed.version === FIXTURES_VERSION && Array.isArray(parsed.db?.meetings)) {
      db = parsed.db;
    }
  } catch {
    // corrupted cache — fall through to a fresh seed
  }
  finishBoot();
}

/** Seed-time fixups that need the engine (kept out of load.ts to avoid a cycle). */
function finishBoot() {
  // seeded chat threads: answer any unanswered user questions so the thread
  // reads like a real conversation with live citations
  const byMeeting = new Set(
    db.chat_messages.filter((m) => m.role === "assistant").map((m) => m.meeting_id),
  );
  for (const meetingId of new Set(db.chat_messages.map((m) => m.meeting_id))) {
    const thread = db.chat_messages.filter((m) => m.meeting_id === meetingId);
    const last = thread.at(-1);
    if (last?.role === "user" && !byMeeting.has(meetingId)) {
      const answer = answerQuestion(last.content, { db, meetingId });
      db.chat_messages.push({
        id: ++db.seq.chat_messages,
        meeting_id: meetingId,
        role: "assistant",
        content: answer.answer,
        citations: answer.citations,
        created_at: last.created_at,
      });
    }
  }
  save();
}

export function getDb(): MockDb {
  return db;
}

/** Wipe local state and reseed from fixtures (Settings → Danger zone). */
export function resetDb(): MockDb {
  db = loadDb();
  finishBoot();
  return db;
}

// ---------- meetings ----------

export function createMeetingRecord(input: {
  title: string;
  meeting_date: string;
  description?: string;
  channel?: string;
  participants: { name: string; email?: string }[];
  transcript_text?: string;
}): number {
  const meetingId = ++db.seq.meetings;
  const hasTranscript = !!input.transcript_text?.trim();

  db.meetings.push({
    id: meetingId,
    title: input.title,
    description: input.description ?? null,
    meeting_date: input.meeting_date,
    duration_seconds: null,
    status: hasTranscript ? "processing" : "scheduled",
    source: hasTranscript ? "paste" : "schedule",
    channel: input.channel ?? "My Meetings",
    language: "en",
    host_id: 0,
    media_url: null,
    media_type: hasTranscript ? "audio" : null,
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // uploaded/scheduled meetings with no named participants default to the user
  const named = input.participants.length > 0 ? input.participants : [{ name: db.user.name }];
  const participants = named.map((p, i) => ({
    id: ++db.seq.participants,
    meeting_id: meetingId,
    name: p.name,
    email: p.email ?? null,
    avatar_color: ["#ff6fb5", "#ffa94d", "#ffd43b", "#63e6be", "#74c0fc", "#b197fc", "#f783ac", "#38d9a9", "#e599f7", "#ff8787"][i % 10],
    is_host: i === 0,
    talk_time_ms: 0,
    word_count: 0,
  }));
  db.participants.push(...participants);
  const meeting = db.meetings.find((m) => m.id === meetingId)!;
  meeting.host_id = participants[0]?.id ?? 0;

  if (hasTranscript) {
    importLines(meetingId, input.transcript_text!);
  }
  save();
  return meetingId;
}

/** Insert parsed "mm:ss Name: text" lines as segments (unknown speakers get added). */
function importLines(meetingId: number, transcriptText: string) {
  const lines = transcriptText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const utterances = parseTranscript(lines);
  utterances.forEach((u, i) => {
    let speaker = db.participants.find(
      (p) => p.meeting_id === meetingId && p.name.toLowerCase() === u.speaker.toLowerCase(),
    );
    if (!speaker) {
      speaker = {
        id: ++db.seq.participants,
        meeting_id: meetingId,
        name: u.speaker,
        email: null,
        avatar_color: ["#ff6fb5", "#ffa94d", "#ffd43b", "#63e6be", "#74c0fc", "#b197fc", "#f783ac", "#38d9a9", "#e599f7", "#ff8787"][db.participants.filter((p) => p.meeting_id === meetingId).length % 10],
        is_host: false,
        talk_time_ms: 0,
        word_count: 0,
      };
      db.participants.push(speaker);
    }
    db.segments.push({
      id: ++db.seq.segments,
      meeting_id: meetingId,
      speaker_id: speaker.id,
      start_ms: u.startMs,
      end_ms: u.endMs,
      text: u.text,
      is_edited: false,
      order_index: i,
    });
  });
  recomputeParticipantStats(db, meetingId);
}

/**
 * Simulated AI processing — the real backend runs this as a BackgroundTask:
 * generate the rules-based summary + action items, flip status to ready.
 */
export function finishProcessing(meetingId: number) {
  const meeting = db.meetings.find((m) => m.id === meetingId);
  if (!meeting || meeting.status === "ready") return;
  const participants = db.participants.filter((p) => p.meeting_id === meetingId);
  const segments = db.segments.filter((s) => s.meeting_id === meetingId);
  if (segments.length === 0) {
    meeting.status = "failed";
    save();
    return;
  }

  const generated = generateSummary(segments, participants, "general");

  const summaryId = ++db.seq.summaries;
  db.summaries.push({ id: summaryId, meeting_id: meetingId, template: "general", generated_by: "rules" });
  for (const section of generated.sections) {
    const sectionId = ++db.seq.summary_sections;
    db.summary_sections.push({
      id: sectionId,
      summary_id: summaryId,
      section_type: section.section_type,
      heading: section.heading,
      order_index: db.summary_sections.filter((s) => s.summary_id === summaryId).length,
    });
    section.items.forEach((item, i) => {
      db.summary_items.push({
        id: ++db.seq.summary_items,
        section_id: sectionId,
        order_index: i,
        ...item,
      });
    });
  }
  for (const ai of generated.action_items) {
    db.action_items.push({
      id: ++db.seq.action_items,
      meeting_id: meetingId,
      description: ai.description,
      assignee_id: ai.assignee_id,
      status: "open",
      due_date: null,
      source_segment_id: ai.source_segment_id,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  meeting.status = "ready";
  meeting.duration_seconds = Math.round(((segments.at(-1)?.end_ms ?? 0) + 2000) / 1000);
  meeting.updated_at = new Date().toISOString();
  save();
}

// ---------- transcript ----------

export function updateSegmentText(segmentId: number, text: string) {
  const seg = db.segments.find((s) => s.id === segmentId);
  if (!seg) return null;
  seg.text = text.trim();
  seg.is_edited = true;
  recomputeParticipantStats(db, seg.meeting_id);
  save();
  return seg;
}

// ---------- summary ----------

export function regenerateSummary(meetingId: number, template: string) {
  const meeting = db.meetings.find((m) => m.id === meetingId);
  if (!meeting) return null;
  const participants = db.participants.filter((p) => p.meeting_id === meetingId);
  const segments = db.segments.filter((s) => s.meeting_id === meetingId);
  const generated = generateSummary(segments, participants, (template as never) ?? "general");

  // replace sections; keep the summary row (or create one)
  let summary = db.summaries.find((s) => s.meeting_id === meetingId);
  if (summary) {
    const oldSections = db.summary_sections.filter((sec) => sec.summary_id === summary!.id);
    for (const sec of oldSections) {
      db.summary_items = db.summary_items.filter((i) => i.section_id !== sec.id);
    }
    db.summary_sections = db.summary_sections.filter((sec) => sec.summary_id !== summary!.id);
    summary.template = generated.template;
    summary.generated_by = "rules";
  } else {
    summary = { id: ++db.seq.summaries, meeting_id: meetingId, template: generated.template, generated_by: "rules" };
    db.summaries.push(summary);
  }
  for (const section of generated.sections) {
    const sectionId = ++db.seq.summary_sections;
    db.summary_sections.push({
      id: sectionId,
      summary_id: summary.id,
      section_type: section.section_type,
      heading: section.heading,
      order_index: db.summary_sections.filter((s) => s.summary_id === summary.id).length,
    });
    section.items.forEach((item, i) => {
      db.summary_items.push({ id: ++db.seq.summary_items, section_id: sectionId, order_index: i, ...item });
    });
  }
  meeting.updated_at = new Date().toISOString();
  save();
  return summary;
}

// ---------- chat ----------

export function appendChat(meetingId: number | null, role: "user" | "assistant", content: string, citations: ReturnType<typeof answerQuestion>["citations"] | null) {
  const msg = {
    id: ++db.seq.chat_messages,
    meeting_id: meetingId,
    role,
    content,
    citations,
    created_at: new Date().toISOString(),
  };
  db.chat_messages.push(msg);
  save();
  return msg;
}

// ---------- generic mutation helpers (used by the mock API) ----------

export function touch(meetingId: number) {
  const m = db.meetings.find((mm) => mm.id === meetingId);
  if (m) m.updated_at = new Date().toISOString();
}

export function nextId(table: keyof MockDb["seq"]): number {
  return ++db.seq[table];
}

export function persist() {
  save();
}
