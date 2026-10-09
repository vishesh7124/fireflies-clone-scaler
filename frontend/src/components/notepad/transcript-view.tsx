"use client";

import { useEffect, useMemo, useRef } from "react";
import { ChevronUpIcon } from "lucide-react";
import type { TranscriptSegment } from "@/lib/types";
import { usePlayerStore } from "@/store/player-store";
import { useNotepadStore } from "@/store/notepad-store";
import { findActiveSegment } from "@/hooks/use-transcript-sync";
import { classifySegment } from "@/mock/engine";
import { TranscriptTurn } from "./transcript-line";

/**
 * Headless tracker — derives the active turn from the playhead (binary
 * search) and publishes it to the player store. Only this tiny component
 * re-renders at playback rate.
 */
function ActiveSegmentTracker({ segments }: { segments: TranscriptSegment[] }) {
  const currentTimeMs = usePlayerStore((s) => s.currentTimeMs);
  const setActiveSegmentId = usePlayerStore((s) => s.setActiveSegmentId);
  const lastId = useRef<number | null | undefined>(undefined);

  const activeId = useMemo(
    () => findActiveSegment(segments, currentTimeMs)?.id ?? null,
    [segments, currentTimeMs],
  );

  useEffect(() => {
    if (lastId.current !== activeId) {
      lastId.current = activeId;
      setActiveSegmentId(activeId);
    }
  }, [activeId, setActiveSegmentId]);

  return null;
}

/** Does a turn satisfy the active smart-search filter? */
function matchesFilter(segment: TranscriptSegment, filter: string): boolean {
  const c = classifySegment(segment.text);
  switch (filter) {
    case "questions":
      return c.question;
    case "tasks":
      return c.task;
    case "dates":
      return c.date;
    case "metrics":
      return c.metric;
    case "sentiment-positive":
      return c.sentimentScore > 0.15;
    case "sentiment-negative":
      return c.sentimentScore < -0.15;
    default:
      return false;
  }
}

/**
 * TranscriptView — the scrolling transcript: playhead → active turn
 * highlight + auto-scroll (docs/03 §5.1), smart-search filtering, and the
 * floating "Sync with audio" button from the original.
 */
export function TranscriptView({
  meetingId,
  segments,
  editMode,
  findQuery,
}: {
  meetingId: number;
  segments: TranscriptSegment[];
  editMode: boolean;
  findQuery: string | null;
}) {
  const activeSegmentId = usePlayerStore((s) => s.activeSegmentId);
  const smartFilter = useNotepadStore((s) => s.smartFilter);
  const setSmartFilter = useNotepadStore((s) => s.setSmartFilter);
  const seekTo = usePlayerStore((s) => s.seekTo);

  // auto-scroll the active turn into view while playing / after seeks
  useEffect(() => {
    if (activeSegmentId == null) return;
    document
      .querySelector(`[data-segment-id="${activeSegmentId}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeSegmentId]);

  // applying a smart filter jumps to the first match
  const prevFilter = useRef<string | null>(null);
  useEffect(() => {
    if (smartFilter && smartFilter !== prevFilter.current) {
      const first = segments.find((s) => matchesFilter(s, smartFilter));
      if (first) seekTo(first.start_ms);
    }
    prevFilter.current = smartFilter;
  }, [smartFilter, segments, seekTo]);

  const visible = smartFilter ? segments.filter((s) => matchesFilter(s, smartFilter)) : segments;

  return (
    <div className="relative flex-1 overflow-y-auto">
      <ActiveSegmentTracker segments={segments} />

      {smartFilter && (
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-primary/25 bg-primary/10 px-4 py-1.5 text-xs backdrop-blur">
          <span className="text-primary-soft">
            {smartFilter.replace("-", " ")} · showing {visible.length} of {segments.length}
          </span>
          <button
            type="button"
            onClick={() => setSmartFilter(null)}
            className="ml-auto text-xs font-medium text-primary-soft hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {visible.map((segment) => (
        <TranscriptTurn
          key={segment.id}
          segment={segment}
          meetingId={meetingId}
          editMode={editMode}
          findQuery={findQuery}
          dimmed={Boolean(smartFilter)}
        />
      ))}
      {visible.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No turns match this filter.
        </p>
      )}

      {/* "Sync with audio" — scrolls the transcript to the playhead */}
      <button
        type="button"
        onClick={() => {
          if (activeSegmentId == null) return;
          document
            .querySelector(`[data-segment-id="${activeSegmentId}"]`)
            ?.scrollIntoView({ block: "center", behavior: "smooth" });
        }}
        className="sticky bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground shadow-lg transition-colors hover:border-ring/40"
      >
        <ChevronUpIcon className="size-3.5 text-primary-soft" />
        Sync with audio
      </button>
    </div>
  );
}
