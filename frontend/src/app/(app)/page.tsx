"use client";

import {
  CalendarPlusIcon,
  ChevronRightIcon,
  DownloadIcon,
  MonitorIcon,
  PlayIcon,
  PlusIcon,
  SettingsIcon,
  SmartphoneIcon,
  UploadIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";

/**
 * Home — replicates the real app's layout (docs/01 §5.2): warm copper hero,
 * solid-tinted Quick Start tiles, Recent/Upcoming/AI Feed tabs, Try More cards.
 * Lists are static placeholders until the mock data layer lands (Phase 1-2).
 */

// Solid tinted tiles (colors sampled from the original screenshot)
const TILES: { label: string; icon: LucideIcon; bg: string; iconColor: string }[] = [
  { label: "Schedule Meeting", icon: CalendarPlusIcon, bg: "bg-[#3a1423]", iconColor: "text-[#f2a4b4]" },
  { label: "Upload File", icon: UploadIcon, bg: "bg-[#0c2622]", iconColor: "text-[#8ee6d3]" },
  { label: "Capture Meeting", icon: PlusIcon, bg: "bg-[#17152e]", iconColor: "text-[#a5a0ff]" },
];

const TABS = ["Recent", "Upcoming", "AI Feed"];

export default function HomePage() {
  const soon = (what: string) => () => toast.info(`${what} — coming soon`);

  return (
    <div className="mx-auto w-full max-w-[880px] space-y-8 p-8">
      {/* welcome hero — warm brown/copper gradient card, like the original */}
      <section className="flex items-center gap-8 rounded-xl border border-[#241812] bg-gradient-to-b from-[#3a1f0f] to-[#5a2d12] p-6">
        <div className="min-w-0 space-y-2">
          <h1 className="font-display text-2xl font-semibold text-[#f5ede4]">
            Welcome aboard, VISHESH!
          </h1>
          <p className="text-sm leading-relaxed text-[#d8ccbd]">
            Fireflies is now ready to automate your meetings and streamline your
            workflows.
          </p>
        </div>

        {/* stylized laptop mockup with copper border (like the original) */}
        <div className="hidden w-52 shrink-0 sm:block">
          <div className="rounded-lg border border-[#e8955c]/40 bg-gradient-to-b from-[#7a4520] to-[#4a2610] p-2">
            <div className="relative aspect-video rounded-md bg-gradient-to-br from-[#e8955c]/25 via-[#c97b3d]/10 to-transparent">
              <span className="absolute inset-0 m-auto flex size-9 items-center justify-center rounded-full bg-[#f5ede4]/90">
                <PlayIcon className="size-4 text-[#5a2d12]" />
              </span>
            </div>
            <div className="mx-auto mt-1.5 h-1.5 w-3/4 rounded-full bg-[#e8955c]/25" />
          </div>
        </div>
      </section>

      {/* quick start — solid tinted tiles, one-line labels, 52px rows */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Quick Start</h2>
        <p className="text-sm text-muted-foreground">
          Capture your first meeting or upload a recording to see Fireflies in
          action.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {TILES.map(({ label, icon: Icon, bg, iconColor }) => (
            <button
              key={label}
              type="button"
              onClick={soon(label)}
              className={cn(
                "flex h-[52px] items-center gap-3 rounded-xl px-4 text-left transition-opacity hover:opacity-90",
                bg,
              )}
            >
              <Icon className={cn("size-4 shrink-0", iconColor)} />
              <span className="truncate text-sm font-medium text-foreground">{label}</span>
              <ChevronRightIcon className="ml-auto size-4 shrink-0 text-foreground/60" />
            </button>
          ))}
        </div>
      </section>

      {/* recent / upcoming / ai feed — TODO(phase-2): live lists */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-lg bg-[#2c2d31] p-1">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                type="button"
                onClick={() => toast.info("Lists land in Phase 2")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  i === 0
                    ? "bg-[#3a3a3d] text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={soon("Meeting list settings")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <SettingsIcon className="size-3.5" />
            Settings
          </button>
        </div>

        {/* recent meeting row (placeholder — the mock list replaces this in Phase 2) */}
        <button
          type="button"
          onClick={soon("Open meeting")}
          className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-surface"
        >
          <Logo variant="mark" className="size-10 shrink-0 rounded-[10px]" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">
              Fireflies AI Platform Quick Overview
            </span>
            <span className="block text-xs text-subtle">Thu, Aug 8 2024, 3:52 PM</span>
          </span>
        </button>
      </section>

      {/* try more — desktop & mobile app cards */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Try More</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <MonitorIcon className="size-5" />
              </span>
              <span className="text-sm font-semibold text-foreground">Desktop App</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Capture conversations without any bot present in your meeting.
            </p>
            <Button size="sm" onClick={soon("Desktop app")}>
              <DownloadIcon className="size-3.5" />
              Download
            </Button>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <SmartphoneIcon className="size-5" />
              </span>
              <span className="text-sm font-semibold text-foreground">Mobile App</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Record in-person conversations and review meetings on the go.
            </p>
            <div className="flex gap-2">
              {["App Store", "Google Play"].map((store) => (
                <Button key={store} variant="outline" size="sm" onClick={soon(store)}>
                  {store}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
