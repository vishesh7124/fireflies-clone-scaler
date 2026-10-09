"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightIcon, InboxIcon, ListChecksIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { formatDate } from "@/lib/format";
import type { ActionItem, MeetingListItem } from "@/lib/types";
import { usePlayerStore } from "@/store/player-store";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedTabs } from "@/components/shared/segmented-tabs";
import { EditTaskDialog } from "@/components/shared/edit-task-dialog";
import { DataError } from "@/components/shared/data-error";

const TABS = ["My Tasks", "All Tasks"];

/** One task row — checkbox, description, assignee, due date, provenance link. */
function TaskRow({ task }: { task: ActionItem }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const queryClient = useQueryClient();
  const seekTo = usePlayerStore((s) => s.seekTo);

  const updateMutation = useMutation({
    mutationFn: (patch: { status?: "open" | "in_progress" | "done" }) =>
      api.updateActionItem(task.id, patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["action-items"] });
      const prev = queryClient.getQueriesData<ActionItem[]>({ queryKey: ["action-items"] });
      queryClient.setQueriesData<ActionItem[]>({ queryKey: ["action-items"] }, (old) =>
        old
          ? old.map((a) =>
              a.id === task.id
                ? {
                    ...a,
                    ...patch,
                    completed_at:
                      patch.status === "done" ? new Date().toISOString() : a.completed_at,
                  }
                : a,
            )
          : old,
      );
      return { prev };
    },
    onError: (e, _patch, ctx) => {
      ctx?.prev.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(e.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["action-items"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteActionItem(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Task deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="group/task flex items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-surface">
      <Checkbox
        checked={task.status === "done"}
        onCheckedChange={(checked) =>
          updateMutation.mutate({ status: checked ? "done" : "open" })
        }
        className="mt-0.5"
        aria-label={`Mark "${task.description}" as ${task.status === "done" ? "open" : "done"}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            className={cn(
              "min-w-0 flex-1 text-left text-sm leading-snug",
              task.status === "done" ? "text-subtle line-through" : "text-foreground",
            )}
            onClick={() => {
              if (task.source_start_ms != null) {
                router.push(`/meetings/${task.meeting_id}?t=${Math.round(task.source_start_ms / 1000)}`);
              }
            }}
            title={task.source_start_ms != null ? "Jump to the moment this came from" : undefined}
          >
            {task.description}
          </button>
          {/* assignee chip (or Assign button) — visible on the task row */}
          {task.assignee_name ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-elevated/60 px-2 py-1 text-[11px]">
              <span
                className="flex size-4 items-center justify-center rounded-full text-[8px] font-bold text-background"
                style={{ backgroundColor: "#7c5cff" }}
              >
                {task.assignee_name[0]?.toUpperCase()}
              </span>
              <span className="font-medium text-foreground">{task.assignee_name}</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-elevated/60 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <PlusIcon className="size-3" />
              Assign
            </button>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          {task.due_date && (
            <span
              className={cn(
                "font-medium",
                new Date(task.due_date) < new Date() && task.status !== "done"
                  ? "text-destructive"
                  : "text-subtle",
              )}
            >
              due {formatDate(task.due_date, "MMM d")}
            </span>
          )}
          {task.source_start_ms != null && (
            <Link
              href={`/meetings/${task.meeting_id}?t=${Math.round(task.source_start_ms / 1000)}`}
              className="text-primary-soft hover:underline"
              onClick={() => seekTo(task.source_start_ms!)}
            >
              ↗ source
            </Link>
          )}
        </div>
      </div>
      {editOpen && <EditTaskDialog task={task} onClose={() => setEditOpen(false)} />}
      <Button variant="ghost" size="icon-sm" aria-label="Edit task" onClick={() => setEditOpen(true)}>
        <PencilIcon className="size-3.5" />
      </Button>
      <button
        type="button"
        aria-label="Delete task"
        onClick={() => deleteMutation.mutate()}
        className="mt-0.5 text-subtle opacity-0 transition-opacity hover:text-destructive group-hover/task:opacity-100"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </div>
  );
}

/** New task dialog — pick a meeting, describe the task, assign, set a due date. */
function NewTaskDialog({
  open,
  onOpenChange,
  meetings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetings: MeetingListItem[];
}) {
  const queryClient = useQueryClient();
  const [meetingId, setMeetingId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState("none");
  const { data: selectedMeeting } = useQuery({
    queryKey: qk.meeting(meetingId ?? 0),
    queryFn: () => api.getMeeting(meetingId!),
    enabled: meetingId != null,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createActionItem(meetingId!, {
        description: description.trim(),
        assignee_id: assignee === "none" ? null : Number(assignee),
        due_date: dueDate || null,
      }),
    onSuccess: () => {
      setMeetingId(null);
      setDescription("");
      setDueDate("");
      setAssignee("none");
      onOpenChange(false);
      queryClient.invalidateQueries();
      toast.success("Task added");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-meeting">Meeting</Label>
            <Select
              value={meetingId ? String(meetingId) : undefined}
              onValueChange={(v) => { setMeetingId(Number(v)); setAssignee("none"); }}
            >
              <SelectTrigger id="task-meeting" className="text-xs">
                <SelectValue placeholder="Pick a meeting" />
              </SelectTrigger>
              <SelectContent>
                {meetings.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)} className="text-xs">
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-desc">Task</Label>
            <Input
              id="task-desc"
              placeholder="e.g. Send the security questionnaire to legal"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-due">Due date</Label>
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-assignee">Assignee</Label>
            <Select value={assignee} onValueChange={setAssignee} disabled={!selectedMeeting || createMutation.isPending}>
              <SelectTrigger id="task-assignee"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {selectedMeeting?.participants.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!meetingId || !description.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            Add task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Tasks — the real app's "All your meeting tasks in one place" view (docs/01
 * §5.5): My/All segmented toggle, the work-apps integration banner, tasks
 * grouped by meeting with provenance links into the Notepad, and a New dialog.
 */
export default function TasksContent() {
  const [tab, setTab] = useState(TABS[0]);
  const [newOpen, setNewOpen] = useState(false);

  const { data: me } = useQuery({ queryKey: qk.me, queryFn: () => api.getMe() });
  const { data: tasks, isPending, isError, refetch } = useQuery({
    queryKey: qk.actionItems({}),
    queryFn: () => api.listActionItems({}),
  });
  const { data: meetingsData } = useQuery({
    queryKey: qk.meetings({ sort: "recent", page_size: 50 }),
    queryFn: () => api.listMeetings({ sort: "recent", page_size: 50 }),
  });

  const meetings = meetingsData?.items ?? [];
  const allTasks = tasks ?? [];
  const filtered = tab === "My Tasks" ? allTasks.filter((t) => t.assignee_name === me?.name) : allTasks;

  // group by meeting, preserving meeting title order
  const groups = filtered.reduce<Record<number, ActionItem[]>>((acc, t) => {
    (acc[t.meeting_id] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-8">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <SegmentedTabs options={TABS} value={tab} onChange={setTab} />
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <PlusIcon className="size-3.5" />
          New
        </Button>
      </div>

      {/* integration banner (like the real app) */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <span className="flex items-center gap-1">
          {["#FF6B6B", "#FFB800", "#4ECDC4"].map((c) => (
            <span
              key={c}
              className="size-5 rounded"
              style={{ backgroundColor: c, opacity: 0.85 }}
            />
          ))}
        </span>
        <p className="flex-1 text-sm text-muted-foreground">
          Automatically send all your tasks to your work apps.
        </p>
        <button
          type="button"
          onClick={() => toast.info("Task integrations — coming soon")}
          className="text-sm font-medium text-primary-soft hover:underline"
        >
          Connect
        </button>
      </div>

      {/* task list grouped by meeting */}
      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : isError ? <DataError title="Could not load tasks" onRetry={() => { void refetch(); }} /> : Object.keys(groups).length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <InboxIcon className="size-10 text-subtle" />
          <h3 className="font-display text-lg font-semibold text-foreground">
            All your meeting tasks in one place
          </h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Manage, assign and update all your meeting tasks here.
          </p>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <PlusIcon className="size-3.5" />
            New
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([mid, group]) => {
            const meeting = meetings.find((m) => m.id === Number(mid));
            return (
              <section key={mid} className="overflow-hidden rounded-lg border border-border bg-surface/40 [&>div+div]:border-t [&>div+div]:border-border/60">
                <h3 className="flex items-center gap-1.5 border-b border-border bg-surface px-4 py-4 text-sm font-medium text-muted-foreground">
                  <ListChecksIcon className="size-3" />
                  {meeting?.title ?? `Meeting #${mid}`}
                  {meeting && (
                    <Link
                      href={`/meetings/${meeting.id}`}
                      className="ml-auto normal-case text-primary-soft hover:underline"
                    >
                      Open <ArrowRightIcon className="inline size-3" />
                    </Link>
                  )}
                </h3>
                {group.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </section>
            );
          })}
        </div>
      )}

      <NewTaskDialog open={newOpen} onOpenChange={setNewOpen} meetings={meetings} />
    </div>
  );
}
