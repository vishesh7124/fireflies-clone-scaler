"use client";

import { useParams } from "next/navigation";
import { NotepadView } from "@/components/notepad/notepad-view";

/**
 * Meeting detail — the Notepad (core screen): summary + transcript panels,
 * interactive player-synced transcript, smart search, AskFred.
 */
export default function MeetingPage() {
  const params = useParams<{ id: string }>();
  return <NotepadView meetingId={Number(params.id)} />;
}
