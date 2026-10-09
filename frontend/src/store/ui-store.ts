import { create } from "zustand";

/**
 * Global UI state (zustand) — cross-component dialog triggers. The Capture
 * menu (topbar), Quick Start tiles (home) and empty states all open the
 * same create-meeting dialogs, mounted once in (app)/layout.
 */
interface UiState {
  uploadOpen: boolean;
  scheduleOpen: boolean;
  openUpload: () => void;
  closeUpload: () => void;
  openSchedule: () => void;
  closeSchedule: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  uploadOpen: false,
  scheduleOpen: false,
  openUpload: () => set({ uploadOpen: true }),
  closeUpload: () => set({ uploadOpen: false }),
  openSchedule: () => set({ scheduleOpen: true }),
  closeSchedule: () => set({ scheduleOpen: false }),
}));
