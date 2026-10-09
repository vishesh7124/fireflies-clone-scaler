"use client";

import { useUiStore } from "@/store/ui-store";
import { UploadDialog } from "@/components/meetings/upload-dialog";
import { ScheduleDialog } from "@/components/meetings/schedule-dialog";

/**
 * Globally-mounted create dialogs — opened from the Capture menu (topbar),
 * Quick Start tiles (home) and list empty states via the ui store.
 */
export function GlobalDialogs() {
  const { uploadOpen, scheduleOpen } = useUiStore();
  return (
    <>
      {uploadOpen && <UploadDialog />}
      {scheduleOpen && <ScheduleDialog />}
    </>
  );
}
