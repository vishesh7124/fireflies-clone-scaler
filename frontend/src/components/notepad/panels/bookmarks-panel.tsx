"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkIcon, PlayIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { msToClock } from "@/lib/format";
import type { Transcript } from "@/lib/types";
import { usePlayerStore } from "@/store/player-store";

/**
 * Bookmarks panel — saved moments (the real Notepad's 🔖 Bookmarks). Click a
 * bookmark to seek to its moment; delete to remove.
 */
export function BookmarksPanel({ meetingId, transcript }: { meetingId: number; transcript: Transcript }) {
  const queryClient = useQueryClient();
  const seekTo = usePlayerStore((s) => s.seekTo);

  const { data: bookmarks } = useQuery({
    queryKey: qk.bookmarks(meetingId),
    queryFn: () => api.listBookmarks(meetingId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteBookmark(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.bookmarks(meetingId) });
      queryClient.invalidateQueries({ queryKey: qk.meeting(meetingId) });
      toast.success("Bookmark removed");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-border">
      <div className="space-y-3 p-3">
        <h3 className="px-1 text-sm font-semibold text-foreground">Bookmarks</h3>
        {(bookmarks ?? []).length === 0 && (
          <p className="px-1 text-xs leading-relaxed text-subtle">
            No bookmarks yet — hover a transcript line and hit the bookmark button to save a
            moment.
          </p>
        )}
        <div className="space-y-1">
          {(bookmarks ?? []).map((bookmark) => {
            const segment = transcript.segments.find((s) => s.id === bookmark.segment_id);
            const ms = segment?.start_ms ?? 0;
            return (
              <div
                key={bookmark.id}
                className="group/bm flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-surface/60"
              >
                <BookmarkIcon className="size-3.5 shrink-0 text-primary-soft" />
                <button
                  type="button"
                  onClick={() => seekTo(ms)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-primary-soft">
                    {msToClock(ms)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {segment ? segment.text : (bookmark.label ?? "Saved moment")}
                  </span>
                </button>
                <PlayIcon className="size-3 shrink-0 text-subtle" />
                <button
                  type="button"
                  aria-label="Delete bookmark"
                  onClick={() => deleteMutation.mutate(bookmark.id)}
                  className="shrink-0 text-subtle opacity-0 transition-opacity hover:text-destructive group-hover/bm:opacity-100"
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
