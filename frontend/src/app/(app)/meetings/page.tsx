import MeetingsContent from "./meetings-content";

/**
 * Meetings — the Notebook (docs/01 §5.3). Fully client-driven (queries +
 * filters + state), so we opt out of Next.js 16's Partial Prerendering
 * "instant navigation" validation.
 */
export const instant = false;

export default function MeetingsPage() {
  return <MeetingsContent />;
}
