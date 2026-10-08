import { cn } from "cn";

/**
 * Fireflies logo — stylized "F" (top arm, mid arm, stem).
 * - `tile`: dark squircle tile + pink→magenta gradient F (app icon / favicon)
 * - `mark`: pink→magenta gradient tile + white F (meeting row thumbnails)
 * Mirrors the real brand mark (docs/01-UIUX-RESEARCH.md §1).
 */
export function Logo({
  className,
  variant = "tile",
}: {
  className?: string;
  variant?: "tile" | "mark";
}) {
  const glyph = variant === "tile" ? "url(#fireflies-f)" : "#ffffff";
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <defs>
        <linearGradient id="fireflies-f" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff3d8b" />
          <stop offset="1" stopColor="#c2185b" />
        </linearGradient>
      </defs>
      <rect
        width="32"
        height="32"
        rx="8"
        fill={variant === "tile" ? "#161021" : "url(#fireflies-f)"}
        stroke={variant === "tile" ? "rgba(255,255,255,0.1)" : undefined}
      />
      <rect x="7" y="8" width="15" height="4.5" rx="2.25" fill={glyph} />
      <rect x="7" y="15" width="10" height="4.5" rx="2.25" fill={glyph} />
      <rect x="7" y="8" width="4.5" height="16" rx="2.25" fill={glyph} />
    </svg>
  );
}
