/**
 * React Query key factory — one place for every cache key so mutations
 * invalidate precisely. All Phase 2+ data fetching goes through these.
 */

import type { ActionItemStatus, MeetingListParams } from "./types";

export const qk = {
  me: ["me"] as const,
  dashboard: ["dashboard"] as const,
  meetings: (params?: MeetingListParams) => ["meetings", params ?? {}] as const,
  meeting: (id: number) => ["meeting", id] as const,
  transcript: (id: number) => ["transcript", id] as const,
  summary: (id: number) => ["summary", id] as const,
  actionItems: (params?: { meeting_id?: number; status?: ActionItemStatus; assignee?: string }) =>
    ["action-items", params ?? {}] as const,
  stats: (id: number) => ["stats", id] as const,
  chat: (meetingId: number | null) => ["chat", meetingId] as const,
  search: (q: string) => ["search", q] as const,
  tags: ["tags"] as const,
  settings: ["settings"] as const,
  comments: (meetingId: number) => ["comments", meetingId] as const,
  bookmarks: (meetingId: number) => ["bookmarks", meetingId] as const,
  soundbites: (meetingId: number) => ["soundbites", meetingId] as const,
};
