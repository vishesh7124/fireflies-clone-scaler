"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { TrialBanner } from "./trial-banner";
import { HelpButton } from "./help-button";

/**
 * Global app chrome. Route-driven:
 * - `/meetings/:id` (the Notepad) → full-screen: the page owns all chrome
 *   (breadcrumb header, icon rail, transport bar — like the real product)
 * - `/meetings` → the sidebar collapses to an icon strip (channels rail takes over)
 * - everything else → the full sidebar + topbar shell
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isNotepad = /^\/meetings\/\d+/.test(pathname);
  const railMode = (pathname.startsWith("/meetings") && !isNotepad) || pathname.startsWith("/askfred");

  if (isNotepad) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        {children}
      </div>
    );
  }

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
