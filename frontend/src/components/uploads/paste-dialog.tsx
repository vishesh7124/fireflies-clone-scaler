"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
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
import { Textarea } from "@/components/ui/textarea";

/**
 * Paste transcript — the assignment's "create by pasting a transcript" path,
 * kept as a compact dialog from the Uploads page.
 */
export function PasteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [participants, setParticipants] = useState("");
  const [pasted, setPasted] = useState("");

  const lines = pasted
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const reset = () => {
    setTitle("");
    setParticipants("");
    setPasted("");
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const input: CreateMeetingInput = {
        title: title.trim(),
        meeting_date: new Date().toISOString(),
        participants: participants
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
          .map((name) => ({ name })),
        transcript_text: lines.join("\n"),
      };
      return api.createMeeting(input);
    },
    onSuccess: () => {
      onOpenChange(false);
      reset();
      queryClient.invalidateQueries();
      toast.info("Processing your meeting — Fred is generating the summary…");
      setTimeout(() => queryClient.invalidateQueries(), 2800);
    },
    onError: (e) => toast.error(e.message),
  });

  const canSubmit = title.trim().length > 0 && lines.length > 0 && !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Paste transcript</DialogTitle>
          <DialogDescription>
            Paste the transcript — each line as “mm:ss Name: text”. Fred generates the summary
            and action items.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="paste-title">Title</Label>
            <Input
              id="paste-title"
              placeholder="e.g. Design Review — Notepad"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paste-participants">
              Participants <span className="text-subtle">(comma-separated, optional)</span>
            </Label>
            <Input
              id="paste-participants"
              placeholder="e.g. Priya Sharma, Arjun Mehta"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Textarea
              placeholder={"00:04 Sarah: Alright, let's get started…\n00:21 Tom: Thanks for organizing this…"}
              rows={8}
              className="font-mono text-xs"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
            {pasted.trim() && <p className="text-xs text-subtle">{lines.length} lines detected</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
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
