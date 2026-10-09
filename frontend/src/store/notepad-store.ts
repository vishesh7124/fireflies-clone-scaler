import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NotepadPanel =
  | "smart-search"
  | "index"
  | "soundbites"
  | "comments"
  | "bookmarks"
  | "askfred";

/**
 * Notepad UI state — which icon-rail panel is open, the active smart-search
 * filter, and the split-pane geometry (persisted so the layout survives
 * refreshes, like the real product).
 */
interface NotepadState {
  activePanel: NotepadPanel | null;
  smartFilter: string | null; // "questions" | "tasks" | "dates" | "metrics" | "pricing" | "sentiment" | "fillers"
  commentAnchorSegmentId: number | null;
  leftPct: number; // summary pane width 20–80
  collapsed: "none" | "summary" | "transcript";
  setActivePanel: (panel: NotepadPanel | null) => void;
  setSmartFilter: (filter: string | null) => void;
  setCommentAnchor: (segmentId: number | null) => void;
  setLeftPct: (pct: number) => void;
  setCollapsed: (c: NotepadState["collapsed"]) => void;
}

export const useNotepadStore = create<NotepadState>()(
  persist(
    (set) => ({
      activePanel: null,
      smartFilter: null,
      commentAnchorSegmentId: null,
      leftPct: 42,
      collapsed: "none",
      setActivePanel: (activePanel) => set({ activePanel }),
      setSmartFilter: (smartFilter) => set({ smartFilter }),
      setCommentAnchor: (commentAnchorSegmentId) => set({ commentAnchorSegmentId }),
      setLeftPct: (leftPct) => set({ leftPct: Math.min(80, Math.max(20, leftPct)) }),
      setCollapsed: (collapsed) => set({ collapsed }),
    }),
    {
      name: "fireflies-notepad",
      partialize: (s) => ({ leftPct: s.leftPct, collapsed: s.collapsed }) as NotepadState,
    },
  ),
);
