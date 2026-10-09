"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRightIcon, ChevronRightIcon } from "lucide-react";
import { formatDate, formatDuration } from "@/lib/format";
import type { MeetingListItem } from "@/lib/types";
import { cn } from "cn";
import { MeetingThumb } from "@/components/shared/meeting-thumb";
import { MeetingActions } from "./meeting-actions";

/** Status badge for processing meetings (scheduled is shown in the meta line). */
function StatusBadge({ status }: { status: MeetingListItem["status"] }) {
  if (status !== "processing") return null;
  return (
    <span className="animate-pulse whitespace-nowrap rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary-soft">
      Processing…
    </span>
  );
}

/**
 * One meeting row — replicates the real app's rows: muted thumbnail, title
 * (with the small up-arrow), ONE meta line ("Oct 9 · 10:57 AM · 43 min · Host"),
 * and always-visible "..." overflow + "Details >" on the right. The row gets
 * a subtle rounded border on hover (like the original's card affordance).
 * `compact` (Home) shows the meta date only.
 */
export function MeetingRow({
  meeting,
  meta = "full",
  showActions = true,
  className,
}: {
  meeting: MeetingListItem;
  meta?: "full" | "compact";
  showActions?: boolean;
  className?: string;
}) {
  const router = useRouter();

  const date = formatDate(meeting.meeting_date, "MMM d · h:mm a");
  const duration =
    meeting.duration_seconds != null ? formatDuration(meeting.duration_seconds) : "Scheduled";
  const host = meeting.participants[0]?.name ?? "";
  const metaLine = meta === "full" ? `${date} · ${duration} · ${host}` : date;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-transparent p-3 transition-colors bg-[#292929] hover:border-border hover:bg-surface",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => router.push(`/meetings/${meeting.id}`)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <MeetingThumb id={meeting.id} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{meeting.title}</span>
            <ArrowUpRightIcon className="size-3 shrink-0 text-subtle" />
            <StatusBadge status={meeting.status} />
          </span>
          <span className="mt-0.5 block truncate text-xs text-subtle">{metaLine}</span>
        </span>
      </button>

      {showActions && (
        <span className=" hidden group-hover:flex  shrink-0 items-center gap-1">
          <MeetingActions meeting={meeting} />
          <button
            type="button"
            onClick={() => router.push(`/meetings/${meeting.id}`)}
            className="flex items-center gap-0.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-elevated/60 hover:text-foreground"
          >
            Details
            <ChevronRightIcon className="size-3" />
          </button>
        </span>
      )}
    </div>
  );
}
