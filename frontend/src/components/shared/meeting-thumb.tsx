import { Logo } from "@/components/layout/logo";
import { cn } from "cn";

/**
 * Meeting row thumbnail — the pink→magenta gradient F mark in a rounded
 * square, like the real app's meeting list rows.
 */
export function MeetingThumb({ className }: { className?: string }) {
  return <Logo variant="mark" className={cn("size-10 shrink-0 rounded-[10px]", className)} />;
}
