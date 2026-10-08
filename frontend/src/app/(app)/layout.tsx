import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";

/**
 * Layout for every authenticated route — the app shell (sidebar + topbar)
 * plus the global toast stack (assignment: notifications/toasts).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      <Toaster theme="dark" position="bottom-right" />
    </AppShell>
  );
}
