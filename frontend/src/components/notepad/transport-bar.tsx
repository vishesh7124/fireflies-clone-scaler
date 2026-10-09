"use client";

import { useMutation } from "@tanstack/react-query";
import {
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  PencilIcon,
  PlayIcon,
  PauseIcon,
  RotateCcwIcon,
  RotateCwIcon,
  StarIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { downloadFile } from "@/lib/download";
import { msToClock } from "@/lib/format";
import type { ExportFormat, Meeting } from "@/lib/types";
import { usePlayerStore } from "@/store/player-store";
import { useNotepadStore } from "@/store/notepad-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SeekBar } from "./seek-bar";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const EXPORTS: { format: ExportFormat; label: string }[] = [
  { format: "txt", label: "Transcript (.txt)" },
  { format: "md", label: "Summary + transcript (.md)" },
  { format: "srt", label: "Subtitles (.srt)" },
  { format: "vtt", label: "Subtitles (.vtt)" },
  { format: "json", label: "Full data (.json)" },
];

/**
 * Transport bar — the real Notepad's sticky bottom player (notepad1-4.png):
 * timecode + speed on the left, the centered skip / play / skip cluster with
 * download, and rating/edit actions on the right.
 */
export function TransportBar({ meeting }: { meeting: Meeting }) {
  const currentTimeMs = usePlayerStore((s) => s.currentTimeMs);
  const durationMs = usePlayerStore((s) => s.durationMs);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const speed = usePlayerStore((s) => s.speed);
  const toggle = usePlayerStore((s) => s.toggle);
  const skip = usePlayerStore((s) => s.skip);
  const setSpeed = usePlayerStore((s) => s.setSpeed);
  const smartFilter = useNotepadStore((s) => s.smartFilter);
  const setSmartFilter = useNotepadStore((s) => s.setSmartFilter);

  const exportMutation = useMutation({
    mutationFn: (format: ExportFormat) => api.exportMeeting(meeting.id, format),
    onSuccess: (result) => {
      downloadFile(result.filename, result.mime, result.content);
      toast.success(`Exported ${result.filename}`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-t border-border px-4">
      {/* timecode + seek bar + "now playing" indicator */}
      <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] tabular-nums text-subtle">
        {isPlaying && (
          <span
            className="relative flex size-2"
            aria-label="Playing"
            title="Playing"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
            <span className="relative size-2 rounded-full bg-success" />
          </span>
        )}
        {msToClock(currentTimeMs)} / {msToClock(durationMs)}
      </span>
      <div className="w-28 shrink-0 sm:w-48 lg:w-72">
        <SeekBar currentTimeMs={currentTimeMs} durationMs={durationMs} />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-elevated/60 hover:text-foreground"
          >
            {speed}×
            <ChevronDownIcon className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-24">
          {SPEEDS.map((s) => (
            <DropdownMenuItem key={s} onClick={() => setSpeed(s)} className="justify-between text-xs">
              {s}×
              {s === speed && <CheckIcon className="size-3" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* centered transport cluster */}
      <div className="mx-auto flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="Back 5 seconds" onClick={() => skip(-5000)}>
          <RotateCcwIcon className="size-4" />
        </Button>
        <button
          type="button"
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={toggle}
          className="flex h-9 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-[1.02]"
        >
          {isPlaying ? (
            <PauseIcon className="size-4" />
          ) : (
            <PlayIcon className="size-4 translate-x-[1px]" />
          )}
        </button>
        <Button variant="ghost" size="icon-sm" aria-label="Forward 5 seconds" onClick={() => skip(5000)}>
          <RotateCwIcon className="size-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Download"
              className="ml-1 text-muted-foreground"
              disabled={exportMutation.isPending}
            >
              <DownloadIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-52">
            {EXPORTS.map(({ format, label }) => (
              <DropdownMenuItem key={format} onClick={() => exportMutation.mutate(format)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* right actions */}
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        {smartFilter && (
          <button
            type="button"
            onClick={() => setSmartFilter(null)}
            className="mr-2 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary-soft"
          >
            {smartFilter.replace("-", " ")} ✕
          </button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Favorite"
          title="Favorite"
          className="text-muted-foreground"
          onClick={() => toast.success("Added to favorites")}
        >
          <StarIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Thumbs up"
          title="Thumbs up"
          className="text-muted-foreground"
          onClick={() => toast.success("Thanks for the feedback!")}
        >
          <ThumbsUpIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Thumbs down"
          title="Thumbs down"
          className="text-muted-foreground"
          onClick={() => toast.info("Sorry about that — feedback noted")}
        >
          <ThumbsDownIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Report issue"
          title="Report issue"
          className="text-muted-foreground"
          onClick={() => toast.info("Issue reporting — coming soon")}
        >
          <PencilIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
