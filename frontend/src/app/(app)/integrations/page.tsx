import IntegrationsContent from "./integrations-content";

/**
 * Integrations — the real app's integration grid (docs/01 §5.7). All
 * Connect buttons show "Coming Soon" per the assignment's mocked scope.
 * Fully client-driven, so we opt out of Next.js 16's PPR validation.
 */
export const instant = false;

export default function IntegrationsPage() {
  return <IntegrationsContent />;
}
