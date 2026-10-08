import { cn } from "cn";

/**
 * Fireflies logo — dark squircle tile with a pink→magenta gradient "F" mark.
 * Mirrors the real app icon (docs/01-UIUX-RESEARCH.md §1).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <defs>
        <linearGradient id="fireflies-f" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff3d8b" />
          <stop offset="1" stopColor="#c2185b" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="#14141c" stroke="rgba(255,255,255,0.1)" />
      {/* stylized "F" — top arm, mid arm, stem */}
      <rect x="7" y="8" width="15" height="4.5" rx="2.25" fill="url(#fireflies-f)" />
      <rect x="7" y="15" width="10" height="4.5" rx="2.25" fill="url(#fireflies-f)" />
      <rect x="7" y="8" width="4.5" height="16" rx="2.25" fill="url(#fireflies-f)" />
    </svg>
  );
}
