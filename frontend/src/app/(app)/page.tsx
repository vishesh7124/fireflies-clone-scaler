"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarPlusIcon,
  ChevronRightIcon,
  DownloadIcon,
  MonitorIcon,
  PlayIcon,
  PlusIcon,
  SettingsIcon,
  SmartphoneIcon,
  SparklesIcon,
  UploadIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { formatDate } from "@/lib/format";
import { useUiStore } from "@/store/ui-store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardStats } from "@/components/home/dashboard-stats";
import { MeetingRow } from "@/components/meetings/meeting-row";
import { SegmentedTabs } from "@/components/shared/segmented-tabs";

/**
 * Home — the real app's dashboard (docs/01 §5.2): welcome hero, Quick Start
 * tiles (→ real create dialogs), stats strip, Recent/Upcoming/AI Feed tabs
 * with live data, and the Try More cards.
 */

const TILES: { label: string; icon: LucideIcon; bg: string; iconColor: string; action: "schedule" | "upload" | "soon" }[] = [
  { label: "Schedule Meeting", icon: CalendarPlusIcon, bg: "bg-[#3a1423]", iconColor: "text-[#f2a4b4]", action: "schedule" },
  { label: "Upload File", icon: UploadIcon, bg: "bg-[#0c2622]", iconColor: "text-[#8ee6d3]", action: "upload" },
  { label: "Capture Meeting", icon: PlusIcon, bg: "bg-[#17152e]", iconColor: "text-[#a5a0ff]", action: "soon" },
];

const TABS = ["Recent", "Upcoming", "AI Feed"];

export default function HomePage() {
  const [tab, setTab] = useState("Recent");
  const openSchedule = useUiStore((s) => s.openSchedule);
  const openUpload = useUiStore((s) => s.openUpload);

  const { data: me } = useQuery({ queryKey: qk.me, queryFn: () => api.getMe() });
  const { data: dashboard, isPending } = useQuery({
    queryKey: qk.dashboard,
    queryFn: () => api.getDashboard(),
  });

  const firstName = (me?.name ?? "Vishesh Gupta").split(/\s+/)[0].toUpperCase();

  const openTile = (action: "schedule" | "upload" | "soon", label: string) => () => {
    if (action === "schedule") openSchedule();
    else if (action === "upload") openUpload();
    else toast.info(`${label} — coming soon`);
  };

  return (
    <div className="mx-auto w-full max-w-[880px] space-y-8 p-8">
      {/* welcome hero — warm copper card (original.png) */}
      <section className="flex items-center gap-8 rounded-xl border border-[#241812] bg-gradient-to-b from-[#3a1f0f] to-[#5a2d12] p-6">
        <div className="min-w-0 space-y-2">
          <h1 className="font-display text-2xl font-semibold text-[#f5ede4]">
            Welcome aboard, {firstName}!
          </h1>
          <p className="text-sm leading-relaxed text-[#d8ccbd]">
            Fireflies is now ready to automate your meetings and streamline your workflows.
          </p>
        </div>
        {/* stylized laptop mockup with copper border */}
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

      {/* quick start tiles — open the real create dialogs */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Quick Start</h2>
        <p className="text-sm text-muted-foreground">
          Capture your first meeting or upload a recording to see Fireflies in action.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {TILES.map(({ label, icon: Icon, bg, iconColor, action }) => (
            <button
              key={label}
              type="button"
              onClick={openTile(action, label)}
              className={`flex h-[52px] items-center gap-3 rounded-xl px-4 text-left transition-opacity hover:opacity-90 ${bg}`}
            >
              <Icon className={`size-4 shrink-0 ${iconColor}`} />
              <span className="truncate text-sm font-medium text-foreground">{label}</span>
              <ChevronRightIcon className="ml-auto size-4 shrink-0 text-foreground/60" />
            </button>
          ))}
        </div>
      </section>

      {/* stats strip */}
      {isPending || !dashboard ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-xl" />
          ))}
        </div>
      ) : (
        <DashboardStats data={dashboard} />
      )}

      {/* recent / upcoming / ai feed */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SegmentedTabs options={TABS} value={tab} onChange={setTab} />
          <button
            type="button"
            onClick={() => toast.info("Meeting list settings — coming soon")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <SettingsIcon className="size-3.5" />
            Settings
          </button>
        </div>

        {isPending || !dashboard ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : tab === "Recent" ? (
          <div className="space-y-1">
            {dashboard.recent.map((meeting) => (
              <MeetingRow key={meeting.id} meeting={meeting} />
            ))}
            {dashboard.recent.length > 0 && (
              <Link
                href="/meetings"
                className="flex items-center gap-1 pt-1 text-sm text-primary-soft hover:underline"
              >
                View all meetings <ChevronRightIcon className="size-3.5" />
              </Link>
            )}
          </div>
        ) : tab === "Upcoming" ? (
          dashboard.upcoming_list.length > 0 ? (
            <div className="space-y-1">
              {dashboard.upcoming_list.map((meeting) => (
                <MeetingRow key={meeting.id} meeting={meeting} showTags={false} />
              ))}
            </div>
          ) : (
            <EmptyTab text="No upcoming meetings — schedule one to see it here." />
          )
        ) : (
          <div className="space-y-2">
            {dashboard.ai_feed.map((entry) => (
              <Link
                key={entry.meeting_id}
                href={`/meetings/${entry.meeting_id}`}
                className="block space-y-1.5 rounded-lg border border-transparent p-3 transition-colors hover:border-border hover:bg-surface"
              >
                <p className="truncate text-sm font-medium text-foreground">{entry.title}</p>
                <p className="text-xs text-subtle">{formatDate(entry.meeting_date)}</p>
                <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {entry.headline}
                </p>
              </Link>
            ))}
            {dashboard.ai_feed.length === 0 && (
              <EmptyTab text="AI Feed fills in as your meetings get processed." />
            )}
          </div>
        )}
      </section>

      {/* try more */}
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
            <Button size="sm" onClick={() => toast.info("Desktop app — coming soon")}>
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
                <Button key={store} variant="outline" size="sm" onClick={() => toast.info(`${store} — coming soon`)}>
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

function EmptyTab({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
      <SparklesIcon className="size-5 text-subtle" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
