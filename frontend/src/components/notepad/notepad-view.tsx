"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, Loader2Icon } from "lucide-react";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { formatDate } from "@/lib/format";
import { usePlayerStore } from "@/store/player-store";
import { useNotepadStore } from "@/store/notepad-store";
import { Skeleton } from "@/components/ui/skeleton";
import { ParticipantStack } from "@/components/shared/participant-stack";
import { NotepadHeader } from "./notepad-header";
import { IconRail } from "./icon-rail";
import { SplitLayout } from "./split-layout";
import { SummaryPanel } from "./summary-panel";
import { TranscriptPanel } from "./transcript-panel";
import { PlayerEngine } from "./player-engine";
import { SmartSearchPanel } from "./panels/smart-search-panel";
import { IndexPanel } from "./panels/index-panel";
import { SoundbitesPanel } from "./panels/soundbites-panel";
import { CommentsPanel } from "./panels/comments-panel";
import { BookmarksPanel } from "./panels/bookmarks-panel";
import { AskFredPanel } from "./panels/askfred-panel";

/** Loading skeleton shaped like the Notepad. */
function NotepadSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-border px-4 py-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex-1 space-y-3 p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-1.5 flex-1" />
          </div>
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Processing state — polls until the background task flips the meeting to ready. */
function ProcessingView() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <Loader2Icon className="size-8 animate-spin text-primary-soft" />
      <p className="font-display text-lg font-semibold text-foreground">
        Fred is processing your meeting…
      </p>
      <p className="text-sm text-muted-foreground">
        Transcribing and generating the summary, action items, and topics.
      </p>
    </div>
  );
}

/** Scheduled state — no transcript yet. */
function ScheduledView({ meetingId }: { meetingId: number }) {
  const { data: meeting } = useQuery({
    queryKey: qk.meeting(meetingId),
    queryFn: () => api.getMeeting(meetingId),
  });
  if (!meeting) return null;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <CalendarIcon className="size-8 text-muted-foreground" />
      <h1 className="font-display text-xl font-semibold text-foreground">{meeting.title}</h1>
      <p className="text-sm text-muted-foreground">
        Scheduled for {formatDate(meeting.meeting_date, "EEE, MMM d yyyy · h:mm a")} — the
        transcript will appear here after the meeting.
      </p>
      <ParticipantStack participants={meeting.participants} max={6} />
      <p className="max-w-sm text-xs text-subtle">
        The Fireflies notetaker joins automatically based on your settings. (Bot capture is a
        mocked feature.)
      </p>
    </div>
  );
}

/**
 * NotepadView — the core screen (docs/01 §5.4): two-panel layout (summary left,
 * transcript right), collapsible icon rail, side panels, and the headless
 * player engine that drives transcript sync.
 */
export function NotepadView({ meetingId }: { meetingId: number }) {
  const activePanel = useNotepadStore((s) => s.activePanel);

  const { data: meeting, isPending } = useQuery({
    queryKey: qk.meeting(meetingId),
    queryFn: () => api.getMeeting(meetingId),
    // poll while the mock BackgroundTask processes a fresh upload
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? 1200 : false,
  });

  const meetingStatus = meeting?.status;

  const { data: transcript } = useQuery({
    queryKey: qk.transcript(meetingId),
    queryFn: () => api.getTranscript(meetingId),
    enabled: meetingStatus === "ready",
  });

  // reset playback state when entering/leaving the Notepad
  const reset = usePlayerStore((s) => s.reset);
  useEffect(() => {
    reset();
    return () => reset();
  }, [reset, meetingId]);

  if (isPending) return <NotepadSkeleton />;
  if (!meeting) return <NotepadSkeleton />;
  if (meeting.status === "processing") return <ProcessingView />;
  if (meeting.status === "scheduled") return <ScheduledView meetingId={meetingId} />;
  if (!transcript) return <NotepadSkeleton />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PlayerEngine durationMs={transcript.duration_ms} mediaUrl={meeting.media_url} />
      <NotepadHeader meeting={meeting} />

      <div className="flex min-h-0 flex-1">
        <IconRail />

        {activePanel === "smart-search" && (
          <SmartSearchPanel meeting={meeting} transcript={transcript} />
        )}
        {activePanel === "index" && <IndexPanel meetingId={meeting.id} />}
        {activePanel === "soundbites" && <SoundbitesPanel meetingId={meeting.id} />}
        {activePanel === "comments" && <CommentsPanel meetingId={meeting.id} transcript={transcript} />}
        {activePanel === "bookmarks" && <BookmarksPanel meetingId={meeting.id} transcript={transcript} />}
        {activePanel === "askfred" && <AskFredPanel meeting={meeting} />}

        <SplitLayout
          summary={<SummaryPanel meeting={meeting} />}
          transcript={<TranscriptPanel meeting={meeting} transcript={transcript} />}
        />
      </div>
    </div>
  );
}
