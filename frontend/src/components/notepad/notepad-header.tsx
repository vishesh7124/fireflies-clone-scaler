"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  CheckIcon,
  EllipsisIcon,
  FileDownIcon,
  InfoIcon,
  LinkIcon,
  Loader2Icon,
  PencilIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { downloadFile } from "@/lib/download";
import { qk } from "@/lib/query-keys";
import { formatDate, formatDuration } from "@/lib/format";
import type { ExportFormat, Meeting } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ParticipantStack } from "@/components/shared/participant-stack";

const EXPORTS: { format: ExportFormat; label: string }[] = [
  { format: "txt", label: "Transcript (.txt)" },
  { format: "md", label: "Summary + transcript (.md)" },
  { format: "srt", label: "Subtitles (.srt)" },
  { format: "vtt", label: "Subtitles (.vtt)" },
  { format: "json", label: "Full data (.json)" },
];

/**
 * NotepadHeader — back to the Notebook beside the title (the real 2024
 * Notepad change), inline rename, participants + date meta, and the 3-dot
 * menu: regenerate notes, meeting info, downloads, copy link, delete.
 */
export function NotepadHeader({ meeting }: { meeting: Meeting }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(meeting.title);
  const [infoOpen, setInfoOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const renameMutation = useMutation({
    mutationFn: () => api.updateMeeting(meeting.id, { title: title.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setRenaming(false);
      toast.success("Meeting renamed");
    },
    onError: (e) => toast.error(e.message),
  });

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

  return (
    <div className="shrink-0 space-y-1 border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.push("/meetings")}
          aria-label="Back to Notebook"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-elevated/60 hover:text-foreground"
          title="Back to Notebook"
        >
          <ArrowLeftIcon className="size-4" />
        </button>

        {renaming ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim()) renameMutation.mutate();
                if (e.key === "Escape") {
                  setTitle(meeting.title);
                  setRenaming(false);
                }
              }}
              className="h-8 text-sm"
            />
            <Button
              size="icon-sm"
              aria-label="Save title"
              disabled={!title.trim() || renameMutation.isPending}
              onClick={() => renameMutation.mutate()}
            >
              {renameMutation.isPending ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <CheckIcon className="size-3.5" />
              )}
            </Button>
          </span>
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left font-display text-base font-semibold text-foreground hover:text-primary-soft"
            onDoubleClick={() => {
              setTitle(meeting.title);
              setRenaming(true);
            }}
            title={meeting.title}
          >
            {meeting.title}
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Meeting actions" className="text-muted-foreground">
              <EllipsisIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              onClick={() => {
                setTitle(meeting.title);
                setRenaming(true);
              }}
            >
              <PencilIcon /> Rename
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
            <DropdownMenuItem onClick={() => setInfoOpen(true)}>
              <InfoIcon /> Meeting info
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
            <DropdownMenuItem
              onClick={() => {
                void navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied to clipboard");
              }}
            >
              <LinkIcon /> Copy link
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2Icon /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-9 text-xs text-subtle">
        <span>{formatDate(meeting.meeting_date, "MMM d, yyyy · h:mm a")}</span>
        {meeting.duration_seconds != null && (
          <>
            <span aria-hidden>·</span>
            <span>{formatDuration(meeting.duration_seconds)}</span>
          </>
        )}
        <ParticipantStack participants={meeting.participants} max={6} />
      </div>

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
              <dd className="text-foreground">{formatDate(meeting.meeting_date, "EEE, MMM d yyyy · h:mm a")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Duration</dt>
              <dd className="text-foreground">{formatDuration(meeting.duration_seconds)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Language</dt>
              <dd className="text-foreground">{meeting.language}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Participants</dt>
              <dd className="text-right text-foreground">
                {meeting.participants.map((p) => p.name).join(", ")}
              </dd>
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
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              {deleteMutation.isPending && <Loader2Icon className="size-3.5 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
