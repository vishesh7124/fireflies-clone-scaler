import type { TranscriptSegment } from "@/lib/types";

/**
 * Transcript ↔ player sync (docs/03-LLD §5.1). The active line = the last
 * segment that started at or before the playhead (it stays highlighted until
 * the next one starts, like the real product).
 */
export function findActiveSegment(
  segments: TranscriptSegment[],
  tMs: number,
): TranscriptSegment | null {
  let lo = 0;
  let hi = segments.length - 1;
  let ans: TranscriptSegment | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].start_ms <= tMs) {
      ans = segments[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}
