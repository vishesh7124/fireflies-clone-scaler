"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { TrialBanner } from "./trial-banner";
import { HelpButton } from "./help-button";

/**
 * Global app chrome — trial strip, sidebar, topbar. On the Meetings page the
 * real app collapses the sidebar to a thin icon strip (channels rail takes
 * over), so the variant is route-driven. Layout replicates the real shell.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const railMode = pathname?.startsWith("/meetings") ?? false;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <TrialBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar variant={railMode ? "rail" : "full"} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      <HelpButton />
    </div>
  );
}
