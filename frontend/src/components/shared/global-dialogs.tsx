"use client";

import { useUiStore } from "@/store/ui-store";
import { ScheduleDialog } from "@/components/meetings/schedule-dialog";

/**
 * Globally-mounted create dialogs — opened from the Capture menu (topbar)
 * via the ui store. Uploads live on their own page (/uploads).
 */
export function GlobalDialogs() {
  const { scheduleOpen } = useUiStore();
  return <>{scheduleOpen && <ScheduleDialog />}</>;
}
