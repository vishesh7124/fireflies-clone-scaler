"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
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

/**
 * Schedule a meeting — creates a `scheduled` meeting (no transcript yet) that
 * appears under Home → Upcoming and in the meetings list.
 */
export function ScheduleDialog() {
  const { scheduleOpen, closeSchedule } = useUiStore();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [participants, setParticipants] = useState("");

  const reset = () => {
    setTitle("");
    setDate("");
    setParticipants("");
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const input: CreateMeetingInput = {
        title: title.trim(),
        meeting_date: date ? new Date(date).toISOString() : new Date().toISOString(),
        participants: participants
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
          .map((name) => ({ name })),
      };
      return api.createMeeting(input);
    },
    onSuccess: () => {
      closeSchedule();
      reset();
      queryClient.invalidateQueries();
      toast.success("Meeting scheduled — Fred will join when it starts");
    },
    onError: (e) => toast.error(e.message),
  });

  const canSubmit = title.trim().length > 0 && !createMutation.isPending;

  return (
    <Dialog open={scheduleOpen} onOpenChange={(open) => !open && closeSchedule()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule new meeting</DialogTitle>
          <DialogDescription>
            The Fireflies notetaker joins automatically based on your settings. (Bot joining
            is a mocked feature — the meeting is saved as upcoming.)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schedule-title">Title</Label>
            <Input
              id="schedule-title"
              placeholder="e.g. Design Review — Notepad Layout"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-date">Date &amp; time</Label>
            <Input
              id="schedule-date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-participants">
              Participants <span className="text-subtle">(comma-separated, optional)</span>
            </Label>
            <Input
              id="schedule-participants"
              placeholder="e.g. Priya Sharma, Sneha Rao"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={closeSchedule}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={() => createMutation.mutate()}>
            {createMutation.isPending && <Loader2Icon className="size-3.5 animate-spin" />}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
