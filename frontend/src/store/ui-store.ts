import { create } from "zustand";

/**
 * Global UI state (zustand) — cross-component dialog triggers. The Capture
 * menu (topbar) opens the schedule dialog from anywhere; uploads live on
 * their own page (/uploads). The topbar search + Ctrl+K open the global
 * search dialog.
 */
interface UiState {
  scheduleOpen: boolean;
  searchOpen: boolean;
  openSchedule: () => void;
  closeSchedule: () => void;
  openSearch: () => void;
  closeSearch: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  scheduleOpen: false,
  searchOpen: false,
  openSchedule: () => set({ scheduleOpen: true }),
  closeSchedule: () => set({ scheduleOpen: false }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
}));
