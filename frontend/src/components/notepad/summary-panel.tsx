"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  Loader2Icon,
  PencilIcon,
  RefreshCwIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { msToClock } from "@/lib/format";
import type { Meeting, Summary, SummaryItem, SummarySectionType, SummaryTemplate } from "@/lib/types";
import { usePlayerStore } from "@/store/player-store";
import { useNotepadStore } from "@/store/notepad-store";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActionItemsSection } from "./action-items-section";

const TEMPLATES: { value: SummaryTemplate; label: string }[] = [
  { value: "general", label: "General Summary" },
  { value: "sales", label: "Sales Summary" },
  { value: "one_on_one", label: "1:1 Meeting Notes" },
  { value: "bant", label: "BANT Summary" },
];

/** An editable summary line (edit mode) with debounced autosave. */
function SummaryLine({ item, editable, mono }: { item: SummaryItem; editable: boolean; mono?: boolean }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(item.text);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setDraft(item.text), [item.text]);

  const saveMutation = useMutation({
    mutationFn: (text: string) => api.updateSummaryItem(item.id, text),
    onSuccess: (updated) => {
      // patch all summaries caches holding this item
      queryClient.setQueriesData<Summary>({ queryKey: ["summary"] }, (old) =>
        old
          ? {
              ...old,
              sections: old.sections.map((sec) => ({
                ...sec,
                items: sec.items.map((i) => (i.id === updated.id ? { ...i, text: updated.text } : i)),
              })),
            }
          : old,
      );
    },
    onError: (e) => toast.error(e.message),
  });

  if (!editable) {
    return (
      <p className={cn("text-sm leading-relaxed", mono ? "font-mono text-[11px] text-subtle" : "text-muted-foreground")}>
        {item.text}
      </p>
    );
  }

  return (
    <span
      role="textbox"
      tabIndex={0}
      contentEditable
      suppressContentEditableWarning
      className="block rounded-md border border-border bg-elevated/50 px-2 py-1 text-sm leading-relaxed text-foreground outline-none focus:border-ring"
      onInput={(e) => {
        const text = e.currentTarget.textContent ?? "";
        setDraft(text);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          if (text.trim() && text !== item.text) saveMutation.mutate(text.trim());
        }, 700);
      }}
    >
      {draft}
    </span>
  );
}

/**
 * SummaryPanel — the left pane of the Notepad (docs/01 §5.4): Overview,
 * Action items (live), Notes, Topics (timestamped chapters), Metrics — with
 * the template dropdown and the Copy / Reprocess / Edit toolbar.
 */
export function SummaryPanel({ meeting }: { meeting: Meeting }) {
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const setCollapsed = useNotepadStore((s) => s.setCollapsed);
  const collapsed = useNotepadStore((s) => s.collapsed);

  const { data: summary } = useQuery({
    queryKey: qk.summary(meeting.id),
    queryFn: () => api.getSummary(meeting.id),
  });

  const regenerateMutation = useMutation({
    mutationFn: (template: SummaryTemplate) => api.regenerateSummary(meeting.id, template),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.summary(meeting.id), updated);
      queryClient.invalidateQueries({ queryKey: qk.actionItems({ meeting_id: meeting.id }) });
      toast.success("Summary reprocessed");
    },
    onError: (e) => toast.error(e.message),
  });

  const copySummary = async () => {
    if (!summary) return;
    const text = summary.sections
      .map((sec) => `${sec.heading.toUpperCase()}\n${sec.items.map((i) => (sec.section_type === "overview" ? i.text : `- ${i.text}`)).join("\n")}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    toast.success("Summary copied to clipboard");
  };

  const activeTemplate: SummaryTemplate = summary?.template ?? "general";

  const renderSection = (type: SummarySectionType) => {
    const section = summary?.sections.find((s) => s.section_type === type);
    if (!section || section.items.length === 0) return null;
    return (
      <section key={type} id={`summary-${type}`} className="space-y-2">
        <h3 className="px-2 text-sm font-semibold text-foreground">{section.heading}</h3>
        <div className="space-y-1.5">
          {section.items.map((item) => {
            const anchored = item.timestamp_ms != null;
            return anchored ? (
              <button
                key={item.id}
                type="button"
                onClick={() => seekTo(item.timestamp_ms!)}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-surface"
                title="Jump to this moment"
              >
                <span className="shrink-0 pt-0.5 font-mono text-[11px] tabular-nums text-primary-soft">
                  {msToClock(item.timestamp_ms!)}
                  {item.end_timestamp_ms != null && (
                    <span className="text-subtle"> – {msToClock(item.end_timestamp_ms)}</span>
                  )}
                </span>
                <SummaryLine item={item} editable={editMode && type !== "topics"} />
              </button>
            ) : (
              <div key={item.id} className="flex items-start gap-2 px-2 py-1">
                {type === "notes" && <span className="mt-1.5 size-1 shrink-0 rounded-full bg-subtle" />}
                <SummaryLine item={item} editable={editMode} />
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-3 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-elevated/60"
            >
              {TEMPLATES.find((t) => t.value === activeTemplate)?.label ?? "General Summary"}
              <ChevronDownIcon className="size-3 text-subtle" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {TEMPLATES.map((t) => (
              <DropdownMenuItem
                key={t.value}
                className="justify-between text-xs"
                onClick={() => regenerateMutation.mutate(t.value)}
              >
                {t.label}
                {t.value === activeTemplate && <CheckIcon className="size-3" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="ml-auto flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label="Copy summary" title="Copy" onClick={copySummary} className="text-muted-foreground">
            <CopyIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Reprocess summary"
            title="Reprocess"
            className="text-muted-foreground"
            disabled={regenerateMutation.isPending}
            onClick={() => regenerateMutation.mutate(activeTemplate)}
          >
            {regenerateMutation.isPending ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-3.5" />
            )}
          </Button>
          <Button
            variant={editMode ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Edit summary"
            title="Edit"
            className={cn(!editMode && "text-muted-foreground")}
            onClick={() => setEditMode((m) => !m)}
          >
            <PencilIcon className="size-3.5" />
          </Button>
          {collapsed === "none" && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Collapse summary panel"
              title="Collapse"
              className="text-muted-foreground"
              onClick={() => setCollapsed("summary")}
            >
              <span className="text-xs">◀</span>
            </Button>
          )}
        </span>
      </div>

      {/* sections (the real order: Overview → Action items → Notes → Topics → Metrics) */}
      <div className="flex-1 space-y-5 overflow-y-auto p-3">
        {renderSection("overview")}
        <ActionItemsSection meeting={meeting} />
        {renderSection("notes")}
        {renderSection("topics")}
        {renderSection("metrics")}
        {!summary && <p className="px-2 text-sm text-muted-foreground">No summary yet.</p>}
      </div>
    </div>
  );
}
