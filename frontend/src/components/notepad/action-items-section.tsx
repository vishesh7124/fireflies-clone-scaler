"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { ActionItem, Meeting, Participant } from "@/lib/types";
import { usePlayerStore } from "@/store/player-store";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { EditTaskDialog } from "@/components/shared/edit-task-dialog";

function dueBadgeClass(due: string | null): string {
  if (!due) return "";
  return new Date(due) < new Date() ? "text-destructive" : "text-subtle";
}

/** One action-item row — checkbox (optimistic), assignee, due, provenance, delete. */
function ActionItemRow({ item, participants }: { item: ActionItem; participants: Participant[] }) {
  const [editOpen, setEditOpen] = useState(false);
  const queryClient = useQueryClient();
  const seekTo = usePlayerStore((s) => s.seekTo);

  const updateMutation = useMutation({
    mutationFn: (patch: Parameters<typeof api.updateActionItem>[1]) =>
      api.updateActionItem(item.id, patch),
    onMutate: async (patch) => {
      // optimistic toggle — instant checkbox, rollback on failure
      await queryClient.cancelQueries({ queryKey: ["action-items"] });
      const prev = queryClient.getQueriesData<ActionItem[]>({ queryKey: ["action-items"] });
      queryClient.setQueriesData<ActionItem[]>({ queryKey: ["action-items"] }, (old) =>
        old
          ? old.map((a) =>
              a.id === item.id
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
    mutationFn: () => api.deleteActionItem(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Action item deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const assignee = participants.find((p) => p.id === item.assignee_id);

  return (
    <div className="group/ai flex items-start gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-surface/60">
      <Checkbox
        checked={item.status === "done"}
        onCheckedChange={(checked) =>
          updateMutation.mutate({ status: checked ? "done" : "open" })
        }
        className="mt-0.5"
        aria-label={`Mark "${item.description}" as ${item.status === "done" ? "open" : "done"}`}
      />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className={cn(
            "block w-full text-left text-sm leading-snug",
            item.status === "done" ? "text-subtle line-through" : "text-foreground",
          )}
          onClick={() => item.source_segment_id != null && seekTo(item.source_start_ms ?? 0)}
          title={item.source_segment_id != null ? "Jump to the moment this came from" : undefined}
        >
          {item.description}
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          {assignee && (
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: assignee.avatar_color }} />
              <span className="text-muted-foreground">{assignee.name}</span>
            </span>
          )}
          {item.due_date && (
            <span className={cn("font-medium", dueBadgeClass(item.due_date))}>
              due {new Date(item.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          {item.status === "in_progress" && (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary-soft">
              in progress
            </span>
          )}
          {item.source_segment_id != null && (
            <span className="text-primary-soft hover:underline">source</span>
          )}
        </div>
      </div>
      {editOpen && <EditTaskDialog task={item} onClose={() => setEditOpen(false)} />}
      <Button variant="ghost" size="icon-sm" aria-label="Edit action item" onClick={() => setEditOpen(true)}>
        <PencilIcon className="size-3.5" />
      </Button>
      <button
        type="button"
        aria-label="Delete action item"
        onClick={() => deleteMutation.mutate()}
        className="mt-0.5 text-subtle opacity-0 transition-opacity hover:text-destructive group-hover/ai:opacity-100"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </div>
  );
}

/**
 * Action items section — live CRUD over the action-items table (the real
 * product's dedicated action-item section with tasks assigned to people).
 * Clicking a task jumps the player to the moment it came from.
 */
export function ActionItemsSection({ meeting }: { meeting: Meeting }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data: items } = useQuery({
    queryKey: qk.actionItems({ meeting_id: meeting.id }),
    queryFn: () => api.listActionItems({ meeting_id: meeting.id }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createActionItem(meeting.id, { description: draft.trim(), due_date: null }),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["action-items"] });
      queryClient.invalidateQueries({ queryKey: qk.meeting(meeting.id) });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
      toast.success("Action item added");
    },
    onError: (e) => toast.error(e.message),
  });

  const list = items ?? [];
  const open = list.filter((i) => i.status !== "done").length;

  return (
    <section id="summary-action_items" className="space-y-1">
      <h3 className="px-2 text-sm font-semibold text-foreground">
        Action items {list.length > 0 && <span className="text-subtle">({open} open)</span>}
      </h3>
      {list.length === 0 ? (
        <p className="px-2 py-2 text-xs text-subtle">No action items were captured.</p>
      ) : (
        list.map((item) => <ActionItemRow key={item.id} item={item} participants={meeting.participants} />)
      )}
      <div className="flex items-center gap-2 px-2 pt-1">
        <PlusIcon className="size-3.5 shrink-0 text-subtle" />
        <Input
          value={draft}
          placeholder="Add an action item…"
          className="h-7 border-transparent bg-transparent px-1 text-xs focus-visible:border-border"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim() && !createMutation.isPending) createMutation.mutate();
          }}
        />
        {draft.trim() && (
          <Button variant="ghost" size="xs" className="shrink-0 text-xs" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
            Add
          </Button>
        )}
      </div>
    </section>
  );
}
