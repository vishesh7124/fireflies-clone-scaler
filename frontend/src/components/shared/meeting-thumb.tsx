import { PlayIcon } from "lucide-react";
import { cn } from "cn";

/** Deterministic muted gradients so rows read as video thumbnails. */
const GRADIENTS = [
  "from-[#3a3a46] to-[#1f1f2a]",
  "from-[#33303c] to-[#1d1d28]",
  "from-[#2d3138] to-[#1c1f26]",
];

/**
 * Meeting row thumbnail — the original shows a small muted video thumbnail
 * (not a logo mark); a quiet gradient with a play glyph reads the same.
 */
export function MeetingThumb({ id, className }: { id: number; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
        GRADIENTS[id % GRADIENTS.length],
        className,
      )}
    >
      <PlayIcon className="size-3 text-subtle" />
    </span>
  );
}
