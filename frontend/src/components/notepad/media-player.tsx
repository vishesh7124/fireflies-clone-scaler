"use client";

import { useRef } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  RotateCwIcon,
} from "lucide-react";
import { usePlayerStore } from "@/store/player-store";
import { msToClock } from "@/lib/format";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** Draggable seek bar — click or drag anywhere to scrub. */
function SeekBar() {
  const barRef = useRef<HTMLDivElement>(null);
  const currentTimeMs = usePlayerStore((s) => s.currentTimeMs);
  const durationMs = usePlayerStore((s) => s.durationMs);
  const seekTo = usePlayerStore((s) => s.seekTo);

  const scrub = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    seekTo(pct * durationMs);
  };

  const pct = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0;

  return (
    <div
      ref={barRef}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(durationMs / 1000)}
      aria-valuenow={Math.round(currentTimeMs / 1000)}
      className="group/bar relative flex h-4 flex-1 cursor-pointer touch-none items-center"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        scrub(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) scrub(e.clientX);
      }}
    >
      <div className="h-1 w-full overflow-hidden rounded-full bg-elevated">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div
        className="absolute size-3 rounded-full bg-primary opacity-0 shadow transition-opacity group-hover/bar:opacity-100"
        style={{ left: `calc(${pct}% - 6px)` }}
      />
    </div>
  );
}

/**
 * Media player — replicates the real Notepad player: play/pause, ±5s skip,
 * scrubbing seek bar, current/total time, and the playback-speed menu
 * ("You can play the audio faster" — from the product demo).
 */
export function MediaPlayer() {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTimeMs = usePlayerStore((s) => s.currentTimeMs);
  const durationMs = usePlayerStore((s) => s.durationMs);
  const speed = usePlayerStore((s) => s.speed);
  const toggle = usePlayerStore((s) => s.toggle);
  const skip = usePlayerStore((s) => s.skip);
  const setSpeed = usePlayerStore((s) => s.setSpeed);

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Back 5 seconds"
        onClick={() => skip(-5000)}
      >
        <RotateCcwIcon className="size-4" />
      </Button>

      <button
        type="button"
        aria-label={isPlaying ? "Pause" : "Play"}
        onClick={toggle}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
      >
        {isPlaying ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4 translate-x-[1px]" />}
      </button>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Forward 5 seconds"
        onClick={() => skip(5000)}
      >
        <RotateCwIcon className="size-4" />
      </Button>

      <SeekBar />

      <span className="shrink-0 font-mono text-[11px] tabular-nums text-subtle">
        {msToClock(currentTimeMs)} / {msToClock(durationMs)}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-elevated/60 hover:text-foreground"
          >
            {speed}×
            <ChevronDownIcon className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-24">
          {SPEEDS.map((s) => (
            <DropdownMenuItem key={s} onClick={() => setSpeed(s)} className="justify-between text-xs">
              {s}×
              {s === speed && <CheckIcon className="size-3" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
