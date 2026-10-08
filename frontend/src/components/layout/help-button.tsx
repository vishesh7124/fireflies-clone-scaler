"use client";

import { CircleHelpIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Circular help bubble pinned bottom-right (like the real app). */
export function HelpButton() {
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Help"
      className="fixed bottom-6 right-6 z-40 size-10 rounded-full bg-surface text-muted-foreground hover:text-foreground"
      onClick={() => toast.info("Help center — coming soon")}
    >
      <CircleHelpIcon className="size-5" />
    </Button>
  );
}
