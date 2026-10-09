"use client";

import { memo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AudioLinesIcon, BookmarkIcon, ChevronDownIcon, MessageSquareIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { msToClock } from "@/lib/format";
import type { Transcript, TranscriptSegment } from "@/lib/types";
import { cn } from "cn";
import { usePlayerStore } from "@/store/player-store";
import { useNotepadStore } from "@/store/notepad-store";
import { HighlightedText } from "@/components/shared/highlighted-text";

/**
 * One transcript turn — replicates the original's blocks: square colored
 * avatar + speaker name (neutral, with a chevron) + "·" + a purple
 * underlined timestamp link, body text flush-left below, a hairline divider
 * between turns, and a thin left-bar accent (not a filled card) when active.
 *
 * Interactions (docs/01 §5.4): click anywhere → seek; edit mode → inline
 * autosave; hover actions → comment / soundbite / bookmark the moment.
 */
function TranscriptTurnComponent({
  segment,
  meetingId,
  editMode,
  findQuery,
  dimmed,
}: {
  segment: TranscriptSegment;
  meetingId: number;
  editMode: boolean;
  findQuery: string | null;
  dimmed: boolean;
}) {
  const isActive = usePlayerStore((s) => s.activeSegmentId === segment.id);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const setActivePanel = useNotepadStore((s) => s.setActivePanel);
  const setCommentAnchor = useNotepadStore((s) => s.setCommentAnchor);
  const queryClient = useQueryClient();

  const [editedText, setEditedText] = useState<{ source: string; text: string } | null>(null);
  const draft = editedText?.source === segment.text ? editedText.text : segment.text;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);


  const editMutation = useMutation({
    mutationFn: (text: string) => api.updateSegment(segment.id, text),
    onSuccess: (updated) => {
      queryClient.setQueryData<Transcript>(qk.transcript(meetingId), (old) =>
        old
          ? { ...old, segments: old.segments.map((s) => (s.id === updated.id ? updated : s)) }
          : old,
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const onEditInput = (text: string) => {
    setEditedText({ source: segment.text, text });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (text.trim() && text !== segment.text) editMutation.mutate(text.trim());
    }, 700);
  };

  const initials = segment.speaker_name[0]?.toUpperCase() ?? "?"

  return (
    <div
      data-segment-id={segment.id}
      className={cn(
        "group/turn relative border-b border-border/60 px-4 py-3 transition-colors",
        isActive && "bg-primary/10",
        dimmed && "opacity-40",
      )}
    >
      {/* active accent — a 1px left bar, like the original */}
      {isActive && <span className="absolute inset-y-0 left-0 w-1 bg-primary" />}

      {/* header row: avatar + name + · + timestamp + hover actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => seekTo(segment.start_ms)}
          className="flex min-w-0 items-center gap-2"
        >
          <span
             className="flex size-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-background"
            style={{ backgroundColor: segment.avatar_color }}
          >
            {initials}
          </span>
          <span className="truncate text-[13px] font-medium text-foreground">
            {segment.speaker_name}
            <ChevronDownIcon className="ml-0.5 inline size-2.5 text-subtle" />
          </span>
          <span className="shrink-0 text-[11px] text-subtle">·</span>
          <span className="shrink-0 cursor-pointer text-sm tabular-nums text-primary-soft underline decoration-primary-soft/40 transition-colors hover:bg-primary/15 hover:decoration-primary-soft">
            {msToClock(segment.start_ms)}
          </span>
        </button>

        <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/turn:opacity-100">
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

      {/* body — flush left, like the original */}
      {editMode ? (
        <div
          role="textbox"
          tabIndex={0}
          contentEditable
          suppressContentEditableWarning
          className="mt-1.5 rounded-md border border-border bg-elevated/40 px-2 py-1 text-sm leading-relaxed text-foreground outline-none focus:border-ring"
          onInput={(e) => onEditInput(e.currentTarget.textContent ?? "")}
          onBlur={(e) => {
            const text = (e.currentTarget.textContent ?? "").trim();
            if (text && text !== segment.text) editMutation.mutate(text);
          }}
        >
          {draft}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => seekTo(segment.start_ms)}
          className="mt-1 block w-full text-left"
        >
          <p className="text-sm leading-7 text-foreground">
            <HighlightedText text={segment.text} query={findQuery} />
          </p>
        </button>
      )}
    </div>
  );
}

export const TranscriptTurn = memo(TranscriptTurnComponent);
