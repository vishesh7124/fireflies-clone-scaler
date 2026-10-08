"use client";

import { CircleHelpIcon } from "lucide-react";
import { toast } from "sonner";

/** Lavender-filled help bubble pinned bottom-right (like the real app). */
export function HelpButton() {
  return (
    <button
      type="button"
      aria-label="Help"
      onClick={() => toast.info("Help center — coming soon")}
      className="fixed bottom-6 right-6 z-40 flex size-13 items-center justify-center rounded-full bg-[#c4c4e8] text-[#1e1e1f] shadow-lg transition-transform hover:scale-105"
    >
      <CircleHelpIcon className="size-6" />
    </button>
  );
}
