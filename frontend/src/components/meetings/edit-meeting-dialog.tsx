"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { Meeting } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function MeetingForm({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const cache = useQueryClient();
  const [title, setTitle] = useState(meeting.title);
  const [participants, setParticipants] = useState<{ id?: number; name: string; email?: string | null }[]>(
    meeting.participants.map(({ id, name, email }) => ({ id, name, email })),
  );
  const save = useMutation({
    mutationFn: () => api.updateMeeting(meeting.id, { title: title.trim(), participants }),
    onSuccess: () => { cache.invalidateQueries(); toast.success("Meeting updated"); onClose(); },
    onError: (error) => toast.error(error.message),
  });
  const valid = title.trim() && participants.every((p) => p.name.trim()) &&
    new Set(participants.map((p) => p.name.trim().toLowerCase())).size === participants.length;
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid && !save.isPending) save.mutate(); }}>
      <div className="space-y-2">
        <Label htmlFor="edit-meeting-title">Title</Label>
        <Input id="edit-meeting-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={save.isPending} />
      </div>
      <div className="space-y-2">
        <Label>Participants</Label>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {participants.map((p, index) => (
            <div key={p.id ?? `new-${index}`} className="flex items-center gap-2">
              <Input aria-label={`Participant ${index + 1} name`} placeholder="Name" value={p.name} disabled={save.isPending}
                onChange={(e) => setParticipants(participants.map((person, i) => i === index ? { ...person, name: e.target.value } : person))} />
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove participant ${index + 1}`} disabled={save.isPending}
                onClick={() => setParticipants(participants.filter((_, i) => i !== index))}><XIcon className="size-4" /></Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" disabled={save.isPending} onClick={() => setParticipants([...participants, { name: "" }])}>
          <PlusIcon className="size-3.5" /> Add participant
        </Button>
        <p className="text-xs text-subtle">Renaming preserves transcript and task links. Removing a participant leaves their moments unassigned.</p>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={save.isPending}>Cancel</Button>
        <Button type="submit" disabled={!valid || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </form>
  );
}

/** Mounted only while open, so each edit starts from current persisted metadata. */
export function EditMeetingDialog({ meetingId, onClose }: { meetingId: number; onClose: () => void }) {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: qk.meeting(meetingId), queryFn: () => api.getMeeting(meetingId) });
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit meeting</DialogTitle><DialogDescription>Update the title and participants.</DialogDescription></DialogHeader>
        {isPending ? <p className="text-sm text-subtle">Loading meeting…</p> : isError ?
          <Button variant="outline" onClick={() => refetch()}>Could not load meeting. Retry</Button> :
          data && <MeetingForm meeting={data} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
