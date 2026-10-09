"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { msToClock } from "@/lib/format";
import type { Transcript } from "@/lib/types";
import { usePlayerStore } from "@/store/player-store";
import { useNotepadStore } from "@/store/notepad-store";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Comments panel — timestamped comments pinned to transcript segments (the
 * real Notepad's 💬 Comments). The line hover-action anchors a comment to
 * its moment; the composer shows the anchor and can be cleared.
 */
export function CommentsPanel({ meetingId, transcript }: { meetingId: number; transcript: Transcript }) {
  const queryClient = useQueryClient();
  const seekTo = usePlayerStore((s) => s.seekTo);
  const anchorSegmentId = useNotepadStore((s) => s.commentAnchorSegmentId);
  const setCommentAnchor = useNotepadStore((s) => s.setCommentAnchor);
  const [draft, setDraft] = useState("");

  const { data: comments } = useQuery({
    queryKey: qk.comments(meetingId),
    queryFn: () => api.listComments(meetingId),
  });

  const anchorSegment = transcript.segments.find((s) => s.id === anchorSegmentId);

  const addMutation = useMutation({
    mutationFn: () => api.addComment(meetingId, draft.trim(), anchorSegmentId),
    onSuccess: () => {
      setDraft("");
      setCommentAnchor(null);
      queryClient.invalidateQueries({ queryKey: qk.comments(meetingId) });
      queryClient.invalidateQueries({ queryKey: qk.meeting(meetingId) });
      toast.success("Comment added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteComment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.comments(meetingId) });
      queryClient.invalidateQueries({ queryKey: qk.meeting(meetingId) });
      toast.success("Comment deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r border-border">
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <h3 className="px-1 text-sm font-semibold text-foreground">Comments</h3>
        {(comments ?? []).length === 0 && (
          <p className="px-1 text-xs leading-relaxed text-subtle">
            No comments yet — hover a transcript line and hit the comment button to discuss a
            moment.
          </p>
        )}
        <div className="space-y-2">
          {(comments ?? []).map((comment) => {
            const segment = transcript.segments.find((s) => s.id === comment.segment_id);
            return (
              <div key={comment.id} className="group/cm space-y-1.5 rounded-lg border border-border bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">{comment.user_name}</span>
                  <span className="flex items-center gap-1.5">
                    {segment && (
                      <button
                        type="button"
                        onClick={() => seekTo(segment.start_ms)}
                        className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary-soft hover:bg-primary/20"
                      >
                        <Link2Icon className="size-2.5" />
                        {msToClock(segment.start_ms)}
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Delete comment"
                      onClick={() => deleteMutation.mutate(comment.id)}
                      className="text-subtle opacity-0 transition-opacity hover:text-destructive group-hover/cm:opacity-100"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </span>
                </div>
                {segment && (
                  <p className="truncate border-l-2 border-primary/40 pl-2 text-[11px] italic text-subtle">
                    {segment.text}
                  </p>
                )}
                <p className="text-xs leading-relaxed text-muted-foreground">{comment.body}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* composer */}
      <div className="space-y-2 border-t border-border p-3">
        {anchorSegment && (
          <button
            type="button"
            onClick={() => setCommentAnchor(null)}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-left text-[11px] text-primary-soft",
              "hover:bg-primary/20",
            )}
            title="Clear anchor"
          >
            <Link2Icon className="size-3 shrink-0" />
            <span className="truncate">
              On “{anchorSegment.speaker_name} · {msToClock(anchorSegment.start_ms)}” — click to
              clear
            </span>
          </button>
        )}
        <Textarea
          rows={3}
          placeholder="Write a comment…"
          className="text-xs"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          size="sm"
          className="w-full text-xs"
          disabled={!draft.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          Comment
        </Button>
      </div>
    </div>
  );
}
