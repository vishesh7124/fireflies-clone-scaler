"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  FileAudioIcon,
  FileTextIcon,
  FileVideoIcon,
  InboxIcon,
  Loader2Icon,
  PencilIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { readTranscriptFile } from "@/lib/transcript-files";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MeetingRow } from "@/components/meetings/meeting-row";
import { PasteDialog } from "@/components/uploads/paste-dialog";

const LANGUAGES = ["English (Global)", "English (US)", "Spanish", "Hindi", "French", "German", "Japanese"];

const TRANSCRIPT_EXTS = new Set(["txt", "vtt", "srt", "json"]);
const MEDIA_ACCEPT = "audio/*,video/*,.txt,.vtt,.srt,.json";

interface QueuedFile {
  name: string;
  kind: "media" | "transcript";
  lines: string[];
  addedAt: string;
}

function fileIcon(name: string, className: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  const Icon = ext && TRANSCRIPT_EXTS.has(ext) ? FileTextIcon : /\.(mp4|webm|mkv)$/i.test(name) ? FileVideoIcon : FileAudioIcon;
  return <Icon className={className} />;
}

/**
 * Uploads — replicates the real app's Uploads page: the "Uploads are moving"
 * banner, a large drop zone (media formats + Browse Files), the right
 * "Uploading N Files" panel (language, queued file rows, Upload), and the
 * recent-uploads list / empty state.
 *
 * Real speech-to-text is out of scope (assignment): media files queue like
 * the original but explain the placeholder on Upload; transcript files
 * (.txt/.vtt/.json) run the full processing flow.
 */
export default function UploadsPage() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [pasteOpen, setPasteOpen] = useState(false);

  const { data: uploads } = useQuery({
    queryKey: qk.meetings({ source: "paste", sort: "recent" }),
    queryFn: () => api.listMeetings({ source: "paste", sort: "recent" }),
  });

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const next: QueuedFile[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (TRANSCRIPT_EXTS.has(ext)) {
        const parsed = await readTranscriptFile(file);
        if (parsed.lines.length === 0) {
          toast.error(`Could not read "${file.name}" — ${parsed.warning ?? "no transcript lines found"}`);
          continue;
        }
        next.push({ name: file.name, kind: "transcript", lines: parsed.lines, addedAt: new Date().toISOString() });
      } else {
        next.push({ name: file.name, kind: "media", lines: [], addedAt: new Date().toISOString() });
      }
    }
    if (next.length) setQueue((q) => [...q, ...next]);
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const transcripts = queue.filter((f) => f.kind === "transcript");
      const media = queue.filter((f) => f.kind === "media");
      if (transcripts.length === 0 && media.length === 0) return;
      for (const file of transcripts) {
        await api.createMeeting({
          title: file.name.replace(/\.[^.]+$/, ""),
          meeting_date: file.addedAt,
          participants: [],
          transcript_text: file.lines.join("\n"),
        });
      }
      if (media.length > 0) {
        toast.info(
          "Real transcription is coming soon — upload a .txt, .vtt or .json transcript file to see the full flow.",
        );
      }
    },
    onSuccess: () => {
      const count = queue.filter((f) => f.kind === "transcript").length;
      if (count > 0) {
        toast.info(`Processing ${count} ${count === 1 ? "meeting" : "meetings"} — Fred is generating summaries…`);
        queryClient.invalidateQueries();
        setTimeout(() => queryClient.invalidateQueries(), 2800);
      }
      setQueue([]);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex h-full min-h-0">
      {/* main column */}
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {/* "Uploads are moving" banner (dismissible, like the original) */}
        {bannerVisible && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-[#f0d9a8]">
            <span className="flex-1">
              Uploads are moving — you&rsquo;ll find them on the Meetings page soon.
            </span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setBannerVisible(false)}
              className="text-subtle transition-colors hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        )}

        {/* drop zone (click or drag-and-drop → file picker) */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFiles(e.dataTransfer.files);
          }}
          className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-elevated/30 px-6 py-14 text-center"
        >
          <UploadIcon className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <h1 className="font-display text-lg font-semibold text-foreground">
              Upload a file to generate a transcript
            </h1>
            <p className="mx-auto max-w-md text-xs leading-relaxed text-subtle">
              Browse or drag and drop MP3, M4A, WAV, MP4 or WEBM files. (Max video size:
              100 MB, Max audio size: 500 MB)
            </p>
            <p className="mx-auto max-w-md text-xs leading-relaxed text-subtle">
              Transcript files (.txt, .vtt, .json) are processed instantly.
            </p>
          </div>
          <Button onClick={() => inputRef.current?.click()}>
            <FileTextIcon className="size-3.5" />
            Browse Files
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={MEDIA_ACCEPT}
            className="hidden"
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* paste path (assignment: create by pasting a transcript) */}
        <button
          type="button"
          onClick={() => setPasteOpen(true)}
          className="flex items-center gap-1 text-sm text-primary-soft hover:underline"
        >
          Paste a transcript instead <ArrowRightIcon className="size-3.5" />
        </button>

        {/* recent uploads */}
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">Recent uploads</h2>
          {uploads && uploads.items.length > 0 ? (
            <div className="space-y-1">
              {uploads.items.map((meeting) => (
                <MeetingRow key={meeting.id} meeting={meeting} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <InboxIcon className="size-6 text-subtle" />
              <p className="text-sm text-muted-foreground">You have no recent uploads!</p>
            </div>
          )}
        </section>
      </div>

      {/* right — "Uploading N Files" panel (like the original) */}
      {queue.length > 0 && (
        <aside className="flex w-80 shrink-0 flex-col border-l border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-medium text-foreground">
              Uploading {queue.length} {queue.length === 1 ? "File" : "Files"}
            </span>
            <button
              type="button"
              aria-label="Close panel"
              onClick={() => setQueue([])}
              className="text-subtle transition-colors hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
          </div>

          <div className="space-y-2 p-3">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang} value={lang} className="text-xs">
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {queue.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-elevated text-muted-foreground">
                  {fileIcon(file.name, "size-4")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">{file.name}</span>
                  <span className="block text-[11px] text-subtle">
                    {formatDate(file.addedAt, "d MMM, yyyy h:mm a")}
                    {file.kind === "transcript" && ` · ${file.lines.length} lines`}
                  </span>
                  <button
                    type="button"
                    onClick={() => toast.info("File options — coming soon")}
                    className="mt-0.5 flex items-center gap-1 text-[11px] text-primary-soft hover:underline"
                  >
                    <PencilIcon className="size-2.5" /> Edit
                  </button>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setQueue((q) => q.filter((_, idx) => idx !== i))}
                  className="text-subtle transition-colors hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-auto p-3">
            <Button
              className="w-full"
              disabled={uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
            >
              {uploadMutation.isPending ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <UploadIcon className="size-3.5" />
              )}
              Upload
            </Button>
          </div>
        </aside>
      )}

      <PasteDialog open={pasteOpen} onOpenChange={setPasteOpen} />
    </div>
  );
}
