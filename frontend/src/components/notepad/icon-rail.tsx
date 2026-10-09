"use client";

import {
  AudioLinesIcon,
  BookmarkIcon,
  SearchIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import { useNotepadStore, type NotepadPanel } from "@/store/notepad-store";
import { cn } from "cn";

const ITEMS: { id: NotepadPanel; label: string; icon: LucideIcon }[] = [
  { id: "smart-search", label: "Smart Search", icon: SearchIcon },
  { id: "soundbites", label: "Soundbites", icon: AudioLinesIcon },
  { id: "bookmarks", label: "Bookmarks", icon: BookmarkIcon },
];

/**
 * Icon rail — the real Notepad's thin left strip (search / waveform /
 * bookmark / lightning). Smart Search is the default panel; the lightning
 * icon is the AI-Skills placeholder (Phase 6).
 */
export function IconRail() {
  const activePanel = useNotepadStore((s) => s.activePanel);
  const setActivePanel = useNotepadStore((s) => s.setActivePanel);

  return (
    <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-border py-3">
      {ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={activePanel === id}
          onClick={() => setActivePanel(activePanel === id ? null : id)}
          className={cn(
            "flex size-8 items-center justify-center rounded-lg transition-colors",
            activePanel === id
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
      <button
        type="button"
        title="AI Skills"
        aria-label="AI Skills"
        onClick={() => setActivePanel("smart-search")}
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-elevated/60 hover:text-foreground"
      >
        <ZapIcon className="size-4" />
      </button>
    </div>
  );
}
