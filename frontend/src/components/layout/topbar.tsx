"use client";

import { usePathname } from "next/navigation";
import { BellIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CaptureMenu } from "./capture-menu";

/** View label per route (left edge of the real app's top bar). */
const VIEW_LABELS: Record<string, string> = {
  "/": "Home",
  "/askfred": "AskFred",
  "/meetings": "Meetings",
  "/tasks": "Tasks",
  "/ai-skills": "AI Skills",
  "/analytics": "Analytics",
  "/voice-agents": "Voice Agents",
  "/settings": "Settings",
  "/integrations": "Integrations",
};

export function Topbar() {
  const pathname = usePathname();
  const viewLabel = VIEW_LABELS[pathname] ?? "Fireflies";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      <span className="w-20 shrink-0 text-sm font-medium text-subtle">{viewLabel}</span>

      {/* Global search — real ⌘K palette lands with the global-search bonus (Phase 7) */}
      <button
        type="button"
        onClick={() => toast.info("Global search lands in Phase 7")}
        className="mx-auto flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-elevated/50 px-3 text-sm text-subtle transition-colors hover:border-ring/40"
      >
        <SearchIcon className="size-4" />
        <span>Search meetings, transcripts, tasks…</span>
        <kbd className="ml-auto rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          Ctrl K
        </kbd>
      </button>

      <div className="flex items-center gap-2">
        {/* free-plan chip — mirrors the real "3 Free meetings" counter */}
        <span className="hidden items-center gap-1.5 text-xs text-subtle md:flex">
          Free meetings
          <span className="rounded-full bg-success/15 px-1.5 py-0.5 font-semibold text-success">
            3
          </span>
        </span>

        <Button
          variant="outline"
          size="sm"
          className="border-success/40 text-success hover:bg-success/10 hover:text-success"
          onClick={() => toast.info("Upgrade — coming soon")}
        >
          Upgrade
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
          onClick={() => toast.info("No new notifications")}
        >
          <BellIcon className="size-4" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" />
        </Button>

        <CaptureMenu />
      </div>
    </header>
  );
}
