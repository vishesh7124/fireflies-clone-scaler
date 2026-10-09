"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarIcon,
  CheckIcon,
  DownloadIcon,
  InfoIcon,
  MessageSquareIcon,
  MonitorIcon,
  RssIcon,
  SettingsIcon,
  SmartphoneIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingRow } from "@/components/meetings/meeting-row";
import { SegmentedTabs } from "@/components/shared/segmented-tabs";
import { AskFredRail } from "@/components/shared/askfred-rail";

/**
 * Home — replicates the real app's dashboard (docs/01 §5.2): time-of-day
 * greeting + Feedback link, the Personal Assistant row (Daily Brief / Meeting
 * Prep / Tasks cards), Recent/Upcoming/AI Feed tabs with compact rows and the
 * "All caught up!" badge, Try More, and the docked AskFred rail.
 */

const TABS = ["Recent", "Upcoming", "AI Feed"];

/** Time-of-day greeting, like the original ("Good Morning, VISHESH 🌤️"). */
function greeting(): { salutation: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { salutation: "Good Morning", emoji: "🌤️" };
  if (hour < 17) return { salutation: "Good Afternoon", emoji: "⛅" };
  return { salutation: "Good Evening", emoji: "🌙" };
}

export default function HomePage() {
  const router = useRouter();
  const [tab, setTab] = useState("Recent");
  const { salutation, emoji } = greeting();

  const { data: me } = useQuery({ queryKey: qk.me, queryFn: () => api.getMe() });
  const { data: dashboard, isPending } = useQuery({
    queryKey: qk.dashboard,
    queryFn: () => api.getDashboard(),
  });

  const firstName = (me?.name ?? "Vishesh Gupta").split(/\s+/)[0].toUpperCase();
  const nextUpcoming = dashboard?.upcoming_list[0];

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[884px] space-y-8 px-8 py-10">
          {/* greeting + feedback (like the original) */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="font-display text-2xl font-semibold text-foreground">
              {salutation}, {firstName} {emoji}
            </h1>
            <button
              type="button"
              onClick={() => toast.info("Feedback — coming soon")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <MessageSquareIcon className="size-3.5" />
              Feedback
            </button>
          </div>

          {/* personal assistant row (like the original) */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              Personal Assistant
              <InfoIcon className="size-3.5 text-subtle" />
            </span>
            <Link href="/settings" className="text-sm text-muted-foreground hover:underline">
              Manage
            </Link>
          </div>

          {/* Daily Brief / Meeting Prep / Tasks cards (like the original) */}
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => toast.info("Daily Brief — coming soon")}
               className="flex min-h-[126px] flex-col items-start gap-4 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-ring/40"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/40 text-white">
                <RssIcon className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-medium text-foreground">Daily Brief</span>
                <span className="block text-xs text-subtle">No brief yet</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                nextUpcoming ? router.push(`/meetings/${nextUpcoming.id}`) : toast.info("No upcoming meetings")
              }
               className="flex min-h-[126px] flex-col items-start gap-4 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-ring/40"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-warning/40 text-white">
                <CalendarIcon className="size-4" />
              </span>
              <span className="min-w-0 max-w-full">
                <span className="block text-sm font-medium text-foreground">Meeting Prep</span>
                <span className="block truncate text-xs text-subtle">
                  {nextUpcoming
                    ? `${formatDate(nextUpcoming.meeting_date, "MMM d · h:mm a")} · ${nextUpcoming.title}`
                    : "No upcoming meetings"}
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => router.push("/tasks")}
               className="flex min-h-[126px] flex-col items-start gap-4 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-ring/40"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-success/40 text-white">
                <CheckIcon className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-medium text-foreground">Tasks</span>
                <span className="block text-xs text-subtle">Last 7 Days</span>
              </span>
            </button>
          </div>

          {/* recent / upcoming / ai feed */}
          <section className="space-y-5 pt-3">
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
                  <MeetingRow key={meeting.id} meeting={meeting} meta="compact" showActions={false} />
                ))}
                <p className="flex justify-center pt-2">
                  <span className="rounded bg-primary/15 px-2 py-1 text-xs font-medium text-primary-soft">
                    All caught up!
                  </span>
                </p>
              </div>
            ) : tab === "Upcoming" ? (
              dashboard.upcoming_list.length > 0 ? (
                <div className="space-y-1">
                  {dashboard.upcoming_list.map((meeting) => (
                    <MeetingRow key={meeting.id} meeting={meeting} meta="compact" showActions={false} />
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  No upcoming meetings — schedule one to see it here.
                </p>
              )
            ) : (
              <div className="space-y-2">
                {dashboard.ai_feed.map((entry) => (
                  <Link
                    key={entry.meeting_id}
                    href={`/meetings/${entry.meeting_id}`}
                    className="block space-y-1 rounded-lg p-3 transition-colors hover:bg-surface"
                  >
                    <p className="truncate text-sm font-medium text-foreground">{entry.title}</p>
                    <p className="text-xs text-subtle">{formatDate(entry.meeting_date)}</p>
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {entry.headline}
                    </p>
                  </Link>
                ))}
                {dashboard.ai_feed.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                    AI Feed fills in as your meetings get processed.
                  </p>
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
                  <span className="flex size-10 items-center justify-center rounded-lg bg-elevated text-primary-soft">
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
                  <span className="flex size-10 items-center justify-center rounded-lg bg-elevated text-primary-soft">
                    <SmartphoneIcon className="size-5" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">Mobile App</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Record in-person conversations and review meetings on the go.
                </p>
                <div className="flex gap-2">
                  {["App Store", "Google Play"].map((store) => (
                    <Button
                      key={store}
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info(`${store} — coming soon`)}
                    >
                      {store}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* right — docked AskFred rail (live chat lands in Phase 4) */}
      <AskFredRail />
    </div>
  );
}
