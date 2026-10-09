"use client";

import { useUiStore } from "@/store/ui-store";
import { ScheduleDialog } from "@/components/meetings/schedule-dialog";
import { SearchDialog } from "@/components/shared/search-dialog";

/**
 * Globally-mounted dialogs — opened from the Capture menu (topbar), Quick
 * Start tiles (home) and empty states via the ui store, and the topbar
 * search / ⌘K opens the global search dialog.
 */
export function GlobalDialogs() {
  const { scheduleOpen, searchOpen } = useUiStore();
  return (
    <>
      {scheduleOpen && <ScheduleDialog />}
      {searchOpen && <SearchDialog />}
    </>
  );
}
