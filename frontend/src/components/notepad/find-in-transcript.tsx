"use client";

import { useMemo } from "react";
import { ChevronDownIcon, ChevronUpIcon, SearchIcon, XIcon } from "lucide-react";
import type { TranscriptSegment } from "@/lib/types";
import { usePlayerStore } from "@/store/player-store";
import { useDebounced } from "@/hooks/use-debounced";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Find in transcript — search box with live <mark> highlights, match count,
 * and prev/next navigation that seeks the player to each match (docs/03 §2.2,
 * the assignment's "search within the transcript with highlighted matches").
 */
export function FindInTranscript({
  query,
  onQueryChange,
  onClose,
  segments,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onClose: () => void;
  segments: TranscriptSegment[];
}) {
  const seekTo = usePlayerStore((s) => s.seekTo);
  const debounced = useDebounced(query, 200);

  const matches = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return [] as TranscriptSegment[];
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, debounced]);

  const goTo = (index: number) => {
    if (matches.length === 0) return;
    const wrapped = (index + matches.length) % matches.length;
    seekTo(matches[wrapped].start_ms);
    document
      .querySelector(`[data-segment-id="${matches[wrapped].id}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface/60 px-3 py-2">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
        <Input
          autoFocus
          placeholder="Find in transcript…"
          className="h-8 pl-8 pr-8 text-xs"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              goTo(matches.findIndex((m) => m.start_ms >= (usePlayerStore.getState().currentTimeMs ?? 0)) - 1);
            }
            if (e.key === "Escape") onClose();
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => onQueryChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>

      {debounced.trim() && (
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-subtle">
          {matches.length} match{matches.length === 1 ? "" : "es"}
        </span>
      )}

      <Button variant="outline" size="icon-xs" aria-label="Previous match" disabled={!matches.length} onClick={() => goTo(-1)}>
        <ChevronUpIcon className="size-3.5" />
      </Button>
      <Button variant="outline" size="icon-xs" aria-label="Next match" disabled={!matches.length} onClick={() => goTo(1)}>
        <ChevronDownIcon className="size-3.5" />
      </Button>
      <Button variant="ghost" size="icon-xs" aria-label="Close find" onClick={onClose}>
        <XIcon className="size-3.5" />
      </Button>
    </div>
  );
}
