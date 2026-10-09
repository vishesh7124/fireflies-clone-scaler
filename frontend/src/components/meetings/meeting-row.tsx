"use client";

import { useRouter } from "next/navigation";
import { formatDuration, formatRowDate } from "@/lib/format";
import type { MeetingListItem } from "@/lib/types";
import { cn } from "cn";
import { MeetingThumb } from "@/components/shared/meeting-thumb";
import { ParticipantStack } from "@/components/shared/participant-stack";
import { MeetingActions } from "./meeting-actions";

/** Status badge for non-ready meetings (processing animates, like the real app). */
function StatusBadge({ status }: { status: MeetingListItem["status"] }) {
  if (status === "ready") return null;
  if (status === "processing")
    return (
      <span className="animate-pulse rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary-soft">
        Processing…
      </span>
    );
  return (
    <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
      Scheduled
    </span>
  );
}

/**
 * One meeting row — thumb, title, date · duration · tags, participant stack,
 * 3-dot actions. Click navigates to the Notepad. Layout replicates the real
 * app's meeting list rows.
 */
export function MeetingRow({
  meeting,
  showTags = true,
  className,
}: {
  meeting: MeetingListItem;
  showTags?: boolean;
  className?: string;
}) {
  const router = useRouter();

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-transparent p-3 transition-colors hover:border-border hover:bg-surface",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => router.push(`/meetings/${meeting.id}`)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <MeetingThumb />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{meeting.title}</span>
            <StatusBadge status={meeting.status} />
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle">
            <span className="whitespace-nowrap">{formatRowDate(meeting.meeting_date)}</span>
            {meeting.duration_seconds != null && (
              <>
                <span aria-hidden>·</span>
                <span className="whitespace-nowrap">{formatDuration(meeting.duration_seconds)}</span>
              </>
            )}
            {showTags &&
              meeting.tags.map((tag) => (
                <span
                  key={tag.name}
                  className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
          </span>
        </span>
      </button>

      <ParticipantStack participants={meeting.participants} />
      <MeetingActions meeting={meeting} />
    </div>
  );
}
