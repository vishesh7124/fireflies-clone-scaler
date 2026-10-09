/**
 * Shared formatting helpers — used by the mock engine, UI components, and the
 * Python seeder mirrors them (keep both in sync).
 */

import { format, parseISO } from "date-fns";

/** ISO date → "Thu, Aug 8 2024, 3:52 PM" (the real app's row style). */
export function formatRowDate(iso: string): string {
  return format(parseISO(iso), "EEE, MMM d yyyy, h:mm a");
}

/** ISO date → "Oct 5" / "Mar 15 · 11:30 AM" compact styles. */
export function formatDate(iso: string, pattern = "MMM d yyyy · h:mm a"): string {
  return format(parseISO(iso), pattern);
}

/** "14:32" (or "1:02:03" when over an hour) — the Notepad timestamp style. */
export function msToClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "1.4K" style compact duration for list rows ("28 min", "1 hr 4 min"). */
export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} hr ${m % 60} min`;
}

/** SRT timecode "00:00:04,000". */
export function msToSrt(ms: number): string {
  const total = Math.max(0, ms);
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const f = total % 1000;
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(f, 3)}`;
}

/** WebVTT timecode "00:00:04.000". */
export function msToVtt(ms: number): string {
  return msToSrt(ms).replace(",", ".");
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}
