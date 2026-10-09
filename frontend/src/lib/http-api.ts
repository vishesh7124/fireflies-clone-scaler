/**
 * HTTP API client — the other ApiClient implementation, talking to the real
 * FastAPI backend (docs/03 §2 paths). Inactive until NEXT_PUBLIC_USE_MOCKS
 * is "false" (Phase 7 integration); written now so the contract is frozen.
 */

import type {
  ActionItem,
  ApiClient,
  ChatMessage,
  ChatResponse,
  Comment,
  DashboardData,
  ExportResult,
  Meeting,
  MeetingListParams,
  MeetingStatus,
  MeetingStats,
  Paginated,
  SearchResult,
  Settings,
  Summary,
  SummaryItem,
  Tag,
  Transcript,
  TranscriptSegment,
  User,
  Bookmark,
  Soundbite,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, typeof detail === "string" ? detail : (detail.detail ?? res.statusText));
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const del = <T>(path: string) => req<T>(path, { method: "DELETE" });
const patch = <T>(path: string, body: unknown) => req<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const post = <T>(path: string, body?: unknown) =>
  req<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });

function listParams(params: MeetingListParams = {}): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export const httpApi: ApiClient = {
  getMe: () => req<User>("/me"),
  getDashboard: () => req<DashboardData>("/dashboard"),
  getSettings: () => req<Settings>("/settings"),
  updateSettings: (p) => patch<Settings>("/settings", p),

  listMeetings: (params) => req<Paginated<import("./types").MeetingListItem>>(`/meetings${listParams(params)}`),
  getMeeting: (id) => req<Meeting>(`/meetings/${id}`),
  createMeeting: (input) => post<{ id: number; status: MeetingStatus }>("/meetings", input),
  updateMeeting: (id, p) => patch<Meeting>(`/meetings/${id}`, p),
  deleteMeeting: (id) => del<void>(`/meetings/${id}`),

  getTranscript: (id) => req<Transcript>(`/meetings/${id}/transcript`),
  updateSegment: (segmentId, text) => patch<TranscriptSegment>(`/transcript-segments/${segmentId}`, { text }),
  getSummary: (id) => req<Summary>(`/meetings/${id}/summary`),
  regenerateSummary: (id, template) => post<Summary>(`/meetings/${id}/regenerate`, { template }),
  updateSummaryItem: (itemId, text) => patch<SummaryItem>(`/summary-items/${itemId}`, { text }),

  listActionItems: (params = {}) => {
    const usp = new URLSearchParams();
    if (params.meeting_id) usp.set("meeting_id", String(params.meeting_id));
    if (params.status) usp.set("status", params.status);
    if (params.assignee) usp.set("assignee", params.assignee);
    const s = usp.toString();
    return req<ActionItem[]>(`/tasks${s ? `?${s}` : ""}`);
  },
  createActionItem: (meetingId, input) => post<ActionItem>(`/meetings/${meetingId}/action-items`, input),
  updateActionItem: (id, p) => patch<ActionItem>(`/action-items/${id}`, p),
  deleteActionItem: (id) => del<void>(`/action-items/${id}`),

  getStats: (id) => req<MeetingStats>(`/meetings/${id}/stats`),

  getChat: (meetingId = null) =>
    req<ChatMessage[]>(meetingId != null ? `/meetings/${meetingId}/chat` : "/chat"),
  sendChat: (meetingId, question) =>
    post<ChatResponse>(meetingId != null ? `/meetings/${meetingId}/chat` : "/chat", { question }),
  clearChat: (meetingId) =>
    del<void>(meetingId != null ? `/meetings/${meetingId}/chat` : "/chat"),

  search: (q) => req<SearchResult>(`/search?q=${encodeURIComponent(q)}`),

  listTags: () => req<Tag[]>("/tags"),
  setMeetingTags: (meetingId, tags) => post<Tag[]>(`/meetings/${meetingId}/tags`, { tags }),

  listComments: (meetingId) => req<Comment[]>(`/meetings/${meetingId}/comments`),
  addComment: (meetingId, body, segmentId = null) =>
    post<Comment>(`/meetings/${meetingId}/comments`, { body, segment_id: segmentId }),
  deleteComment: (id) => del<void>(`/comments/${id}`),

  listBookmarks: (meetingId) => req<Bookmark[]>(`/meetings/${meetingId}/bookmarks`),
  addBookmark: (meetingId, segmentId, label = null) =>
    post<Bookmark>(`/meetings/${meetingId}/bookmarks`, { segment_id: segmentId, label }),
  deleteBookmark: (id) => del<void>(`/bookmarks/${id}`),

  listSoundbites: (meetingId) => req<Soundbite[]>(`/meetings/${meetingId}/soundbites`),
  addSoundbite: (meetingId, title, startMs, endMs) =>
    post<Soundbite>(`/meetings/${meetingId}/soundbites`, { title, start_ms: startMs, end_ms: endMs }),
  deleteSoundbite: (id) => del<void>(`/soundbites/${id}`),

  exportMeeting: (id, format) => req<ExportResult>(`/meetings/${id}/export?format=${format}`),
};
