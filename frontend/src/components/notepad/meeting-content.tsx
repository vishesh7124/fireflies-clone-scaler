"use client";

import { NotepadView } from "./notepad-view";

/** Client child of the Notepad page (the parent is a server component that
 *  exports the `instant` route-segment config and resolves the route param). */
export function MeetingContent({ meetingId }: { meetingId: number }) {
  return <NotepadView meetingId={meetingId} />;
}
