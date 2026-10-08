import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/app/providers";

/**
 * Layout for every authenticated route — providers, the app shell
 * (sidebar + topbar) and the global toast stack.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AppShell>
        {children}
        <Toaster theme="dark" position="bottom-right" />
      </AppShell>
    </Providers>
  );
}
