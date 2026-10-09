"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { ActionItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Shared task editor for the Tasks page and meeting notes. */
export function EditTaskDialog({ task, onClose }: { task: ActionItem; onClose: () => void }) {
  const cache = useQueryClient();
  const [description, setDescription] = useState(task.description);
  const [assignee, setAssignee] = useState(task.assignee_id == null ? "none" : String(task.assignee_id));
  const [dueDate, setDueDate] = useState(task.due_date?.slice(0, 10) ?? "");
  const { data: meeting, isError, refetch } = useQuery({ queryKey: qk.meeting(task.meeting_id), queryFn: () => api.getMeeting(task.meeting_id) });
  const save = useMutation({
    mutationFn: () => api.updateActionItem(task.id, {
      description: description.trim(), assignee_id: assignee === "none" ? null : Number(assignee), due_date: dueDate || null,
    }),
    onSuccess: () => { cache.invalidateQueries(); toast.success("Task updated"); onClose(); },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit task</DialogTitle><DialogDescription>{task.meeting_title}</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (description.trim() && !save.isPending && meeting) save.mutate(); }}>
          <div className="space-y-2"><Label htmlFor="edit-task-description">Task</Label>
            <Input id="edit-task-description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={save.isPending} /></div>
          <div className="space-y-2"><Label htmlFor="edit-task-assignee">Assignee</Label>
            <Select value={assignee} onValueChange={setAssignee} disabled={!meeting || save.isPending}>
              <SelectTrigger id="edit-task-assignee"><SelectValue placeholder="Loading participants…" /></SelectTrigger>
              <SelectContent><SelectItem value="none">Unassigned</SelectItem>
                {meeting?.participants.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {isError && <Button type="button" variant="ghost" size="sm" onClick={() => refetch()}>Could not load participants. Retry</Button>}
          </div>
          <div className="space-y-2"><Label htmlFor="edit-task-due">Due date</Label>
            <Input id="edit-task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={save.isPending} /></div>
          <DialogFooter><Button type="button" variant="ghost" onClick={onClose} disabled={save.isPending}>Cancel</Button>
            <Button type="submit" disabled={!description.trim() || !meeting || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
