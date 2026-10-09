"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookmarkIcon, MessageSquareIcon, PencilIcon, AudioLinesIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { msToClock } from "@/lib/format";
import type { Transcript, TranscriptSegment } from "@/lib/types";
import { cn } from "cn";
import { usePlayerStore } from "@/store/player-store";
import { useNotepadStore } from "@/store/notepad-store";
import { classifySegment } from "@/mock/engine";
import { HighlightedText } from "@/components/shared/highlighted-text";

/**
 * One transcript line — speaker avatar + colored name + mm:ss on the first
 * row, text below (like the real Notepad). Subscribes narrowly to the player
 * so only the active line re-renders during playback.
 *
 * Interactions (docs/01 §5.4): click → seek the player; edit mode → inline
 * autosave; hover actions → comment / soundbite / bookmark this moment.
 */
function TranscriptLineComponent({
  segment,
  meetingId,
  editMode,
  findQuery,
  smartFilter,
}: {
  segment: TranscriptSegment;
  meetingId: number;
  editMode: boolean;
  findQuery: string | null;
  smartFilter: string | null;
}) {
  const isActive = usePlayerStore((s) => s.activeSegmentId === segment.id);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const setActivePanel = useNotepadStore((s) => s.setActivePanel);
  const setCommentAnchor = useNotepadStore((s) => s.setCommentAnchor);
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState(segment.text);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setDraft(segment.text), [segment.text]);

  const editMutation = useMutation({
    mutationFn: (text: string) => api.updateSegment(segment.id, text),
    onSuccess: (updated) => {
      // optimistic: patch the transcript cache without a refetch
      queryClient.setQueryData<Transcript>(qk.transcript(meetingId), (old) =>
        old
          ? { ...old, segments: old.segments.map((s) => (s.id === updated.id ? updated : s)) }
          : old,
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const onEditInput = (text: string) => {
    setDraft(text);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (text.trim() && text !== segment.text) editMutation.mutate(text.trim());
    }, 700);
  };

  const smartMatch = smartFilter
    ? segmentMatchesFilter(segment.text, smartFilter)
    : false;

  return (
    <div
      data-segment-id={segment.id}
      className={cn(
        "group/line rounded-lg border border-transparent px-3 py-2 transition-colors",
        isActive ? "border-primary/40 bg-primary/10" : "hover:bg-surface/70",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-background" style={{ backgroundColor: segment.avatar_color }}>
          {segment.speaker_name
            .split(/\s+/)
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </span>
        <button
          type="button"
          onClick={() => seekTo(segment.start_ms)}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          <span className="truncate text-[13px] font-semibold" style={{ color: segment.avatar_color }}>
            {segment.speaker_name}
          </span>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-subtle hover:text-primary-soft">
            {msToClock(segment.start_ms)}
          </span>
        </button>

        <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/line:opacity-100">
          {segment.is_edited && (
            <span title="Edited" aria-label="Edited">
              <PencilIcon className="size-3 text-subtle" />
            </span>
          )}
          <button
            type="button"
            aria-label="Comment on this moment"
            title="Comment"
            onClick={() => {
              setCommentAnchor(segment.id);
              setActivePanel("comments");
            }}
            className="flex size-6 items-center justify-center rounded-md text-subtle transition-colors hover:bg-elevated/60 hover:text-foreground"
          >
            <MessageSquareIcon className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Create soundbite from this moment"
            title="Soundbite"
            onClick={() => {
              api
                .addSoundbite(
                  meetingId,
                  `${segment.text.split(/\s+/).slice(0, 5).join(" ")}…`,
                  segment.start_ms,
                  segment.end_ms,
                )
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: qk.soundbites(meetingId) });
                  setActivePanel("soundbites");
                  toast.success("Soundbite created");
                })
                .catch((e) => toast.error(e.message));
            }}
            className="flex size-6 items-center justify-center rounded-md text-subtle transition-colors hover:bg-elevated/60 hover:text-foreground"
          >
            <AudioLinesIcon className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Bookmark this moment"
            title="Bookmark"
            onClick={() => {
              api
                .addBookmark(meetingId, segment.id)
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: qk.bookmarks(meetingId) });
                  setActivePanel("bookmarks");
                  toast.success("Bookmarked");
                })
                .catch((e) => toast.error(e.message));
            }}
            className="flex size-6 items-center justify-center rounded-md text-subtle transition-colors hover:bg-elevated/60 hover:text-foreground"
          >
            <BookmarkIcon className="size-3.5" />
          </button>
        </span>
      </div>

      <button
        type="button"
        onClick={() => seekTo(segment.start_ms)}
        className="mt-0.5 block w-full text-left"
      >
        {editMode ? (
          <span
            role="textbox"
            tabIndex={0}
            contentEditable
            suppressContentEditableWarning
            className={cn(
              "rounded-md border border-border bg-elevated/50 px-2 py-1 text-sm leading-relaxed text-foreground outline-none focus:border-ring",
              smartMatch && "ring-1 ring-primary/50",
            )}
            onInput={(e) => onEditInput(e.currentTarget.textContent ?? "")}
            onBlur={(e) => {
              const text = (e.currentTarget.textContent ?? "").trim();
              if (text && text !== segment.text) editMutation.mutate(text);
            }}
          >
            {draft}
          </span>
        ) : (
          <p
            className={cn(
              "px-1 text-sm leading-relaxed text-muted-foreground",
              smartFilter && !smartMatch && "opacity-40",
            )}
          >
            <HighlightedText text={segment.text} query={findQuery} />
          </p>
        )}
      </button>
    </div>
  );
}

/** Smart-search filter matching (rules ported from docs/03 §5.2). */
function segmentMatchesFilter(text: string, filter: string): boolean {
  const c = classifySegment(text);
  switch (filter) {
    case "questions":
      return c.question;
    case "tasks":
      return c.task;
    case "dates":
      return c.date;
    case "metrics":
      return c.metric;
    case "pricing":
      return c.pricing;
    case "fillers":
      return c.filler;
    case "sentiment":
      return Math.abs(c.sentimentScore) > 0.15;
    default:
      return false;
  }
}

export const TranscriptLine = memo(TranscriptLineComponent);
