import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/**
 * Global app chrome — sidebar + topbar around every authenticated route.
 * Layout replicates the real app shell (docs/01-UIUX-RESEARCH.md §4).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
