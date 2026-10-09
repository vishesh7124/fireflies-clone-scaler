"use client";

import { useRef } from "react";
import { usePlayerStore } from "@/store/player-store";

/**
 * Interactive seek bar — click or drag anywhere to scrub. Clicking starts
 * playback if the player is currently paused (the standard "jump and play"
 * UX). Keyboard ←/→ skip ±5 s.
 *
 * Robustness: the previous version captured the pointer on `pointerdown` but
 * never released it on `pointerup`, which made the bar unresponsive after the
 * first click. Now we explicitly release the capture and track the drag via a
 * ref, so every click works.
 */
export function SeekBar({
  currentTimeMs,
  durationMs,
  className,
}: {
  currentTimeMs: number;
  durationMs: number;
  className?: string;
}) {
  const seekTo = usePlayerStore((s) => s.seekTo);
  const play = usePlayerStore((s) => s.play);
  const skip = usePlayerStore((s) => s.skip);
  const barRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const pct = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0;
  const seconds = Math.round(currentTimeMs / 1000);
  const totalSeconds = Math.round(durationMs / 1000);

  const seekFromClientX = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || durationMs <= 0) return;
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    seekTo(fraction * durationMs);
  };

  const startPlaybackIfPaused = () => {
    if (!usePlayerStore.getState().isPlaying) play();
  };

  return (
    <div
      ref={barRef}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={totalSeconds}
      aria-valuenow={seconds}
      tabIndex={0}
      className={`group/sb relative z-10 flex h-4 cursor-pointer select-none items-center ${className ?? ""}`}
      onPointerDown={(e) => {
        draggingRef.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* setPointerCapture can throw on some touch configs — safe to ignore */
        }
        seekFromClientX(e.clientX);
        startPlaybackIfPaused();
      }}
      onPointerMove={(e) => {
        if (draggingRef.current) seekFromClientX(e.clientX);
      }}
      onPointerUp={(e) => {
        draggingRef.current = false;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
      onClick={(e) => {
        seekFromClientX(e.clientX);
        startPlaybackIfPaused();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") skip(-5000);
        if (e.key === "ArrowRight") skip(5000);
      }}
    >
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-75"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className="pointer-events-none absolute size-2.5 rounded-full bg-primary opacity-0 shadow transition-opacity group-hover/sb:opacity-100"
        style={{ left: `calc(${pct}% - 5px)` }}
      />
    </div>
  );
}
