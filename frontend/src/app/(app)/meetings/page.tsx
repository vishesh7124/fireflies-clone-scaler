"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, ListChecksIcon, SparklesIcon, StarIcon, UploadIcon, VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { useDebounced } from "@/hooks/use-debounced";
import type { MeetingListParams } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelsRail, type ChannelId } from "@/components/meetings/channels-rail";
import { MeetingRow } from "@/components/meetings/meeting-row";
import {
  EMPTY_FILTERS,
  MeetingsFilters,
  MeetingsSearch,
  type FiltersState,
} from "@/components/meetings/meetings-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { SegmentedTabs } from "@/components/shared/segmented-tabs";
import { useUiStore } from "@/store/ui-store";

const CHANNEL_PARAMS: Record<ChannelId, Partial<MeetingListParams>> = {
  my: { channel: "My Meetings" },
  all: {},
  // no voice-agent meetings in the seed — an honest empty state for now
  voice: { source: "api" },
  // meetings created from uploads/paste land here
  uploads: { source: "paste" },
};

/** Channel-specific empty states (copy mirrors the real app's tone). */
function channelEmpty(channel: ChannelId, openUpload: () => void) {
  if (channel === "uploads")
    return (
      <EmptyState
        icon={UploadIcon}
        title="No uploads yet"
        subtitle="Upload a transcript file or paste one — Fred processes it into a summary with action items."
        action={
          <Button size="sm" onClick={openUpload}>
            <UploadIcon /> Upload transcript
          </Button>
        }
      />
    );
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
      action={
        <Button size="sm" onClick={openUpload}>
          <UploadIcon /> Upload transcript
        </Button>
      }
    />
  );
}

/**
 * Meetings — the Notebook (docs/01 §5.3): channels rail, search + tabs +
 * filters/sort toolbar, meeting rows, pagination, and the AskFred rail.
 */
export default function MeetingsPage() {
  const router = useRouter();
  const openUpload = useUiStore((s) => s.openUpload);

  const [channel, setChannel] = useState<ChannelId>("my");
  const [tab, setTab] = useState("Hosted by me");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FiltersState>(EMPTY_FILTERS);
  const [sort, setSort] = useState<NonNullable<MeetingListParams["sort"]>>("recent");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(search);

  const params: MeetingListParams = {
    ...CHANNEL_PARAMS[channel],
    q: debouncedSearch || undefined,
    participant: filters.participant || undefined,
    tag: filters.tag || undefined,
    status: filters.status || undefined,
    min_duration: filters.minDuration || undefined,
    sort,
    order: sort === "title" ? "asc" : sort === "date" ? "asc" : "desc",
    page,
    page_size: 20,
  };

  const { data, isPending, isFetching } = useQuery({
    queryKey: qk.meetings(params),
    queryFn: () => api.listMeetings(params),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="flex h-full min-h-0">
      <ChannelsRail active={channel} onSelect={(c) => { setChannel(c); setPage(1); }} />

      {/* middle — the list */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* toolbar row 1: title + search */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <h1 className="font-display text-lg font-semibold text-foreground">Meetings</h1>
          <MeetingsSearch value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
        </div>

        {/* toolbar row 2: tabs + filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          <SegmentedTabs
            options={["Hosted by me", "Shared with me"]}
            value={tab}
            onChange={setTab}
          />
          <div className="ml-auto">
            <MeetingsFilters
              filters={filters}
              onFiltersChange={(f) => { setFilters(f); setPage(1); }}
              sort={sort}
              onSortChange={setSort}
            />
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
            debouncedSearch || filters.participant || filters.tag || filters.status || filters.minDuration ? (
              <EmptyState
                icon={ListChecksIcon}
                title="No meetings match your filters"
                subtitle="Try clearing the search or filters to see all your meetings."
                action={
                  <Button variant="outline" size="sm" onClick={() => { setSearch(""); setFilters(EMPTY_FILTERS); }}>
                    Clear search & filters
                  </Button>
                }
              />
            ) : (
              channelEmpty(channel, openUpload)
            )
          ) : (
            <div className={isFetching ? "space-y-1 opacity-60 transition-opacity" : "space-y-1 transition-opacity"}>
              {data.items.map((meeting) => (
                <MeetingRow key={meeting.id} meeting={meeting} />
              ))}
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

      {/* right — AskFred rail (presentational; the full chat lands in Phase 4) */}
      <aside className="hidden w-80 shrink-0 flex-col border-l border-border lg:flex">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <SparklesIcon className="size-4 text-primary-soft" />
          <span className="text-sm font-medium text-foreground">AskFred</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="font-display text-lg font-semibold text-foreground">Hi VISHESH!</p>
          <p className="text-sm text-muted-foreground">Get ready for your meeting</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/tasks")}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-ring/40"
            >
              <CheckIcon className="size-3 text-success" /> My action items
            </button>
            <button
              type="button"
              onClick={() => router.push("/askfred")}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-ring/40"
            >
              <StarIcon className="size-3 text-primary-soft" /> Key decisions
            </button>
            <button
              type="button"
              onClick={() => router.push("/askfred")}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-ring/40"
            >
              <SparklesIcon className="size-3 text-primary-soft" /> Key initiatives
            </button>
          </div>
        </div>
        <div className="p-3">
          <button
            type="button"
            onClick={() => router.push("/askfred")}
            className="w-full rounded-lg border border-border bg-elevated/60 px-3 py-2.5 text-left text-xs text-subtle transition-colors hover:border-ring/40"
          >
            Ask anything. Type / to run AI skills.
          </button>
        </div>
      </aside>
    </div>
  );
}
