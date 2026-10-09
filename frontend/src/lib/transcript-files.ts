/**
 * Client-side transcript file → "mm:ss Name: text" lines converter, so the
 * Upload dialog can feed any of .txt / .vtt / .json / .srt into the mock API's
 * `transcript_text`. Handles the real-world formats from Zoom, Google Meet,
 * Teams, Otter, Whisper, and plain text. (The backend re-implements this
 * server-side in Phase 6.)
 */

export interface ParsedTranscriptFile {
  fileName: string;
  lines: string[];
  warning?: string;
}

const timeToClock = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${String(m).padStart(1, "0")}:${p(s)}`;
};

/** Seconds/ms ambiguity heuristic: < 2h in seconds → treat as seconds. */
const toMs = (v: number): number => (v < 7_200 ? v * 1000 : v);

function vttToLines(text: string): string[] {
  const lines: string[] = [];
  const blocks = text.replace(/^WEBVTT.*\n/i, "").split(/\n\s*\n/);
  for (const block of blocks) {
    const rows = block.split(/\r?\n/).filter((r) => r.trim());
    const cue = rows.find((r) => /^\s*\d{1,2}:\d{2}(:\d{2})?[.,]\d{3}\s*-->/.test(r));
    if (!cue) continue;
    const tc = cue.trim().split("-->")[0].replace(/[.,]\d{3}$/, "");
    const texts = rows.filter((r) => r !== cue && !/^\d+$/.test(r.trim()));
    const joined = texts.join(" ").replace(/<[^>]+>/g, "").trim();
    // speaker patterns: "Name: text", "<v Name>text", "Name - text"
    const speaker = joined.match(/^([A-Za-z][\w .'-]{0,30})\s*[:\-–]\s*(.+)$/) ||
                    joined.match(/^<v\s+([^>]+)>\s*(.+)$/i);
    lines.push(speaker ? `${tc} ${speaker[1].trim()}: ${speaker[2].trim()}` : `${tc} Speaker: ${joined}`);
  }
  return lines;
}

function srtToLines(text: string): string[] {
  return vttToLines(text); // SRT uses the same cue structure
}

function jsonToLines(raw: string): string[] {
  const data = JSON.parse(raw) as unknown;
  const list = (Array.isArray(data) ? data : (data as { segments?: unknown[]; utterances?: unknown[]; items?: unknown[] }).segments ?? (data as { utterances?: unknown[] }).utterances ?? (data as { items?: unknown[] }).items) as Record<string, unknown>[];
  const get = (o: Record<string, unknown>, keys: string[]): unknown => {
    for (const k of keys) if (o[k] !== undefined) return o[k];
    return undefined;
  };
  const lines: string[] = [];
  for (const o of list) {
    const speaker = (get(o, ["speaker", "speaker_name", "name", "speakerName"]) as string) ?? "Speaker";
    const start = get(o, ["start_ms", "startMs", "start", "offset", "begin", "time"]);
    const text = (get(o, ["text", "transcript", "content", "message"]) as string)?.trim();
    if (!text) continue;
    // if no timestamp, estimate later (handled by plain-text fallback)
    const ms = typeof start === "number" ? toMs(start) : null;
    lines.push(ms != null ? `${timeToClock(ms)} ${speaker}: ${text}` : `${speaker}: ${text}`);
  }
  return lines;
}

/**
 * Plain text with no timestamps (e.g., Whisper .txt output, pasted paragraphs).
 * Format patterns handled:
 *   - "Name: text" (with speaker) → timestamp estimated
 *   - "Name - text" / "Name — text"
 *   - "Name (10:30 AM): text" (Google Meet style) → extract time
 *   - bare paragraphs → labeled "Speaker"
 * Timestamps are estimated evenly across a 4s/turn baseline.
 */
function plainTextToLines(text: string): string[] {
  const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  const lines: string[] = [];
  let t = 0;
  const STEP = 4000; // 4s per turn baseline

  for (const row of rows) {
    // "Name (10:30 AM): text" — Google Meet style
    const gmeet = row.match(/^([A-Za-z][\w .'-]{0,30})\s*\((\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\)\s*[:\-–]\s*(.+)$/i);
    if (gmeet) {
      const ms = parseClockToMs(gmeet[2]);
      if (ms != null) t = ms;
      lines.push(`${timeToClock(t)} ${gmeet[1].trim()}: ${gmeet[3].trim()}`);
      t += STEP;
      continue;
    }
    // "Name: text" or "Name — text"
    const speaker = row.match(/^([A-Za-z][\w .'-]{0,30})\s*[:\-–]\s*(.+)$/);
    if (speaker && speaker[2].length > 5) {
      lines.push(`${timeToClock(t)} ${speaker[1].trim()}: ${speaker[2].trim()}`);
      t += STEP;
      continue;
    }
    // bare paragraph
    lines.push(`${timeToClock(t)} Speaker: ${row}`);
    t += STEP;
  }
  return lines;
}

function parseClockToMs(clock: string): number | null {
  const cleaned = clock.replace(/\s*[AP]M/i, "").trim();
  const parts = cleaned.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) return ((parts[0] * 60 + parts[1]) * 60 + parts[2]) * 1000;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  return null;
}

/** Detect format and parse. */
export async function readTranscriptFile(file: File): Promise<ParsedTranscriptFile> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const text = await file.text();

  if (ext === "vtt") {
    const lines = vttToLines(text.replace(/^WEBVTT[^\n]*\n/i, ""));
    return { fileName: file.name, lines, warning: lines.length ? undefined : "No cues found in this file" };
  }
  if (ext === "srt") {
    const lines = srtToLines(text);
    return { fileName: file.name, lines, warning: lines.length ? undefined : "No cues found in this file" };
  }
  if (ext === "json") {
    try {
      const lines = jsonToLines(text);
      return { fileName: file.name, lines, warning: lines.length ? undefined : "No segments found in this JSON" };
    } catch {
      return { fileName: file.name, lines: [], warning: "Could not parse this JSON file" };
    }
  }
  // .txt or anything else — detect whether it has timestamps or is plain text
  const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const hasTimestamps = rows.some((r) => /^\d{1,2}:\d{2}(:\d{2})?/.test(r));
  const lines = hasTimestamps ? rows : plainTextToLines(text);
  return {
    fileName: file.name,
    lines,
    warning: lines.length ? (hasTimestamps ? undefined : "Timestamps were estimated — the file had no explicit times.") : "The file looks empty",
  };
}
