"use client";

import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BellIcon, LogOutIcon, SearchIcon, SettingsIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const router = useRouter();
  const viewLabel = VIEW_LABELS[pathname] ?? "Fireflies";
  const { data: me } = useQuery({ queryKey: qk.me, queryFn: () => api.getMe() });
  const initial = (me?.name ?? "V")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      <span className="w-20 shrink-0 text-sm font-medium text-subtle">{viewLabel}</span>

      {/* Global search — real ⌘K palette lands with the global-search bonus (Phase 7) */}
      <button
        type="button"
        onClick={() => toast.info("Global search lands in Phase 7")}
        className="mx-auto flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-subtle transition-colors hover:border-ring/40"
      >
        <SearchIcon className="size-4" />
        <span className="truncate">Search by title or keyword</span>
        <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[10px] text-muted-foreground">
          <kbd className="rounded border border-border bg-elevated px-1.5 py-0.5">Ctrl</kbd>+
          <kbd className="rounded border border-border bg-elevated px-1.5 py-0.5">K</kbd>
        </span>
      </button>

      <div className="flex items-center gap-2">
        {/* free-plan chip — muted forest-green circle + label (like the original) */}
        <span className="hidden items-center gap-1.5 text-xs text-subtle md:flex">
          <span className="flex size-4 items-center justify-center rounded-full bg-[#3b8156] text-[10px] font-bold text-white">
            3
          </span>
          Free meetings
        </span>

        <button
          type="button"
          onClick={() => toast.info("Upgrade — coming soon")}
          className="rounded-md bg-[#11321f] px-2.5 py-1.5 text-sm font-medium text-success transition-colors hover:bg-[#17452c]"
        >
          Upgrade
        </button>

        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
          onClick={() => toast.info("No new notifications")}
        >
          <BellIcon className="size-4" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-destructive" />
        </Button>

        <CaptureMenu />

        {/* profile placeholder (assignment: "profile/settings placeholders") */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Profile"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-bold text-foreground transition-colors hover:bg-accent"
            >
              {initial}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-medium text-foreground">{me?.name ?? "Vishesh Gupta"}</p>
              <p className="text-xs font-normal text-subtle">{me?.email ?? ""}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <UserIcon /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <SettingsIcon /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                signOut();
                toast.info("Signed out");
                router.replace("/login");
              }}
            >
              <LogOutIcon /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
