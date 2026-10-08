import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { TrialBanner } from "./trial-banner";
import { HelpButton } from "./help-button";

/**
 * Global app chrome — trial strip, sidebar, topbar and the ambient-glow
 * content canvas. Layout replicates the real app shell (docs/01 §4).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <TrialBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      <HelpButton />
    </div>
  );
}
