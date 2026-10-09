import { MeetingContent } from "@/components/notepad/meeting-content";

/**
 * Meeting detail — the Notepad (core screen): summary + transcript panels,
 * interactive player-synced transcript, smart search, AskFred.
 *
 * This route is fully client-driven (it reads `params` and fires queries on
 * mount), so we opt out of Next.js 16's Partial Prerendering "instant
 * navigation" validation. Without this, the dynamic segment is dropped from
 * the static shell and the client event handlers never attach, which silently
 * breaks every click.
 *
 * Note: `instant` is a server-component route-segment config, so the page
 * itself stays a server component; the client tree lives in
 * `components/notepad/meeting-content`.
 */
export const instant = false;

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MeetingContent meetingId={Number(id)} />;
}
