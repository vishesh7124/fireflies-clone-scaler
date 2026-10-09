import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/app/providers";
import { AuthGate } from "@/components/shared/auth-gate";
import { GlobalDialogs } from "@/components/shared/global-dialogs";

/**
 * Layout for every authenticated route — providers, mock-auth gate, the app
 * shell (sidebar + topbar), the global toast stack, and the globally-mounted
 * create dialogs (opened via the ui store from anywhere).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AuthGate>
        <AppShell>
          {children}
          <Toaster theme="dark" position="bottom-right" />
          <GlobalDialogs />
        </AppShell>
      </AuthGate>
    </Providers>
  );
}
