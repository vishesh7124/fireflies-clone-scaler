"use client";

import { useState } from "react";
import { BotIcon, PencilIcon, SearchIcon } from "lucide-react";
import type { Meeting, Transcript } from "@/lib/types";
import { useNotepadStore } from "@/store/notepad-store";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { MediaPlayer } from "./media-player";
import { TranscriptView } from "./transcript-view";
import { FindInTranscript } from "./find-in-transcript";

/**
 * TranscriptPanel — the right pane of the Notepad (docs/01 §5.4): the media
 * player, the Find / Edit / AskFred toolbar, and the interactive transcript.
 */
export function TranscriptPanel({
  meeting,
  transcript,
}: {
  meeting: Meeting;
  transcript: Transcript;
}) {
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [editMode, setEditMode] = useState(false);
  const setActivePanel = useNotepadStore((s) => s.setActivePanel);
  const activePanel = useNotepadStore((s) => s.activePanel);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <MediaPlayer />

      {/* toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-3 py-1.5">
        <Button
          variant={findOpen ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label="Find in transcript"
          title="Find"
          className={cn(!findOpen && "text-muted-foreground")}
          onClick={() => {
            setFindOpen((open) => !open);
            if (findOpen) setFindQuery("");
          }}
        >
          <SearchIcon className="size-4" />
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

        <span className="ml-auto">
          <Button
            variant={activePanel === "askfred" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs text-primary-soft"
            onClick={() => setActivePanel(activePanel === "askfred" ? null : "askfred")}
          >
            <BotIcon className="size-3.5" />
            AskFred
          </Button>
        </span>
      </div>

      {findOpen && (
        <FindInTranscript
          query={findQuery}
          onQueryChange={setFindQuery}
          onClose={() => {
            setFindOpen(false);
            setFindQuery("");
          }}
          segments={transcript.segments}
        />
      )}

      {editMode && (
        <p className="shrink-0 border-b border-border bg-primary/5 px-3 py-1 text-[11px] text-primary-soft">
          Edit mode — changes autosave. Click a line&rsquo;s text to fix names or phrasing.
        </p>
      )}

      <TranscriptView
        meetingId={meeting.id}
        segments={transcript.segments}
        editMode={editMode}
        findQuery={findQuery || null}
      />
    </div>
  );
}
