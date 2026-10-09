"use client";

import {
  CalendarPlusIcon,
  ChevronDownIcon,
  MicIcon,
  UploadIcon,
  VideoIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUiStore } from "@/store/ui-store";

/**
 * "Capture" primary dropdown — items replicate the real app's menu.
 * Schedule / Upload open the real create dialogs; the bot-dependent items
 * stay "Coming Soon" placeholders (assignment: mocked sections).
 */
export function CaptureMenu() {
  const openSchedule = useUiStore((s) => s.openSchedule);
  const openUpload = useUiStore((s) => s.openUpload);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <VideoIcon />
          Capture
          <ChevronDownIcon className="size-3 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => toast.info("Add to live meeting — coming soon")}>
          <VideoIcon /> Add to live meeting
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openSchedule}>
          <CalendarPlusIcon /> Schedule new meeting
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openUpload}>
          <UploadIcon /> Upload audio or video
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast.info("Start recording — coming soon")}>
          <MicIcon /> Start recording
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
