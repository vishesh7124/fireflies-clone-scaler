"use client";

import { useState } from "react";
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
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";

/**
 * Home — replicates the real app's layout (docs/01 §5.2): welcome hero,
 * Quick Start tiles, Recent/Upcoming/AI Feed tabs, Try More cards, and the
 * floating promo card. Lists are static placeholders until the mock data
 * layer lands in Phase 1-2 (TODO(phase-2)).
 */

const TILES: { label: string; icon: LucideIcon; tint: string }[] = [
  { label: "Schedule Meeting", icon: CalendarPlusIcon, tint: "bg-[#e5484d]/15 text-[#e5484d]" },
  { label: "Upload File", icon: UploadIcon, tint: "bg-[#2dd4bf]/15 text-[#2dd4bf]" },
  { label: "Capture Meeting", icon: PlusIcon, tint: "bg-primary/15 text-primary" },
];

const TABS = ["Recent", "Upcoming", "AI Feed"];

export default function HomePage() {
  const [promoVisible, setPromoVisible] = useState(true);
  const soon = (what: string) => () => toast.info(`${what} — coming soon`);

  return (
    <div className="mx-auto w-full max-w-[880px] space-y-8 p-8">
      {/* welcome hero — plum fill + visible border (original.png) */}
      <section className="flex items-center gap-8 rounded-xl border border-[#4a3a5a] bg-[#2a1f3d] p-6">
        <div className="min-w-0 space-y-2">
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Welcome aboard, VISHESH!
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Fireflies is now ready to automate your meetings and streamline your
            workflows.
          </p>
        </div>

        {/* video preview thumbnail — gradient, play button, avatar (like the original) */}
        <div className="relative hidden aspect-video w-56 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-primary/60 via-primary/25 to-transparent sm:block">
          <span className="absolute inset-0 m-auto flex size-10 items-center justify-center rounded-full bg-background/80">
            <PlayIcon className="size-4 text-foreground" />
          </span>
          <span className="absolute bottom-2 left-2 size-5 rounded-full border border-background/40 bg-primary/80" />
        </div>
      </section>

      {/* quick start tiles — one-line labels, 52px rows */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Quick Start</h2>
        <p className="text-sm text-muted-foreground">
          Capture your first meeting or upload a recording to see Fireflies in
          action.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {TILES.map(({ label, icon: Icon, tint }) => (
            <button
              key={label}
              type="button"
              onClick={soon(label)}
              className="flex h-[52px] items-center gap-3 rounded-lg border border-border bg-surface px-4 text-left transition-colors hover:border-ring/40"
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tint}`}
              >
                <Icon className="size-4" />
              </span>
              <span className="truncate text-sm font-medium text-foreground">{label}</span>
              <ChevronRightIcon className="ml-auto size-4 shrink-0 text-subtle" />
            </button>
          ))}
        </div>
      </section>

      {/* recent / upcoming / ai feed — TODO(phase-2): live lists */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-lg bg-surface p-1">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                type="button"
                onClick={() => toast.info("Lists land in Phase 2")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  i === 0
                    ? "bg-elevated text-foreground"
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
          className="flex w-full items-center gap-3 rounded-lg border border-transparent p-3 text-left transition-colors hover:border-border hover:bg-surface"
        >
          <Logo variant="mark" className="size-10 shrink-0 rounded-lg" />
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

      {/* floating promo card — bottom-left, dismissible (like the real app) */}
      {promoVisible && (
        <div className="fixed bottom-6 left-[264px] z-40 hidden max-w-xs flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-lg lg:flex">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              Bot-less meetings with Desktop App
            </p>
            <button
              type="button"
              onClick={() => setPromoVisible(false)}
              aria-label="Dismiss promo"
              className="text-subtle transition-colors hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <Button size="sm" onClick={soon("Desktop app")}>
              <DownloadIcon className="size-3.5" />
              Download
            </Button>
            <span className="flex gap-1.5">
              <span className="size-1.5 rounded-full bg-primary" />
              <span className="size-1.5 rounded-full bg-muted" />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
