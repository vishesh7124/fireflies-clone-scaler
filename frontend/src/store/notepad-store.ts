import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NotepadPanel = "smart-search" | "soundbites" | "bookmarks" | "comments";

/**
 * Notepad UI state — which icon-rail panel is open (Smart Search by default,
 * like the real product), the active smart-search filter, the shared
 * find-in-transcript query, and view toggles. Geometry persists.
 */
interface NotepadState {
  activePanel: NotepadPanel | null;
  smartFilter: string | null; // "questions" | "tasks" | "dates" | "metrics" | "sentiment-positive" | "sentiment-negative"
  findQuery: string; // shared by the Smart Search input + Find or Replace bar
  videoVisible: boolean;
  transcriptHidden: boolean;
  sidebarOpen: boolean;
  commentAnchorSegmentId: number | null;
  setActivePanel: (panel: NotepadPanel | null) => void;
  setSmartFilter: (filter: string | null) => void;
  setFindQuery: (q: string) => void;
  setVideoVisible: (v: boolean) => void;
  setTranscriptHidden: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;
  setCommentAnchor: (segmentId: number | null) => void;
}

export const useNotepadStore = create<NotepadState>()(
  persist(
    (set) => ({
      activePanel: "smart-search",
      smartFilter: null,
      findQuery: "",
      videoVisible: true,
      transcriptHidden: false,
      sidebarOpen: false,
      commentAnchorSegmentId: null,
      setActivePanel: (activePanel) => set({ activePanel }),
      setSmartFilter: (smartFilter) => set({ smartFilter }),
      setFindQuery: (findQuery) => set({ findQuery }),
      setVideoVisible: (videoVisible) => set({ videoVisible }),
      setTranscriptHidden: (transcriptHidden) => set({ transcriptHidden }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setCommentAnchor: (commentAnchorSegmentId) => set({ commentAnchorSegmentId }),
    }),
    {
      name: "fireflies-notepad",
      partialize: (s) =>
        ({ videoVisible: s.videoVisible, transcriptHidden: s.transcriptHidden }) as NotepadState,
    },
  ),
);
