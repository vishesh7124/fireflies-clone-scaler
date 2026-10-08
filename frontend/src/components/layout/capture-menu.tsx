"use client";

import {
  CalendarPlusIcon,
  ChevronDownIcon,
  MicIcon,
  PlusIcon,
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

/**
 * "Capture" primary dropdown — items replicate the real app's menu.
 * Schedule / Upload open real modals in Phase 2; the rest stay "Coming Soon"
 * placeholders (assignment: mocked sections).
 */
export function CaptureMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <PlusIcon className="size-4" />
          Capture
          <ChevronDownIcon className="size-3 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => toast.info("Add to live meeting — coming soon")}>
          <VideoIcon /> Add to live meeting
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast.info("Schedule meeting — lands in Phase 2")}>
          <CalendarPlusIcon /> Schedule new meeting
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast.info("Upload — lands in Phase 2")}>
          <UploadIcon /> Upload audio or video
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast.info("Start recording — coming soon")}>
          <MicIcon /> Start recording
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
