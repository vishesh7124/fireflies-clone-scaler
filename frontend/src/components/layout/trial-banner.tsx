"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import { toast } from "sonner";

/** Thin dismissible strip at the very top — copy from the real app. */
export function TrialBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="flex shrink-0 items-center justify-center gap-1.5 border-b border-border bg-[#211b3a] px-4 py-1.5 text-xs text-muted-foreground">
      <span className="truncate">You are eligible for 7 days business plan free trial.</span>
      <button
        type="button"
        onClick={() => toast.info("Free trial — coming soon")}
        className="font-medium text-primary hover:underline"
      >
        Start free trial →
      </button>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss banner"
        className="ml-2 text-subtle transition-colors hover:text-foreground"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}
