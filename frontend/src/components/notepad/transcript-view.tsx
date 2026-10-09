"use client";

import { useEffect, useMemo, useRef } from "react";
import type { TranscriptSegment } from "@/lib/types";
import { usePlayerStore } from "@/store/player-store";
import { useNotepadStore } from "@/store/notepad-store";
import { findActiveSegment } from "@/hooks/use-transcript-sync";
import { classifySegment } from "@/mock/engine";
import { TranscriptLine } from "./transcript-line";
import { Button } from "@/components/ui/button";

/**
 * Headless tracker — derives the active segment from the playhead (binary
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

/** Does a segment satisfy the active smart-search filter? (docs/03 §5.2) */
function matchesSmartFilter(segment: TranscriptSegment, filter: string): boolean {
  const c = classifySegment(segment.text);
  if (filter === "sentiment") return Math.abs(c.sentimentScore) > 0.15;
  return Boolean(c[filter as keyof typeof c]);
}

const FILTER_LABELS: Record<string, string> = {
  questions: "Questions",
  tasks: "Tasks",
  dates: "Dates",
  metrics: "Metrics",
  pricing: "Pricing",
  sentiment: "Sentiment",
  fillers: "Fillers",
};

/**
 * TranscriptView — the scrolling transcript with the two-way sync: playhead →
 * active line highlight + auto-scroll (docs/03 §5.1), smart-search filtering,
 * and the memoized lines.
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

  // auto-scroll the active line into view while playing / after seeks
  useEffect(() => {
    if (activeSegmentId == null) return;
    document
      .querySelector(`[data-segment-id="${activeSegmentId}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeSegmentId]);

  // applying a smart filter jumps to the first match (like the real product)
  const prevFilter = useRef<string | null>(null);
  useEffect(() => {
    if (smartFilter && smartFilter !== prevFilter.current) {
      const first = segments.find((s) => matchesSmartFilter(s, smartFilter));
      if (first) seekTo(first.start_ms);
    }
    prevFilter.current = smartFilter;
  }, [smartFilter, segments, seekTo]);

  const visible = smartFilter
    ? segments.filter((s) => matchesSmartFilter(s, smartFilter))
    : segments;

  return (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      <ActiveSegmentTracker segments={segments} />

      {smartFilter && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs">
          <span className="text-primary-soft">
            {FILTER_LABELS[smartFilter] ?? smartFilter} · showing {visible.length} of {segments.length}
          </span>
          <Button variant="ghost" size="xs" className="ml-auto text-xs" onClick={() => setSmartFilter(null)}>
            Clear
          </Button>
        </div>
      )}

      <div className="space-y-0.5">
        {visible.map((segment) => (
          <TranscriptLine
            key={segment.id}
            segment={segment}
            meetingId={meetingId}
            editMode={editMode}
            findQuery={findQuery}
            smartFilter={smartFilter}
          />
        ))}
        {visible.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            No lines match this filter.
          </p>
        )}
      </div>
    </div>
  );
}
