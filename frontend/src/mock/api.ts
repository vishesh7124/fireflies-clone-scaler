/**
 * Mock API — implements the ApiClient contract against the in-memory store
 * (docs/03 §2). Every response is shaped exactly like the future FastAPI
 * payloads, with simulated latency and the "processing → ready" transition.
 */

import type {
  ActionItem,
  ActionItemInput,
  ActionItemStatus,
  ActionItemUpdate,
  ApiClient,
  ChatMessage,
  ChatResponse,
  Comment,
  CreateMeetingInput,
  ExportFormat,
  ExportResult,
  Meeting,
  MeetingListItem,
  MeetingListParams,
  MeetingStats,
  MeetingStatus,
  Paginated,
  Settings,
  Summary,
  SummaryItem,
  SummaryTemplate,
  Tag,
  Transcript,
  TranscriptSegment,
  UpdateMeetingInput,
  User,
  Bookmark,
  Soundbite,
  SearchResult,
  DashboardData,
  ChatCitation,
} from "@/lib/types";
import { answerQuestion, computeStats, exportMeeting } from "./engine";
import {
  appendChat,
  createMeetingRecord,
  finishProcessing,
  getDb,
  nextId,
  persist,
  regenerateSummary,
  touch,
  updateSegmentText,
} from "./store";
import type { DbMeeting } from "./load";

// ---------- plumbing ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const latency = () => sleep(120 + Math.random() * 160);

function notFound(what: string): never {
  throw new Error(`${what} not found`);
}

// ---------- mappers (db rows → contract shapes) ----------

function tagsFor(meetingId: number): Tag[] {
  const db = getDb();
  return db.meeting_tags
    .filter((mt) => mt.meeting_id === meetingId)
    .map((mt) => db.tags.find((t) => t.name === mt.tag_name))
    .filter((t): t is Tag => !!t);
}

function countsFor(meetingId: number) {
  const db = getDb();
  const items = db.action_items.filter((a) => a.meeting_id === meetingId);
  return {
    open: items.filter((a) => a.status !== "done").length,
    done: items.filter((a) => a.status === "done").length,
  };
}

function toListItem(m: DbMeeting): MeetingListItem {
  const db = getDb();
  const preview = db.segments
    .filter((s) => s.meeting_id === m.id)
    .sort((a, b) => a.start_ms - b.start_ms)[0]?.text ?? null;
  return {
    id: m.id,
    title: m.title,
    meeting_date: m.meeting_date,
    duration_seconds: m.duration_seconds,
    status: m.status,
    source: m.source,
    channel: m.channel,
    language: m.language,
    media_type: m.media_type,
    participants: db.participants
      .filter((p) => p.meeting_id === m.id)
      .map((p) => ({ name: p.name, avatar_color: p.avatar_color })),
    tags: tagsFor(m.id),
    action_item_counts: countsFor(m.id),
    preview,
  };
}

function toDetail(m: DbMeeting): Meeting {
  const db = getDb();
  return {
    ...toListItem(m),
    participants: db.participants
      .filter((p) => p.meeting_id === m.id)
      .map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        avatar_color: p.avatar_color,
        is_host: p.is_host,
        talk_time_ms: p.talk_time_ms,
        word_count: p.word_count,
      })),
    description: m.description,
    host_id: m.host_id,
    media_url: m.media_url,
    counts: {
      comments: db.comments.filter((c) => c.meeting_id === m.id).length,
      bookmarks: db.bookmarks.filter((b) => b.meeting_id === m.id).length,
      soundbites: db.soundbites.filter((s) => s.meeting_id === m.id).length,
    },
    created_at: m.created_at,
    updated_at: m.updated_at,
  };
}

function getMeetingOrThrow(id: number): DbMeeting {
  const m = getDb().meetings.find((mm) => mm.id === id && !mm.is_deleted);
  if (!m) notFound(`Meeting ${id}`);
  return m;
}

function toSegmentRow(segId: number): TranscriptSegment {
  const db = getDb();
  const seg = db.segments.find((s) => s.id === segId)!;
  const speaker = db.participants.find((p) => p.id === seg.speaker_id);
  return {
    id: seg.id,
    meeting_id: seg.meeting_id,
    speaker_id: seg.speaker_id,
    speaker_name: speaker?.name ?? "Unknown",
    avatar_color: speaker?.avatar_color ?? "#8b7cff",
    start_ms: seg.start_ms,
    end_ms: seg.end_ms,
    text: seg.text,
    is_edited: seg.is_edited,
  };
}

function toSummary(meetingId: number): Summary {
  const db = getDb();
  const summary = db.summaries.find((s) => s.meeting_id === meetingId);
  if (!summary) notFound(`Summary for meeting ${meetingId}`);
  const sections = db.summary_sections
    .filter((sec) => sec.summary_id === summary.id)
    .sort((a, b) => a.order_index - b.order_index)
    .map((sec) => ({
      id: sec.id,
      section_type: sec.section_type,
      heading: sec.heading,
      items: db.summary_items
        .filter((i) => i.section_id === sec.id)
        .sort((a, b) => a.order_index - b.order_index)
        .map((i) => ({
          id: i.id,
          text: i.text,
          timestamp_ms: i.timestamp_ms,
          end_timestamp_ms: i.end_timestamp_ms,
          source_segment_id: i.source_segment_id,
        })),
    }));
  return {
    meeting_id: meetingId,
    template: summary.template as Summary["template"],
    generated_by: summary.generated_by as Summary["generated_by"],
    sections,
  };
}

function toActionItem(id: number): ActionItem {
  const db = getDb();
  const a = db.action_items.find((x) => x.id === id)!;
  const meeting = db.meetings.find((m) => m.id === a.meeting_id);
  const assignee = db.participants.find((p) => p.id === a.assignee_id);
  const sourceSeg = db.segments.find((s) => s.id === a.source_segment_id);
  return {
    id: a.id,
    meeting_id: a.meeting_id,
    meeting_title: meeting?.title ?? "",
    description: a.description,
    assignee_id: a.assignee_id,
    assignee_name: assignee?.name ?? null,
    status: a.status,
    due_date: a.due_date,
    source_segment_id: a.source_segment_id,
    source_start_ms: sourceSeg?.start_ms ?? null,
    completed_at: a.completed_at,
    created_at: a.created_at,
    updated_at: a.updated_at,
  };
}

function chatMapper(msg: (ReturnType<typeof getDb>)["chat_messages"][number]): ChatMessage {
  return {
    id: msg.id,
    meeting_id: msg.meeting_id,
    role: msg.role,
    content: msg.content,
    citations: msg.citations,
    created_at: msg.created_at,
  };
}

// ---------- the mock API ----------

export const mockApi: ApiClient = {
  // ----- meta -----

  async getMe(): Promise<User> {
    await latency();
    return getDb().user;
  },

  async getDashboard(): Promise<DashboardData> {
    await latency();
    const db = getDb();
    const live = db.meetings.filter((m) => !m.is_deleted);
    const ready = live.filter((m) => m.status === "ready");
    const scheduled = live
      .filter((m) => m.status === "scheduled")
      .sort((a, b) => +new Date(a.meeting_date) - +new Date(b.meeting_date));
    const weekAgo = Date.now() - 7 * 86_400_000;
    const recent = ready
      .sort((a, b) => +new Date(b.meeting_date) - +new Date(a.meeting_date))
      .slice(0, 5);
    const ai_feed = recent.slice(0, 4).map((m) => {
      const summary = db.summaries.find((s) => s.meeting_id === m.id);
      const overview = summary
        ? db.summary_items
            .filter((i) =>
              db.summary_sections
                .filter((sec) => sec.summary_id === summary.id && sec.section_type === "overview")
                .some((sec) => sec.id === i.section_id),
            )
            .map((i) => i.text)[0]
        : null;
      const notes = summary
        ? db.summary_sections
            .filter((sec) => sec.summary_id === summary.id && sec.section_type === "notes")
            .flatMap((sec) => db.summary_items.filter((i) => i.section_id === sec.id).map((i) => i.text))
        : [];
      return {
        meeting_id: m.id,
        title: m.title,
        meeting_date: m.meeting_date,
        headline: overview ?? m.description ?? m.title,
        bullets: notes.slice(0, 3),
      };
    });
    const topParticipants = Object.entries(
      db.participants.reduce<Record<string, { name: string; avatar_color: string; count: number }>>((acc, p) => {
        acc[p.name] ??= { name: p.name, avatar_color: p.avatar_color, count: 0 };
        acc[p.name].count++;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([, v]) => v);

    return {
      total_meetings: live.length,
      total_minutes: Math.round(ready.reduce((a, m) => a + (m.duration_seconds ?? 0), 0) / 60),
      meetings_this_week: live.filter((m) => +new Date(m.meeting_date) >= weekAgo).length,
      open_tasks: db.action_items.filter((a) => a.status !== "done").length,
      upcoming_count: scheduled.length,
      top_participants: topParticipants,
      recent: recent.map(toListItem),
      upcoming_list: scheduled.slice(0, 4).map(toListItem),
      ai_feed,
    };
  },

  async getSettings(): Promise<Settings> {
    await latency();
    return getDb().settings as Settings;
  },

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    await latency();
    const db = getDb();
    db.settings = { ...db.settings, ...patch };
    persist();
    return db.settings as Settings;
  },

  // ----- meetings -----

  async listMeetings(params: MeetingListParams = {}): Promise<Paginated<MeetingListItem>> {
    await latency();
    const db = getDb();
    const page = params.page ?? 1;
    const pageSize = params.page_size ?? 20;
    let rows = db.meetings.filter((m) => !m.is_deleted);

    if (params.status) rows = rows.filter((m) => m.status === params.status);
    if (params.source) rows = rows.filter((m) => m.source === params.source);
    if (params.channel) rows = rows.filter((m) => m.channel === params.channel);
    if (params.date_from) rows = rows.filter((m) => m.meeting_date >= params.date_from!);
    if (params.date_to) rows = rows.filter((m) => m.meeting_date <= params.date_to!);
    if (params.min_duration) rows = rows.filter((m) => (m.duration_seconds ?? 0) >= params.min_duration!);
    if (params.q) {
      const q = params.q.toLowerCase();
      rows = rows.filter((m) => {
        const inTitle = m.title.toLowerCase().includes(q);
        const inDesc = (m.description ?? "").toLowerCase().includes(q);
        const inPreview = (db.segments.find((s) => s.meeting_id === m.id)?.text ?? "").toLowerCase().includes(q);
        return inTitle || inDesc || inPreview;
      });
    }
    if (params.participant) {
      const q = params.participant.toLowerCase();
      rows = rows.filter((m) =>
        db.participants.some((p) => p.meeting_id === m.id && p.name.toLowerCase().includes(q)),
      );
    }
    if (params.tag) {
      rows = rows.filter((m) => tagsFor(m.id).some((t) => t.name.toLowerCase() === params.tag!.toLowerCase()));
    }

    const order = params.order ?? "desc";
    const dir = order === "asc" ? 1 : -1;
    const sort = params.sort ?? "recent";
    rows = rows.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title) * (order === "asc" ? 1 : -1);
      if (sort === "duration") return ((a.duration_seconds ?? 0) - (b.duration_seconds ?? 0)) * dir;
      return (+new Date(a.meeting_date) - +new Date(b.meeting_date)) * dir; // recent / date
    });

    return {
      items: rows.slice((page - 1) * pageSize, page * pageSize).map(toListItem),
      page,
      page_size: pageSize,
      total: rows.length,
    };
  },

  async getMeeting(id: number): Promise<Meeting> {
    await latency();
    return toDetail(getMeetingOrThrow(id));
  },

  async createMeeting(input: CreateMeetingInput): Promise<{ id: number; status: MeetingStatus }> {
    await latency();
    const id = createMeetingRecord(input);
    const meeting = getDb().meetings.find((m) => m.id === id)!;
    if (meeting.status === "processing") {
      // simulate the backend's BackgroundTask (docs/03 §4.1): the meeting
      // flips to "ready" with a generated summary ~2.4s later — the UI
      // polls/invalidates and shows the processing state meanwhile.
      setTimeout(() => finishProcessing(id), 2400);
    }
    return { id, status: meeting.status };
  },

  async updateMeeting(id: number, patch: UpdateMeetingInput): Promise<Meeting> {
    await latency();
    const m = getMeetingOrThrow(id);
    if (patch.title != null) m.title = patch.title;
    if (patch.description !== undefined) m.description = patch.description;
    if (patch.meeting_date != null) m.meeting_date = patch.meeting_date;
    if (patch.channel !== undefined) m.channel = patch.channel;
    if (patch.language != null) m.language = patch.language;
    touch(id);
    persist();
    return toDetail(m);
  },

  async deleteMeeting(id: number): Promise<void> {
    await latency();
    const db = getDb();
    getMeetingOrThrow(id);
    db.meetings = db.meetings.filter((m) => m.id !== id);
    db.participants = db.participants.filter((p) => p.meeting_id !== id);
    db.segments = db.segments.filter((s) => s.meeting_id !== id);
    db.summaries = db.summaries.filter((s) => s.meeting_id !== id);
    db.summary_sections = db.summary_sections.filter((sec) =>
      db.summaries.some((s) => s.id === sec.summary_id),
    );
    db.summary_items = db.summary_items.filter((i) =>
      db.summary_sections.some((sec) => sec.id === i.section_id),
    );
    db.action_items = db.action_items.filter((a) => a.meeting_id !== id);
    db.comments = db.comments.filter((c) => c.meeting_id !== id);
    db.bookmarks = db.bookmarks.filter((b) => b.meeting_id !== id);
    db.soundbites = db.soundbites.filter((s) => s.meeting_id !== id);
    db.chat_messages = db.chat_messages.filter((c) => c.meeting_id !== id);
    db.meeting_tags = db.meeting_tags.filter((mt) => mt.meeting_id !== id);
    persist();
  },

  // ----- transcript & summary -----

  async getTranscript(id: number): Promise<Transcript> {
    await latency();
    const db = getDb();
    getMeetingOrThrow(id);
    const segments = db.segments
      .filter((s) => s.meeting_id === id)
      .sort((a, b) => a.start_ms - b.start_ms);
    return {
      meeting_id: id,
      duration_ms: (segments.at(-1)?.end_ms ?? 0) + 2000,
      segments: segments.map((s) => toSegmentRow(s.id)),
    };
  },

  async updateSegment(segmentId: number, text: string): Promise<TranscriptSegment> {
    await latency();
    const seg = updateSegmentText(segmentId, text);
    if (!seg) notFound(`Segment ${segmentId}`);
    persist();
    return toSegmentRow(segmentId);
  },

  async getSummary(id: number): Promise<Summary> {
    await latency();
    getMeetingOrThrow(id);
    return toSummary(id);
  },

  async regenerateSummary(id: number, template?: SummaryTemplate): Promise<Summary> {
    await latency();
    getMeetingOrThrow(id);
    regenerateSummary(id, template ?? "general");
    return toSummary(id);
  },

  async updateSummaryItem(itemId: number, text: string): Promise<SummaryItem> {
    await latency();
    const db = getDb();
    const item = db.summary_items.find((i) => i.id === itemId);
    if (!item) notFound(`Summary item ${itemId}`);
    item.text = text.trim();
    persist();
    return {
      id: item.id,
      text: item.text,
      timestamp_ms: item.timestamp_ms,
      end_timestamp_ms: item.end_timestamp_ms,
      source_segment_id: item.source_segment_id,
    };
  },

  // ----- action items -----

  async listActionItems(params: { meeting_id?: number; status?: ActionItemStatus; assignee?: string } = {}) {
    await latency();
    const db = getDb();
    let rows = db.action_items.filter((a) => {
      const m = db.meetings.find((mm) => mm.id === a.meeting_id);
      return m && !m.is_deleted;
    });
    if (params.meeting_id) rows = rows.filter((a) => a.meeting_id === params.meeting_id);
    if (params.status) rows = rows.filter((a) => a.status === params.status);
    if (params.assignee) {
      const q = params.assignee.toLowerCase();
      rows = rows.filter((a) => {
        const name = db.participants.find((p) => p.id === a.assignee_id)?.name ?? "";
        return name.toLowerCase().includes(q);
      });
    }
    return rows
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .map((a) => toActionItem(a.id));
  },

  async createActionItem(meetingId: number, input: ActionItemInput): Promise<ActionItem> {
    await latency();
    const db = getDb();
    getMeetingOrThrow(meetingId);
    const id = nextId("action_items");
    db.action_items.push({
      id,
      meeting_id: meetingId,
      description: input.description,
      assignee_id: input.assignee_id ?? null,
      status: "open",
      due_date: input.due_date ?? null,
      source_segment_id: input.source_segment_id ?? null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    touch(meetingId);
    persist();
    return toActionItem(id);
  },

  async updateActionItem(id: number, patch: ActionItemUpdate): Promise<ActionItem> {
    await latency();
    const db = getDb();
    const a = db.action_items.find((x) => x.id === id);
    if (!a) notFound(`Action item ${id}`);
    if (patch.description != null) a.description = patch.description;
    if (patch.assignee_id !== undefined) a.assignee_id = patch.assignee_id;
    if (patch.due_date !== undefined) a.due_date = patch.due_date;
    if (patch.status != null && patch.status !== a.status) {
      a.status = patch.status;
      a.completed_at = patch.status === "done" ? new Date().toISOString() : null;
    }
    a.updated_at = new Date().toISOString();
    touch(a.meeting_id);
    persist();
    return toActionItem(id);
  },

  async deleteActionItem(id: number): Promise<void> {
    await latency();
    const db = getDb();
    db.action_items = db.action_items.filter((a) => a.id !== id);
    persist();
  },

  // ----- stats -----

  async getStats(id: number): Promise<MeetingStats> {
    await latency();
    getMeetingOrThrow(id);
    return computeStats(getDb(), id);
  },

  // ----- chat -----

  async getChat(meetingId: number | null = null): Promise<ChatMessage[]> {
    await latency();
    return getDb()
      .chat_messages.filter((m) => m.meeting_id === meetingId)
      .map(chatMapper);
  },

  async sendChat(meetingId: number | null, question: string): Promise<ChatResponse> {
    await sleep(500 + Math.random() * 700); // "thinking" latency
    const db = getDb();
    if (meetingId != null) getMeetingOrThrow(meetingId);
    appendChat(meetingId, "user", question, null);
    const { answer, citations } = answerQuestion(question, { db, meetingId });
    appendChat(meetingId, "assistant", answer, citations);
    return { answer, citations };
  },

  async clearChat(meetingId: number | null): Promise<void> {
    await latency();
    const db = getDb();
    db.chat_messages = db.chat_messages.filter((m) => m.meeting_id !== meetingId);
    persist();
  },

  // ----- search -----

  async search(q: string): Promise<SearchResult> {
    await latency();
    const db = getDb();
    const needle = q.trim().toLowerCase();
    if (!needle) return { meetings: [], transcript_matches: [], total: 0 };
    const meetings = db.meetings
      .filter((m) => !m.is_deleted && m.title.toLowerCase().includes(needle))
      .map(toListItem);
    const transcript_matches = db.segments
      .filter((s) => {
        const m = db.meetings.find((mm) => mm.id === s.meeting_id);
        return m && !m.is_deleted && m.status === "ready" && s.text.toLowerCase().includes(needle);
      })
      .sort((a, b) => a.meeting_id - b.meeting_id || a.start_ms - b.start_ms)
      .slice(0, 12)
      .map((s) => ({
        meeting_id: s.meeting_id,
        meeting_title: db.meetings.find((m) => m.id === s.meeting_id)?.title ?? "",
        segment_id: s.id,
        start_ms: s.start_ms,
        speaker: db.participants.find((p) => p.id === s.speaker_id)?.name ?? "Unknown",
        text: s.text,
      }));
    return { meetings, transcript_matches, total: meetings.length + transcript_matches.length };
  },

  // ----- tags -----

  async listTags(): Promise<Tag[]> {
    await latency();
    return getDb().tags;
  },

  async setMeetingTags(meetingId: number, tagNames: string[]): Promise<Tag[]> {
    await latency();
    const db = getDb();
    getMeetingOrThrow(meetingId);
    const colors = ["#f783ac", "#ffd43b", "#74c0fc", "#b197fc", "#ff6fb5", "#63e6be", "#ffa94d", "#38d9a9"];
    for (const name of tagNames) {
      const clean = name.trim();
      if (!clean) continue;
      if (!db.tags.some((t) => t.name.toLowerCase() === clean.toLowerCase())) {
        db.tags.push({ name: clean, color: colors[db.tags.length % colors.length] });
      }
    }
    db.meeting_tags = db.meeting_tags.filter((mt) => mt.meeting_id !== meetingId);
    for (const name of tagNames) {
      const tag = db.tags.find((t) => t.name.toLowerCase() === name.trim().toLowerCase());
      if (tag) db.meeting_tags.push({ meeting_id: meetingId, tag_name: tag.name });
    }
    touch(meetingId);
    persist();
    return tagsFor(meetingId);
  },

  // ----- engagement -----

  async listComments(meetingId: number): Promise<Comment[]> {
    await latency();
    return getDb().comments.filter((c) => c.meeting_id === meetingId);
  },

  async addComment(meetingId: number, body: string, segmentId: number | null = null): Promise<Comment> {
    await latency();
    const db = getDb();
    getMeetingOrThrow(meetingId);
    const comment: Comment = {
      id: nextId("comments"),
      meeting_id: meetingId,
      segment_id: segmentId,
      user_name: db.user.name,
      body,
      created_at: new Date().toISOString(),
    };
    db.comments.push(comment);
    touch(meetingId);
    persist();
    return comment;
  },

  async deleteComment(id: number): Promise<void> {
    await latency();
    const db = getDb();
    db.comments = db.comments.filter((c) => c.id !== id);
    persist();
  },

  async listBookmarks(meetingId: number): Promise<Bookmark[]> {
    await latency();
    return getDb().bookmarks.filter((b) => b.meeting_id === meetingId);
  },

  async addBookmark(meetingId: number, segmentId: number | null, label: string | null = null): Promise<Bookmark> {
    await latency();
    const db = getDb();
    getMeetingOrThrow(meetingId);
    const bookmark: Bookmark = {
      id: nextId("bookmarks"),
      meeting_id: meetingId,
      segment_id: segmentId,
      label,
      created_at: new Date().toISOString(),
    };
    db.bookmarks.push(bookmark);
    touch(meetingId);
    persist();
    return bookmark;
  },

  async deleteBookmark(id: number): Promise<void> {
    await latency();
    const db = getDb();
    db.bookmarks = db.bookmarks.filter((b) => b.id !== id);
    persist();
  },

  async listSoundbites(meetingId: number): Promise<Soundbite[]> {
    await latency();
    return getDb().soundbites.filter((s) => s.meeting_id === meetingId);
  },

  async addSoundbite(meetingId: number, title: string, startMs: number, endMs: number): Promise<Soundbite> {
    await latency();
    const db = getDb();
    getMeetingOrThrow(meetingId);
    const sb: Soundbite = {
      id: nextId("soundbites"),
      meeting_id: meetingId,
      title,
      start_ms: startMs,
      end_ms: endMs,
      created_at: new Date().toISOString(),
    };
    db.soundbites.push(sb);
    touch(meetingId);
    persist();
    return sb;
  },

  async deleteSoundbite(id: number): Promise<void> {
    await latency();
    const db = getDb();
    db.soundbites = db.soundbites.filter((s) => s.id !== id);
    persist();
  },

  // ----- export -----

  async exportMeeting(id: number, format: ExportFormat): Promise<ExportResult> {
    await latency();
    const m = getMeetingOrThrow(id);
    return exportMeeting(getDb(), m, format);
  },
};
