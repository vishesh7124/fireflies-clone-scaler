"use client";

import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/store/player-store";

/**
 * PlayerEngine — headless playback driver, mounted once per Notepad.
 *
 * - Virtual clock (mock phase): a rAF loop advances currentTimeMs by delta ×
 *   speed; the UI (seek bar, transcript sync) behaves exactly like real audio.
 * - Audio path (Phase 7): when a mediaUrl exists, a hidden <audio> element
 *   becomes the clock instead — timeupdate feeds the store and store changes
 *   (play/pause/speed/seek) drive the element.
 */
export function PlayerEngine({ durationMs, mediaUrl }: { durationMs: number; mediaUrl: string | null }) {
  const setDuration = usePlayerStore((s) => s.setDuration);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setDuration(durationMs);
  }, [durationMs, setDuration]);

  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const speed = usePlayerStore((s) => s.speed);
  const seekVersion = usePlayerStore((s) => s.seekVersion);
  const currentTimeMs = usePlayerStore((s) => s.currentTimeMs);
  const playUntilMs = usePlayerStore((s) => s.playUntilMs);

  // ---- virtual clock (no media) ----
  useEffect(() => {
    if (mediaUrl || !isPlaying) return;
    let raf = 0;
    let last = performance.now();
    let lastMs = usePlayerStore.getState().currentTimeMs;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const s = usePlayerStore.getState();
      let next = lastMs + dt * s.speed;
      if (s.playUntilMs != null && next >= s.playUntilMs) {
        next = s.playUntilMs;
        s.pause();
      }
      if (next >= s.durationMs) {
        next = s.durationMs;
        s.pause();
      }
      lastMs = next;
      s._tick(next);
      if (usePlayerStore.getState().isPlaying) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, mediaUrl, speed]);

  // ---- audio path (exercised from Phase 7, when mediaUrl is set) ----
  useEffect(() => {
    const audio = audioRef.current;
    if (!mediaUrl || !audio) return;
    const onTime = () => {
      const s = usePlayerStore.getState();
      const next = audio.currentTime * 1000;
      if (s.playUntilMs != null && next >= s.playUntilMs) {
        s.pause();
        return;
      }
      if (next >= s.durationMs) s.pause();
      s._tick(next);
    };
    const onPlay = () => usePlayerStore.getState().play();
    const onPause = () => usePlayerStore.getState().pause();
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [mediaUrl]);

  // sync audio element with store state
  useEffect(() => {
    const audio = audioRef.current;
    if (!mediaUrl || !audio) return;
    if (isPlaying) void audio.play().catch(() => undefined);
    else audio.pause();
    audio.playbackRate = speed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, speed, mediaUrl]);

  // seek requests drive the element
  useEffect(() => {
    const audio = audioRef.current;
    if (!mediaUrl || !audio) return;
    audio.currentTime = currentTimeMs / 1000;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekVersion, mediaUrl]);

  return mediaUrl ? (
    // eslint-disable-next-line jsx-a11y/media-has-caption -- placeholder audio, captions ARE the transcript panel
    <audio ref={audioRef} src={mediaUrl} preload="metadata" className="hidden" />
  ) : null;
}
