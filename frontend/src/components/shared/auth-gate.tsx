"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { isAuthed } from "@/lib/auth";

/**
 * Mock auth guard for every (app) route — redirects to the login replica
 * until the user has "signed in" (any method on /login works).
 */
const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("fireflies-auth-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("fireflies-auth-change", callback);
  };
};

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ready = useSyncExternalStore<boolean | null>(subscribe, isAuthed, () => null);

  useEffect(() => {
    if (ready === false) {
      router.replace("/login");
    }
  }, [router, ready]);

  // Render nothing while checking — avoids a flash of unauthenticated UI
  if (!ready) return null;
  return <>{children}</>;
}
