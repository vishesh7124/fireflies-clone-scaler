import HomeContent from "./home-content";

/**
 * Home — replicates the real app's dashboard (docs/01 §5.2). Fully
 * client-driven (queries + state), so we opt out of Next.js 16's Partial
 * Prerendering "instant navigation" validation — otherwise the dynamic
 * segment is dropped and the client handlers (Quick Start tiles, row
 * navigation, tab switches) never attach.
 */
export const instant = false;

export default function HomePage() {
  return <HomeContent />;
}
