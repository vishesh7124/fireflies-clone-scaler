"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BellIcon,
  CheckIcon,
  EllipsisIcon,
  EyeIcon,
  FileDownIcon,
  GlobeIcon,
  InfoIcon,
  LinkIcon,
  Loader2Icon,
  MenuIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { downloadFile } from "@/lib/download";
import { qk } from "@/lib/query-keys";
import type { ExportFormat, Meeting } from "@/lib/types";
import { useNotepadStore } from "@/store/notepad-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const EXPORTS: { format: ExportFormat; label: string }[] = [
  { format: "txt", label: "Transcript (.txt)" },
  { format: "md", label: "Summary + transcript (.md)" },
  { format: "srt", label: "Subtitles (.srt)" },
  { format: "vtt", label: "Subtitles (.vtt)" },
  { format: "json", label: "Full data (.json)" },
];

/**
 * NotepadHeader — the real Notepad's top bar: hamburger + channel/title
 * breadcrumb, the ⋯ meeting menu, and the right action cluster (Upgrade,
 * integrations, views, Share, +, bell, avatar). The global app chrome is
 * hidden on this page — the Notepad owns the full screen.
 */
export function NotepadHeader({ meeting }: { meeting: Meeting }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sidebarOpen = useNotepadStore((s) => s.sidebarOpen);
  const setSidebarOpen = useNotepadStore((s) => s.setSidebarOpen);
  const [infoOpen, setInfoOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const regenerateMutation = useMutation({
    mutationFn: () => api.regenerateSummary(meeting.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.summary(meeting.id), updated);
      toast.success("Summary reprocessed");
    },
    onError: (e) => toast.error(e.message),
  });

  const exportMutation = useMutation({
    mutationFn: (format: ExportFormat) => api.exportMeeting(meeting.id, format),
    onSuccess: (result) => {
      downloadFile(result.filename, result.mime, result.content);
      toast.success(`Exported ${result.filename}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteMeeting(meeting.id),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Meeting deleted");
      router.push("/meetings");
    },
    onError: (e) => toast.error(e.message),
  });

  const copyLink = () => {
    void navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
      {/* hamburger + breadcrumb */}
      <button
        type="button"
        aria-label="Toggle sidebar"
        title="Toggle sidebar"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-elevated/60 hover:text-foreground"
      >
        <MenuIcon className="size-4" />
      </button>
      <nav className="flex min-w-0 items-center gap-1.5 text-[13px]">
        <button
          type="button"
          onClick={() => router.push("/meetings")}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          # My Meetings
        </button>
        <span className="shrink-0 text-subtle">/</span>
        <span className="truncate font-medium text-foreground" title={meeting.title}>
          {meeting.title}
        </span>
      </nav>

      {/* ⋯ meeting menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Meeting actions"
            className="relative ml-1 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-elevated/60 hover:text-foreground"
          >
            <EllipsisIcon className="size-4" />
            <span className="absolute right-1 top-1 size-1.5 rounded-full bg-success" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem onClick={() => setInfoOpen(true)}>
            <InfoIcon /> Meeting info
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={regenerateMutation.isPending}
            onClick={() => regenerateMutation.mutate()}
          >
            {regenerateMutation.isPending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <RefreshCwIcon />
            )}
            Regenerate notes
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FileDownIcon /> Download
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              {EXPORTS.map(({ format, label }) => (
                <DropdownMenuItem key={format} onClick={() => exportMutation.mutate(format)}>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={copyLink}>
            <LinkIcon /> Copy link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="flex-1" />

      {/* right action cluster (replicated from the original) */}
      <Button
        variant="ghost"
        size="sm"
        className="hidden bg-[#11321f] text-[13px] text-success hover:bg-[#17452c] hover:text-success md:flex"
        onClick={() => toast.info("Upgrade — coming soon")}
      >
        Upgrade
      </Button>

      <button
        type="button"
        aria-label="Send to Slack"
        title="Send to Slack"
        onClick={() => toast.info("Slack — coming soon")}
        className="hidden size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-elevated/60 hover:text-foreground md:flex"
      >
        <span className="grid grid-cols-2 gap-[2px]">
          <span className="size-[4.5px] rounded-[1px] bg-[#e01e5a]" />
          <span className="size-[4.5px] rounded-[1px] bg-[#36c5f0]" />
          <span className="size-[4.5px] rounded-[1px] bg-[#2eb67d]" />
          <span className="size-[4.5px] rounded-[1px] bg-[#ecb22e]" />
        </span>
      </button>

      <button
        type="button"
        aria-label="Views"
        onClick={() => toast.info("Views — coming soon")}
        className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-elevated/60 hover:text-foreground lg:flex"
      >
        <EyeIcon className="size-3.5" />1 View
      </button>

      <Button size="sm" onClick={() => toast.info("Sharing — team features coming soon")}>
        <GlobeIcon className="size-3.5" />
        Share
      </Button>
      <Button variant="outline" size="icon-sm" aria-label="Copy link" onClick={copyLink}>
        <LinkIcon className="size-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Add to channel"
        onClick={() => toast.info("Channels — coming soon")}
      >
        <PlusIcon className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Notifications"
        className="relative"
        onClick={() => toast.info("No new notifications")}
      >
        <BellIcon className="size-4" />
        <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-destructive" />
      </Button>
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-elevated text-[11px] font-bold text-foreground"
        title="Vishesh Gupta"
      >
        V
      </span>

      {/* meeting info dialog */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Meeting info</DialogTitle>
          </DialogHeader>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Title</dt>
              <dd className="text-right text-foreground">{meeting.title}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Date</dt>
              <dd className="text-foreground">{meeting.meeting_date.slice(0, 10)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Participants</dt>
              <dd className="text-right text-foreground">
                {meeting.participants.map((p) => p.name).join(", ")}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Language</dt>
              <dd className="text-foreground">{meeting.language}</dd>
            </div>
          </dl>
        </DialogContent>
      </Dialog>

      {/* delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete meeting?</DialogTitle>
            <DialogDescription>
              “{meeting.title}” and its transcript, summary, and action items will be permanently
              removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending && <Loader2Icon className="size-3.5 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
