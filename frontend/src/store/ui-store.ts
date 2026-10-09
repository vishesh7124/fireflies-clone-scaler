import { create } from "zustand";

/**
 * Global UI state (zustand) — cross-component dialog triggers. The Capture
 * menu (topbar) opens the schedule dialog from anywhere; uploads live on
 * their own page (/uploads), so they route instead of opening a dialog.
 */
interface UiState {
  scheduleOpen: boolean;
  openSchedule: () => void;
  closeSchedule: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  scheduleOpen: false,
  openSchedule: () => set({ scheduleOpen: true }),
  closeSchedule: () => set({ scheduleOpen: false }),
}));
