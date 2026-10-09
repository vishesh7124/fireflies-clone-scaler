import { create } from "zustand";

/**
 * Player state (zustand) — the single source of truth for playback so any
 * component (transcript lines, summary topics, citations, soundbites) can
 * seek without prop drilling. High-frequency writes (currentTimeMs at rAF
 * rate) come from PlayerEngine only; subscribers use narrow selectors so
 * only the active lines + player UI re-render.
 */
interface PlayerStore {
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  speed: number; // 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2
  activeSegmentId: number | null;
  playUntilMs: number | null; // soundbite clip auto-stop
  seekVersion: number; // bumped on seekTo — the <audio> path syncs on it
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seekTo: (ms: number) => void;
  skip: (deltaMs: number) => void;
  setSpeed: (speed: number) => void;
  setDuration: (ms: number) => void;
  setActiveSegmentId: (id: number | null) => void;
  playClip: (startMs: number, endMs: number) => void;
  _tick: (ms: number) => void;
  reset: () => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentTimeMs: 0,
  durationMs: 0,
  isPlaying: false,
  speed: 1,
  activeSegmentId: null,
  playUntilMs: null,
  seekVersion: 0,
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),
  seekTo: (ms) =>
    set({
      currentTimeMs: clamp(ms, 0, get().durationMs || ms),
      playUntilMs: null, // manual seek takes control back from a clip
      seekVersion: get().seekVersion + 1,
    }),
  skip: (deltaMs) => get().seekTo(get().currentTimeMs + deltaMs),
  setSpeed: (speed) => set({ speed }),
  setDuration: (ms) => set({ durationMs: ms }),
  setActiveSegmentId: (id) => set({ activeSegmentId: id }),
  playClip: (startMs, endMs) =>
    set({
      currentTimeMs: clamp(startMs, 0, get().durationMs || startMs),
      playUntilMs: endMs,
      isPlaying: true,
      seekVersion: get().seekVersion + 1,
    }),
  _tick: (ms) => set({ currentTimeMs: ms }),
  reset: () =>
    set({
      currentTimeMs: 0,
      durationMs: 0,
      isPlaying: false,
      speed: 1,
      activeSegmentId: null,
      playUntilMs: null,
      seekVersion: 0,
    }),
}));
