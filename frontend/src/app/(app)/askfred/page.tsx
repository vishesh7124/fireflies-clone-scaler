import AskFredContent from "./askfred-content";

/**
 * AskFred (global) — full-page chat with citation chips (docs/01 §5.6).
 * Fully client-driven, so we opt out of Next.js 16's PPR instant-navigation
 * validation.
 */
export const instant = false;

export default function AskFredPage() {
  return <AskFredContent />;
}
