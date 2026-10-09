"use client";

import { useEffect, useMemo, useState } from "react";
import { BotIcon, ChevronDownIcon, ChevronUpIcon, MaximizeIcon, PencilIcon, SearchIcon, XIcon } from "lucide-react";
import type { Meeting, Transcript, TranscriptSegment } from "@/lib/types";
import { useNotepadStore } from "@/store/notepad-store";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TranscriptView } from "./transcript-view";
import { AskFredPanel } from "./panels/askfred-panel";

/** Scroll a transcript turn into view (used by find navigation). */
function scrollToSegment(id: number) {
  document.querySelector(`[data-segment-id="${id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
}

/** Find-or-Replace bar with match count + prev/next + auto-scroll. */
function FindBar({
  segments,
}: {
  segments: TranscriptSegment[];
}) {
  const query = useNotepadStore((s) => s.findQuery);
  const setFindQuery = useNotepadStore((s) => s.setFindQuery);
  const setSmartFilter = useNotepadStore((s) => s.setSmartFilter);
  const setFollowAudio = useNotepadStore((s) => s.setFollowAudio);
  const [selection, setSelection] = useState({ query: "", index: 0 });

  // matches (case-insensitive substring)
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as TranscriptSegment[];
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, query]);
  const matchIndex = selection.query === query ? Math.min(selection.index, Math.max(0, matches.length - 1)) : 0;
  const updateQuery = (value: string) => {
    setFindQuery(value);
    setSelection({ query: value, index: 0 });
    if (value.trim()) { setSmartFilter(null); setFollowAudio(false); }
    else setFollowAudio(true);
  };

  // jump to first match whenever the query changes
  useEffect(() => {
    if (matches.length > 0) {
      scrollToSegment(matches[matchIndex].id);
    }
  }, [matches, matchIndex]);

  const goTo = (index: number) => {
    if (matches.length === 0) return;
    const wrapped = ((index % matches.length) + matches.length) % matches.length;
    setFollowAudio(false);
    setSelection({ query, index: wrapped });
  };

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface/60 px-3 py-2">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
        <Input
          placeholder="Find or Replace"
          className="h-8 pl-8 pr-8 text-xs"
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              goTo(matchIndex + (e.shiftKey ? -1 : 1));
            }
            if (e.key === "Escape") updateQuery("");
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => {
              updateQuery("");
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>

      {query.trim() && (
        <span title="Matching transcript turns" className="shrink-0 font-mono text-[11px] tabular-nums text-subtle">
          {matches.length > 0 ? `${matchIndex + 1} / ${matches.length}` : "0 / 0"}
        </span>
      )}

      <Button
        variant="outline"
        size="icon-xs"
        aria-label="Previous match"
        disabled={matches.length === 0}
        onClick={() => goTo(matchIndex - 1)}
      >
        <ChevronUpIcon className="size-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon-xs"
        aria-label="Next match"
        disabled={matches.length === 0}
        onClick={() => goTo(matchIndex + 1)}
      >
        <ChevronDownIcon className="size-3.5" />
      </Button>
    </div>
  );
}

/**
 * TranscriptPanel — the right column (notepad1-4.png): AskFred | Transcript
 * tabs (with the edit + panel-toggle icons), the "Find or Replace" search bar,
 * the transcript turns, and (in the AskFred tab) the meeting chat.
 */
export function TranscriptPanel({
  meeting,
  transcript,
}: {
  meeting: Meeting;
  transcript: Transcript;
}) {
  const [tab, setTab] = useState<"transcript" | "askfred">("transcript");
  const [editMode, setEditMode] = useState(false);
  const findQuery = useNotepadStore((s) => s.findQuery);
  const activePanel = useNotepadStore((s) => s.activePanel);
  const setActivePanel = useNotepadStore((s) => s.setActivePanel);

  return (
    <div className="flex h-full min-h-0 w-80 shrink-0 flex-col border-l border-border xl:w-[480px]">
      {/* tabs */}
      <div className="flex h-[52px] shrink-0 items-center gap-4 border-b border-border px-6">
        <button
          type="button"
          onClick={() => setTab("askfred")}
          className={cn(
            "flex items-center gap-1.5 text-sm transition-colors",
            tab === "askfred"
              ? "font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <BotIcon className="size-3.5" />
          AskFred
        </button>
        <button
          type="button"
          onClick={() => setTab("transcript")}
          className={cn(
            "text-sm transition-colors",
            tab === "transcript"
              ? "font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Transcript
        </button>

        <span className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle side panel"
            title="Toggle side panel"
            className="text-muted-foreground"
            onClick={() => setActivePanel(activePanel ? null : "smart-search")}
          >
            <MaximizeIcon className="size-4" />
          </Button>
          <Button
            variant={editMode ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Edit transcript"
            title="Edit transcript"
            className={cn(!editMode && "text-muted-foreground")}
            onClick={() => setEditMode((m) => !m)}
          >
            <PencilIcon className="size-4" />
          </Button>
        </span>
      </div>

      {tab === "transcript" ? (
        <>
          <FindBar
            segments={transcript.segments}
          />

          {editMode && (
            <p className="shrink-0 border-b border-border bg-primary/5 px-3 py-1 text-[11px] text-primary-soft">
              Edit mode — changes autosave
            </p>
          )}

          <TranscriptView
            meetingId={meeting.id}
            segments={transcript.segments}
            editMode={editMode}
            findQuery={findQuery || null}
          />
        </>
      ) : (
        <AskFredPanel meeting={meeting} />
      )}
    </div>
  );
}
