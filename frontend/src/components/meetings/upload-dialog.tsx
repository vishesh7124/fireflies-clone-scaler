"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUpIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import { readTranscriptFile } from "@/lib/transcript-files";
import type { CreateMeetingInput } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

/**
 * Upload / paste transcript → create meeting. Mirrors the real "Upload audio
 * or video" flow: the meeting starts as `processing` and flips to `ready`
 * with a generated summary ~2.4s later (mock BackgroundTask).
 */
export function UploadDialog() {
  const { uploadOpen, closeUpload } = useUiStore();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [participants, setParticipants] = useState("");
  const [pasted, setPasted] = useState("");
  const [fileLines, setFileLines] = useState<string[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const lines = fileLines ?? pasted
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const reset = () => {
    setTitle("");
    setDate("");
    setParticipants("");
    setPasted("");
    setFileLines(null);
    setFileName(null);
    setWarning(null);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const input: CreateMeetingInput = {
        title: title.trim(),
        meeting_date: date ? new Date(date).toISOString() : new Date().toISOString(),
        participants: participants
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
          .map((name) => ({ name })),
        transcript_text: lines.join("\n"),
      };
      return api.createMeeting(input);
    },
    onSuccess: ({ id, status }) => {
      closeUpload();
      reset();
      queryClient.invalidateQueries();
      if (status === "processing") {
        toast.info("Processing your meeting — Fred is generating the summary…");
        // the mock's BackgroundTask finishes ~2.4s in; refetch to flip the row
        setTimeout(() => queryClient.invalidateQueries(), 2800);
      } else {
        toast.success("Meeting created");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = await readTranscriptFile(file);
    setFileName(parsed.fileName);
    setWarning(parsed.warning ?? null);
    setFileLines(parsed.lines);
    if (!title && parsed.lines.length) {
      const firstSpeaker = parsed.lines[0].match(/^\d{1,2}:\d{2}(?::\d{2})?\s+([^:]+):/)?.[1];
      if (firstSpeaker) setParticipants((prev) => prev || "");
    }
  };

  const canSubmit = title.trim().length > 0 && lines.length > 0 && !createMutation.isPending;

  return (
    <Dialog open={uploadOpen} onOpenChange={(open) => !open && closeUpload()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload transcript</DialogTitle>
          <DialogDescription>
            Upload a transcript file (.txt / .vtt / .json) or paste it — Fred generates the
            summary and action items.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="upload-title">Title</Label>
              <Input
                id="upload-title"
                placeholder="e.g. Design Review — Notepad"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-date">Date &amp; time</Label>
              <Input
                id="upload-date"
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="upload-participants">
              Participants <span className="text-subtle">(comma-separated, optional)</span>
            </Label>
            <Input
              id="upload-participants"
              placeholder="e.g. Priya Sharma, Arjun Mehta"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
            />
          </div>

          <Tabs defaultValue="file">
            <TabsList className="w-full">
              <TabsTrigger value="file" className="flex-1">
                Upload file
              </TabsTrigger>
              <TabsTrigger value="paste" className="flex-1">
                Paste transcript
              </TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="space-y-2 pt-2">
              <label
                htmlFor="transcript-file"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-elevated/40 px-4 py-8 text-center transition-colors hover:border-ring/40"
              >
                <FileUpIcon className="size-6 text-muted-foreground" />
                <span className="text-sm text-foreground">
                  {fileName ?? "Choose a transcript file"}
                </span>
                <span className="text-xs text-subtle">
                  {fileLines
                    ? `${fileLines.length} lines detected`
                    : "Drag & drop or click — .txt, .vtt, or .json"}
                </span>
                <input
                  id="transcript-file"
                  type="file"
                  accept=".txt,.vtt,.srt,.json,text/plain"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </label>
              {warning && <p className="text-xs text-warning">{warning}</p>}
            </TabsContent>
            <TabsContent value="paste" className="space-y-2 pt-2">
              <Textarea
                placeholder={"00:04 Sarah: Alright, let's get started…\n00:21 Tom: Thanks for organizing this…"}
                rows={7}
                className="font-mono text-xs"
                value={pasted}
                onChange={(e) => {
                  setPasted(e.target.value);
                  setFileLines(null);
                }}
              />
              {pasted.trim() && (
                <p className="text-xs text-subtle">{lines.length} lines detected</p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={closeUpload}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={() => createMutation.mutate()}>
            {createMutation.isPending && <Loader2Icon className="size-3.5 animate-spin" />}
            Create meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
