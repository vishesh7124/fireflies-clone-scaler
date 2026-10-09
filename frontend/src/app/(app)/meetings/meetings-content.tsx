"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ListChecksIcon, SearchIcon, SparklesIcon, VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { useDebounced } from "@/hooks/use-debounced";
import type { MeetingListItem, MeetingListParams } from "@/lib/types";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelsRail, type ChannelId } from "@/components/meetings/channels-rail";
import { MeetingRow } from "@/components/meetings/meeting-row";
import { EMPTY_FILTERS, MeetingsFilters, type FiltersState } from "@/components/meetings/meetings-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { AskFredRail } from "@/components/shared/askfred-rail";

const CHANNEL_PARAMS: Record<Exclude<ChannelId, "uploads">, Partial<MeetingListParams>> = {
  my: { channel: "My Meetings" },
  all: {},
  // no voice-agent meetings in the seed — an honest empty state for now
  voice: { source: "api" },
};

const TABS = ["Hosted by me", "Shared with me"];

/** Group meetings by date label (Today / Yesterday / date), preserving order. */
function groupByDate(meetings: MeetingListItem[]): [string, MeetingListItem[]][] {
  const groups: [string, MeetingListItem[]][] = [];
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

  for (const meeting of meetings) {
    const d = new Date(meeting.meeting_date);
    const label =
      fmtDate(d) === fmtDate(today)
        ? "Today"
        : fmtDate(d) === fmtDate(yesterday)
          ? "Yesterday"
          : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const last = groups[groups.length - 1];
    if (last && last[0] === label) {
      last[1].push(meeting);
    } else {
      groups.push([label, [meeting]]);
    }
  }
  return groups;
}

/** Channel-specific empty states (copy mirrors the real app's tone). */
function channelEmpty(channel: ChannelId) {
  if (channel === "voice")
    return (
      <EmptyState
        icon={SparklesIcon}
        title="No Voice Agent meetings yet"
        subtitle="Voice Agents run calls on your behalf — transcripts show up here. Coming soon."
      />
    );
  return (
    <EmptyState
      icon={VideoIcon}
      title="Looks like you haven't recorded a meeting yet"
      subtitle="Once you record your first meeting with Fireflies, it'll show up right here."
    />
  );
}

/**
 * Meetings — the Notebook (docs/01 §5.3): channels rail, plain-text tabs with
 * the Filters pill, toggled inline search, meeting rows, and the docked
 * AskFred rail. The shell collapses the sidebar to an icon strip here.
 */
export default function MeetingsPage() {
  const router = useRouter();

  const [channel, setChannel] = useState<ChannelId>("my");
  const [tab, setTab] = useState(TABS[0]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FiltersState>(EMPTY_FILTERS);
  const [sort, setSort] = useState<NonNullable<MeetingListParams["sort"]>>("recent");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(search);

  const params: MeetingListParams = {
    ...(channel === "uploads" ? {} : CHANNEL_PARAMS[channel]),
    q: debouncedSearch || undefined,
    participant: filters.participant || undefined,
    tag: filters.tag || undefined,
    status: filters.status || undefined,
    min_duration: filters.minDuration || undefined,
    sort,
    order: sort === "title" || sort === "date" ? "asc" : "desc",
    page,
    page_size: 20,
  };

  const { data, isPending, isFetching } = useQuery({
    queryKey: qk.meetings(params),
    queryFn: () => api.listMeetings(params),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    Boolean(filters.participant) ||
    Boolean(filters.tag) ||
    Boolean(filters.status) ||
    Boolean(filters.minDuration);

  const selectChannel = (id: ChannelId) => {
    if (id === "uploads") {
      router.push("/uploads");
      return;
    }
    setChannel(id);
    setPage(1);
  };

  return (
    <div className="flex h-full min-h-0">
      <ChannelsRail active={channel} onSelect={selectChannel} />

      {/* middle — the list */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* tab row: plain text tabs + Filters pill + toggled search (like the original) */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "text-sm transition-colors",
                t === tab
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}

          <MeetingsFilters
            filters={filters}
            onFiltersChange={(f) => {
              setFilters(f);
              setPage(1);
            }}
            sort={sort}
            onSortChange={setSort}
          />

          <div className="ml-auto flex items-center gap-2">
            {searchOpen && (
              <Input
                autoFocus
                placeholder="Search by title or keyword"
                className="h-8 w-52 text-xs"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                onKeyDown={(e) => e.key === "Escape" && setSearch("")}
              />
            )}
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Search meetings"
              className={cn(search && search.length > 0 && "border-ring/40")}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <SearchIcon className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto p-2">
          {tab === "Shared with me" ? (
            <EmptyState
              icon={SparklesIcon}
              title="Nothing shared with you yet"
              subtitle="Team sharing and collaboration are coming soon — for now this workspace holds your meetings."
            />
          ) : isPending ? (
            <div className="space-y-2 p-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            hasActiveFilters ? (
              <EmptyState
                icon={ListChecksIcon}
                title="No meetings match your filters"
                subtitle="Try clearing the search or filters to see all your meetings."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setFilters(EMPTY_FILTERS);
                    }}
                  >
                    Clear search & filters
                  </Button>
                }
              />
            ) : (
              channelEmpty(channel)
            )
          ) : (
            <div
              className={cn(
                "space-y-4 transition-opacity",
                isFetching && "opacity-60",
              )}
            >
              {groupByDate(data.items).map(([label, meetings]) => (
                <section key={label} className="space-y-1">
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">
                      {label}
                    </h3>
                    <button
                      type="button"
                      onClick={() => toast.info("Feedback — coming soon")}
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      💬 Feedback
                    </button>
                  </div>
                  {meetings.map((meeting) => (
                    <MeetingRow key={meeting.id} meeting={meeting} />
                  ))}
                </section>
              ))}
              <p className="py-6 text-center text-xs text-subtle">
                You&apos;ve reached the end of your meetings.
              </p>
            </div>
          )}
        </div>

        {/* pagination */}
        {data && data.total > data.page_size && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-subtle">
            <span>
              {data.items.length} of {data.total} meetings
            </span>
            <span className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span>
                Page {data.page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="xs"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </span>
          </div>
        )}
      </div>

      {/* right — docked AskFred rail (live chat lands in Phase 4) */}
      <AskFredRail />
    </div>
  );
}
