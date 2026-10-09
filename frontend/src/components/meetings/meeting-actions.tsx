"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EllipsisIcon, FileDownIcon, Loader2Icon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { api } from "@/lib/api";
import { downloadFile } from "@/lib/download";
import type { ExportFormat, MeetingListItem } from "@/lib/types";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EXPORT_FORMATS: { format: ExportFormat; label: string }[] = [
  { format: "txt", label: "Transcript (.txt)" },
  { format: "md", label: "Summary + transcript (.md)" },
  { format: "srt", label: "Subtitles (.srt)" },
  { format: "vtt", label: "Subtitles (.vtt)" },
  { format: "json", label: "Full data (.json)" },
];

/** 3-dot menu on meeting rows: rename, download, delete — like the real app. */
export function MeetingActions({ meeting }: { meeting: MeetingListItem }) {
  const queryClient = useQueryClient();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState(meeting.title);

  const renameMutation = useMutation({
    mutationFn: () => api.updateMeeting(meeting.id, { title: title.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Meeting renamed");
      setRenameOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteMeeting(meeting.id),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Meeting deleted");
      setDeleteOpen(false);
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Meeting actions"
            className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 data-open:opacity-100"
          >
            <EllipsisIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onClick={() => {
              setTitle(meeting.title);
              setRenameOpen(true);
            }}
          >
            <PencilIcon /> Rename
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FileDownIcon /> Download
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              {EXPORT_FORMATS.map(({ format, label }) => (
                <DropdownMenuItem key={format} onClick={() => exportMutation.mutate(format)}>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename meeting</DialogTitle>
            <DialogDescription>Update the meeting title.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-title">Title</Label>
            <Input
              id="rename-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && title.trim() && renameMutation.mutate()}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!title.trim() || renameMutation.isPending} onClick={() => renameMutation.mutate()}>
              {renameMutation.isPending && <Loader2Icon className="size-3.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* delete confirm dialog */}
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
    </>
  );
}

/** Convenience: format an ISO date the way the real app's rows do. */
export { formatRowDate } from "@/lib/format";
