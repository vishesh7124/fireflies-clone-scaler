"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthed } from "@/lib/auth";

/**
 * Mock auth guard for every (app) route — redirects to the login replica
 * until the user has "signed in" (any method on /login works).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthed()) {
      router.replace("/login");
    } else {
      setReady(true);
    }
  }, [router]);

  // Render nothing while checking — avoids a flash of unauthenticated UI
  if (!ready) return null;
  return <>{children}</>;
}
