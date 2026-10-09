"use client";

import { useState } from "react";
import { BotIcon, MaximizeIcon, PencilIcon, SearchIcon } from "lucide-react";
import type { Meeting, Transcript } from "@/lib/types";
import { useNotepadStore } from "@/store/notepad-store";
import { useDebounced } from "@/hooks/use-debounced";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TranscriptView } from "./transcript-view";
import { AskFredPanel } from "./panels/askfred-panel";

/**
 * TranscriptPanel — the right column (notepad1-4.png): AskFred | Transcript
 * tabs (with the edit + panel-toggle icons), the "Find or Replace" search
 * bar, the transcript turns, and (in the AskFred tab) the meeting chat.
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
  const [search, setSearch] = useState("");
  const findQuery = useNotepadStore((s) => s.findQuery);
  const setFindQuery = useNotepadStore((s) => s.setFindQuery);
  const activePanel = useNotepadStore((s) => s.activePanel);
  const setActivePanel = useNotepadStore((s) => s.setActivePanel);
  const debouncedSearch = useDebounced(search, 200);

  // keep the local "Find or Replace" bar and the Smart Search input in sync
  const effectiveQuery = debouncedSearch || findQuery;

  return (
    <div className="flex h-full min-h-0 w-80 shrink-0 flex-col border-l border-border xl:w-[400px]">
      {/* tabs */}
      <div className="flex shrink-0 items-center gap-4 border-b border-border px-4 py-2">
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
          {/* find or replace */}
          <div className="shrink-0 border-b border-border p-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
              <Input
                placeholder="Find or Replace"
                className="h-8 pl-8 text-xs"
                value={search || findQuery}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setFindQuery(e.target.value);
                }}
              />
            </div>
          </div>

          {editMode && (
            <p className="shrink-0 border-b border-border bg-primary/5 px-3 py-1 text-[11px] text-primary-soft">
              Edit mode — changes autosave
            </p>
          )}

          <TranscriptView
            meetingId={meeting.id}
            segments={transcript.segments}
            editMode={editMode}
            findQuery={effectiveQuery || null}
          />
        </>
      ) : (
        <AskFredPanel meeting={meeting} />
      )}
    </div>
  );
}
