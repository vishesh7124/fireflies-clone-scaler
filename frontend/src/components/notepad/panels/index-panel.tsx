"use client";

import { useNotepadStore } from "@/store/notepad-store";
import { cn } from "cn";

/**
 * Index panel — jump list into the summary sections and the other Notepad
 * panels (the real product's 📑 Index: "Jump to action items or AI summary
 * sections").
 */
export function IndexPanel({ meetingId }: { meetingId: number }) {
  const setActivePanel = useNotepadStore((s) => s.setActivePanel);

  const scrollToSection = (type: string) => {
    document.getElementById(`summary-${type}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const items: { label: string; onClick: () => void }[] = [
    { label: "Overview", onClick: () => scrollToSection("overview") },
    { label: "Action items", onClick: () => scrollToSection("action_items") },
    { label: "Notes", onClick: () => scrollToSection("notes") },
    { label: "Topics", onClick: () => scrollToSection("topics") },
    { label: "Metrics", onClick: () => scrollToSection("metrics") },
    { label: "Soundbites", onClick: () => setActivePanel("soundbites") },
    { label: "Comments", onClick: () => setActivePanel("comments") },
    { label: "Bookmarks", onClick: () => setActivePanel("bookmarks") },
  ];

  return (
    <div className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-border">
      <div className="space-y-3 p-3">
        <h3 className="px-1 text-sm font-semibold text-foreground">Index</h3>
        <div className="space-y-0.5">
          {items.map((item, i) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                i < 5
                  ? "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  : "text-primary-soft hover:bg-primary/10",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
