/**
 * API contract types — frozen in Phase 1 (docs/03-LOW-LEVEL-DESIGN.md §2).
 * The FastAPI Pydantic schemas mirror these in Phase 5; the mock layer
 * (src/mock) and the HTTP client (src/lib/http-api.ts) both speak this shape.
 */

// ---------- primitives ----------

export type MeetingStatus = "scheduled" | "processing" | "ready" | "failed";
export type MeetingSource = "seed" | "upload" | "paste" | "schedule" | "api";
export type MediaType = "audio" | "video";
export type ActionItemStatus = "open" | "in_progress" | "done";
export type SummaryTemplate = "general" | "sales" | "one_on_one" | "bant";
export type SummarySectionType =
  | "overview"
  | "action_items"
  | "notes"
  | "topics"
  | "metrics"
  | "keywords";
export type GeneratedBy = "seed" | "rules" | "llm" | "manual";
export type ExportFormat = "txt" | "md" | "srt" | "vtt" | "json" | "pdf";
export type Sentiment = "positive" | "neutral" | "negative";

// ---------- pagination ----------

export interface Paginated<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

// ---------- user & settings ----------

export interface User {
  id: number;
  name: string;
  email: string;
  avatar_color: string;
}

export interface Settings {
  theme: "dark" | "light";
  default_summary_template: SummaryTemplate;
  default_playback_speed: number;
  auto_join_meetings: boolean;
  send_recaps_to: string;
}

// ---------- meetings ----------

export interface ParticipantSummary {
  name: string;
  avatar_color: string;
}

export interface Tag {
  name: string;
  color: string;
}

export interface MeetingListItem {
  id: number;
  title: string;
  meeting_date: string; // ISO-8601 UTC
  duration_seconds: number | null;
  status: MeetingStatus;
  source: MeetingSource;
  channel: string | null;
  language: string;
  media_type: MediaType | null;
  participants: ParticipantSummary[];
  tags: Tag[];
  action_item_counts: { open: number; done: number };
  preview: string | null;
}

export interface Participant extends ParticipantSummary {
  id: number;
  email: string | null;
  is_host: boolean;
  talk_time_ms: number;
  word_count: number;
}

export interface Meeting {
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
  media_type: MediaType | null;
  participants: Participant[];
  tags: Tag[];
  action_item_counts: { open: number; done: number };
  counts: { comments: number; bookmarks: number; soundbites: number };
  preview: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- transcript ----------

export interface TranscriptSegment {
  id: number;
  meeting_id: number;
  speaker_id: number | null;
  speaker_name: string;
  avatar_color: string;
  start_ms: number;
  end_ms: number;
  text: string;
  is_edited: boolean;
}

export interface Transcript {
  meeting_id: number;
  duration_ms: number;
  segments: TranscriptSegment[];
}

// ---------- summary ----------

export interface SummaryItem {
  id: number;
  text: string;
  timestamp_ms: number | null;
  end_timestamp_ms: number | null;
  source_segment_id: number | null;
}

export interface SummarySection {
  id: number;
  section_type: SummarySectionType;
  heading: string;
  items: SummaryItem[];
}

export interface Summary {
  meeting_id: number;
  template: SummaryTemplate;
  generated_by: GeneratedBy;
  sections: SummarySection[];
}

// ---------- action items / tasks ----------

export interface ActionItem {
  id: number;
  meeting_id: number;
  meeting_title: string;
  description: string;
  assignee_id: number | null;
  assignee_name: string | null;
  status: ActionItemStatus;
  due_date: string | null;
  source_segment_id: number | null;
  source_start_ms: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- engagement (comments / bookmarks / soundbites) ----------

export interface Comment {
  id: number;
  meeting_id: number;
  segment_id: number | null;
  user_name: string;
  body: string;
  created_at: string;
}

export interface Bookmark {
  id: number;
  meeting_id: number;
  segment_id: number | null;
  label: string | null;
  created_at: string;
}

export interface Soundbite {
  id: number;
  meeting_id: number;
  title: string;
  start_ms: number;
  end_ms: number;
  created_at: string;
}

// ---------- AskFred chat ----------

export interface ChatCitation {
  meeting_id: number;
  meeting_title: string;
  segment_id: number;
  start_ms: number;
  speaker: string;
  quote: string;
}

export interface ChatMessage {
  id: number;
  meeting_id: number | null; // null = global AskFred
  role: "user" | "assistant";
  content: string;
  citations: ChatCitation[] | null;
  created_at: string;
}

export interface ChatResponse {
  answer: string;
  citations: ChatCitation[];
}

// ---------- stats (smart search / conversation intelligence) ----------

export interface SpeakerStats {
  name: string;
  avatar_color: string;
  talk_time_ms: number;
  talk_time_pct: number;
  word_count: number;
  wpm: number;
  sentiment: Sentiment;
}

export interface MeetingStats {
  speakers: SpeakerStats[];
  filters: {
    questions: number;
    tasks: number;
    dates: number;
    metrics: number;
    pricing: number;
    fillers: number;
  };
  sentiment: Sentiment;
}

// ---------- dashboard & feed ----------

export interface AiFeedEntry {
  meeting_id: number;
  title: string;
  meeting_date: string;
  headline: string;
  bullets: string[];
}

export interface DashboardData {
  total_meetings: number;
  total_minutes: number;
  meetings_this_week: number;
  open_tasks: number;
  upcoming_count: number;
  top_participants: (ParticipantSummary & { count: number })[];
  recent: MeetingListItem[];
  upcoming_list: MeetingListItem[];
  ai_feed: AiFeedEntry[];
}

// ---------- search ----------

export interface TranscriptMatch {
  meeting_id: number;
  meeting_title: string;
  segment_id: number;
  start_ms: number;
  speaker: string;
  text: string;
}

export interface SearchResult {
  meetings: MeetingListItem[];
  transcript_matches: TranscriptMatch[];
  total: number;
}

// ---------- params & inputs ----------

export interface MeetingListParams {
  q?: string; // title / description / preview
  participant?: string;
  tag?: string;
  channel?: string;
  source?: MeetingSource;
  status?: MeetingStatus;
  date_from?: string;
  date_to?: string;
  min_duration?: number; // seconds
  sort?: "recent" | "date" | "duration" | "title";
  order?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface CreateMeetingInput {
  title: string;
  meeting_date: string;
  description?: string;
  channel?: string;
  participants: { name: string; email?: string }[];
  /** Raw transcript text — "mm:ss Name: text" lines (paste or parsed file). */
  transcript_text?: string;
}

export interface UpdateMeetingInput {
  title?: string;
  description?: string;
  meeting_date?: string;
  channel?: string;
  language?: string;
}

export interface ActionItemInput {
  description: string;
  assignee_id?: number | null;
  due_date?: string | null;
  source_segment_id?: number | null;
}

export interface ActionItemUpdate {
  description?: string;
  assignee_id?: number | null;
  status?: ActionItemStatus;
  due_date?: string | null;
}

// ---------- export ----------

export interface ExportResult {
  filename: string;
  mime: string;
  content: string;
}

// ---------- the client contract (mock + http both implement this) ----------

export interface ApiClient {
  // meta
  getMe(): Promise<User>;
  getDashboard(): Promise<DashboardData>;
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  // meetings
  listMeetings(params?: MeetingListParams): Promise<Paginated<MeetingListItem>>;
  getMeeting(id: number): Promise<Meeting>;
  createMeeting(input: CreateMeetingInput): Promise<{ id: number; status: MeetingStatus }>;
  updateMeeting(id: number, patch: UpdateMeetingInput): Promise<Meeting>;
  deleteMeeting(id: number): Promise<void>;
  // transcript & summary
  getTranscript(id: number): Promise<Transcript>;
  updateSegment(segmentId: number, text: string): Promise<TranscriptSegment>;
  getSummary(id: number): Promise<Summary>;
  regenerateSummary(id: number, template?: SummaryTemplate): Promise<Summary>;
  updateSummaryItem(itemId: number, text: string): Promise<SummaryItem>;
  // action items / tasks
  listActionItems(params?: {
    meeting_id?: number;
    status?: ActionItemStatus;
    assignee?: string;
  }): Promise<ActionItem[]>;
  createActionItem(meetingId: number, input: ActionItemInput): Promise<ActionItem>;
  updateActionItem(id: number, patch: ActionItemUpdate): Promise<ActionItem>;
  deleteActionItem(id: number): Promise<void>;
  // stats
  getStats(id: number): Promise<MeetingStats>;
  // chat (AskFred — meeting-scoped when id set, global when null)
  getChat(meetingId?: number | null): Promise<ChatMessage[]>;
  sendChat(meetingId: number | null, question: string): Promise<ChatResponse>;
  // search
  search(q: string): Promise<SearchResult>;
  // tags
  listTags(): Promise<Tag[]>;
  setMeetingTags(meetingId: number, tags: string[]): Promise<Tag[]>;
  // engagement
  listComments(meetingId: number): Promise<Comment[]>;
  addComment(meetingId: number, body: string, segmentId?: number | null): Promise<Comment>;
  deleteComment(id: number): Promise<void>;
  listBookmarks(meetingId: number): Promise<Bookmark[]>;
  addBookmark(meetingId: number, segmentId: number | null, label?: string | null): Promise<Bookmark>;
  deleteBookmark(id: number): Promise<void>;
  listSoundbites(meetingId: number): Promise<Soundbite[]>;
  addSoundbite(meetingId: number, title: string, startMs: number, endMs: number): Promise<Soundbite>;
  deleteSoundbite(id: number): Promise<void>;
  // export
  exportMeeting(id: number, format: ExportFormat): Promise<ExportResult>;
}
