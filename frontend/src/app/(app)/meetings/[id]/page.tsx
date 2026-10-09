"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { formatDate, formatDuration } from "@/lib/format";
import { ParticipantStack } from "@/components/shared/participant-stack";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Meeting detail placeholder — the full Notepad (interactive transcript,
 * summary panel, smart search) lands in Phase 3. This keeps row navigation
 * working and shows the meeting's real metadata meanwhile.
 */
export default function MeetingPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data: meeting, isPending } = useQuery({
    queryKey: qk.meeting(id),
    queryFn: () => api.getMeeting(id),
  });

  return (
    <div className="mx-auto w-full max-w-[880px] space-y-6 p-8">
      <Link
        href="/meetings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" /> Notebook
      </Link>

      {isPending || !meeting ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ) : (
        <div className="space-y-3">
          <h1 className="font-display text-2xl font-semibold text-foreground">{meeting.title}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <span>{formatDate(meeting.meeting_date)}</span>
            {meeting.duration_seconds != null && (
              <>
                <span aria-hidden>·</span>
                <span>{formatDuration(meeting.duration_seconds)}</span>
              </>
            )}
            <ParticipantStack participants={meeting.participants} />
          </div>
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            The Notepad — interactive transcript synced to the player, AI summary, action items,
            and smart search — lands in Phase 3.
          </p>
        </div>
      )}
    </div>
  );
}
