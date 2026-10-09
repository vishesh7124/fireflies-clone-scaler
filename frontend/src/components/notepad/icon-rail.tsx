"use client";

import {
  AudioLinesIcon,
  BookmarkIcon,
  ListIcon,
  MessageSquareIcon,
  SearchIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";
import { useNotepadStore, type NotepadPanel } from "@/store/notepad-store";
import { cn } from "cn";

const ITEMS: { id: NotepadPanel; label: string; icon: LucideIcon }[] = [
  { id: "smart-search", label: "Smart Search", icon: SearchIcon },
  { id: "index", label: "Index", icon: ListIcon },
  { id: "soundbites", label: "Soundbites", icon: AudioLinesIcon },
  { id: "comments", label: "Comments", icon: MessageSquareIcon },
  { id: "bookmarks", label: "Bookmarks", icon: BookmarkIcon },
  { id: "askfred", label: "AskFred", icon: SparklesIcon },
];

/**
 * Icon rail — the real Notepad's collapsible left strip (Smart Search,
 * Index, Soundbites, Comments, Bookmarks, AskFred). Clicking an icon opens
 * its panel; clicking again closes it.
 */
export function IconRail() {
  const activePanel = useNotepadStore((s) => s.activePanel);
  const setActivePanel = useNotepadStore((s) => s.setActivePanel);

  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border py-3">
      {ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={activePanel === id}
          onClick={() => setActivePanel(activePanel === id ? null : id)}
          className={cn(
            "flex size-9 items-center justify-center rounded-lg transition-colors",
            activePanel === id
              ? "bg-elevated text-primary"
              : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
