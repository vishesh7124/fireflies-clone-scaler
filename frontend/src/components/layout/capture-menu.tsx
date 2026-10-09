"use client";

import { useRouter } from "next/navigation";
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
 * Schedule opens the real dialog; Upload routes to the Uploads page; the
 * bot-dependent items stay "Coming Soon" placeholders (mocked sections).
 */
export function CaptureMenu() {
  const router = useRouter();
  const openSchedule = useUiStore((s) => s.openSchedule);

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
        <DropdownMenuItem onClick={() => router.push("/uploads")}>
          <UploadIcon /> Upload audio or video
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast.info("Start recording — coming soon")}>
          <MicIcon /> Start recording
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
