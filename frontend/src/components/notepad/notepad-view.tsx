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
import { NotesPanel } from "./notes-panel";
import { TranscriptPanel } from "./transcript-panel";
import { TransportBar } from "./transport-bar";
import { PlayerEngine } from "./player-engine";
import { SmartSearchPanel } from "./panels/smart-search-panel";
import { SoundbitesPanel } from "./panels/soundbites-panel";
import { CommentsPanel } from "./panels/comments-panel";
import { BookmarksPanel } from "./panels/bookmarks-panel";
import { Sidebar } from "@/components/layout/sidebar";

/** Loading skeleton shaped like the Notepad. */
function NotepadSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center gap-3 border-b border-border px-3">
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-72 space-y-3 border-r border-border p-3">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
        <div className="flex-1 space-y-4 p-5">
          <Skeleton className="aspect-video w-full rounded-lg" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-16 w-full" />
        </div>
        <div className="w-80 space-y-3 border-l border-border p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
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
 * NotepadView — the core screen, rebuilt to the original's 4-zone layout
 * (notepad1-4.png): breadcrumb header bar, icon rail + Smart Search side
 * panel, the center Notes column (video + summary + action items), the
 * right Transcript/AskFred column, and the bottom transport bar.
 */
export function NotepadView({ meetingId }: { meetingId: number }) {
  const activePanel = useNotepadStore((s) => s.activePanel);
  const transcriptHidden = useNotepadStore((s) => s.transcriptHidden);
  const sidebarOpen = useNotepadStore((s) => s.sidebarOpen);
  const setSidebarOpen = useNotepadStore((s) => s.setSidebarOpen);

  const { data: meeting, isPending } = useQuery({
    queryKey: qk.meeting(meetingId),
    queryFn: () => api.getMeeting(meetingId),
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
        {activePanel === "soundbites" && <SoundbitesPanel meetingId={meeting.id} />}
        {activePanel === "comments" && (
          <CommentsPanel meetingId={meeting.id} transcript={transcript} />
        )}
        {activePanel === "bookmarks" && (
          <BookmarksPanel meetingId={meeting.id} transcript={transcript} />
        )}

        <NotesPanel meeting={meeting} />
        {!transcriptHidden && <TranscriptPanel meeting={meeting} transcript={transcript} />}
      </div>

      <TransportBar meeting={meeting} />

      {/* slide-in sidebar overlay — the real Notepad's hamburger opens this */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden
      />
      <div
        className={`fixed left-0 top-0 z-50 h-dvh transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar variant="full" />
      </div>
    </div>
  );
}
