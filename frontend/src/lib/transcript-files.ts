/**
 * Client-side transcript file → "mm:ss Name: text" lines converter, so the
 * Upload dialog can feed any of .txt / .vtt / .json into the mock API's
 * `transcript_text`. (The backend re-implements this server-side in Phase 6.)
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
    const texts = rows.filter((r) => r !== cue);
    const joined = texts.join(" ").replace(/<[^>]+>/g, "").trim();
    const speaker = joined.match(/^([A-Za-z][\w .'-]{0,30}):\s*(.+)$/);
    lines.push(speaker ? `${tc} ${speaker[1]}: ${speaker[2]}` : `${tc} Speaker: ${joined}`);
  }
  return lines;
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
    const start = get(o, ["start_ms", "startMs", "start", "offset", "begin"]);
    const text = (get(o, ["text", "transcript", "content"]) as string)?.trim();
    if (typeof start !== "number" || !text) continue;
    lines.push(`${timeToClock(toMs(start))} ${speaker}: ${text}`);
  }
  return lines;
}

export async function readTranscriptFile(file: File): Promise<ParsedTranscriptFile> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const text = await file.text();

  if (ext === "vtt" || ext === "srt") {
    const lines = vttToLines(text.replace(/^WEBVTT[^\n]*\n/i, ""));
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
  // .txt / anything else → pass through as raw lines
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return { fileName: file.name, lines, warning: lines.length ? undefined : "The file looks empty" };
}
