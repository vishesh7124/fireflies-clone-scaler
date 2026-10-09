"use client";

import { Button } from "@/components/ui/button";

/** Distinguish failed requests from legitimately empty content. */
export function DataError({ title = "Could not load data", onRetry }: { title?: string; onRetry: () => void }) {
  return <div role="alert" className="flex flex-col items-center gap-3 px-4 py-10 text-center">
    <p className="text-sm font-medium text-foreground">{title}</p>
    <p className="text-xs text-subtle">Check your connection and try again.</p>
    <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
  </div>;
}
