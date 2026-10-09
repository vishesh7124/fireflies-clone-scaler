"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CameraOffIcon,
  CameraIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  Loader2Icon,
  MaximizeIcon,
  PencilIcon,
  PlayIcon,
  RefreshCwIcon,
  SparklesIcon,
  StarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { formatDate, msToClock } from "@/lib/format";
import type { Meeting, Summary, SummaryItem, SummaryTemplate } from "@/lib/types";
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

/** Editable summary bullet with debounced autosave. */
function EditableBullet({ item, editable }: { item: SummaryItem; editable: boolean }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(item.text);
  const timer = useMemo(() => ({ current: null as ReturnType<typeof setTimeout> | null }), []);

  const saveMutation = useMutation({
    mutationFn: (text: string) => api.updateSummaryItem(item.id, text),
    onSuccess: (updated) => {
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

  const save = (text: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (text.trim() && text !== item.text) saveMutation.mutate(text.trim());
    }, 700);
  };

  return (
    <li className="list-disc pl-4 marker:text-subtle">
      {editable ? (
        <span
          role="textbox"
          tabIndex={0}
          contentEditable
          suppressContentEditableWarning
          className="rounded border border-transparent bg-elevated/40 px-1 text-sm leading-relaxed text-foreground outline-none focus:border-ring"
          onInput={(e) => {
            const text = e.currentTarget.textContent ?? "";
            setDraft(text);
            save(text);
          }}
        >
          {draft}
        </span>
      ) : (
        <span className="text-sm leading-relaxed text-muted-foreground">{item.text}</span>
      )}
      {item.timestamp_ms != null && (
        <button
          type="button"
          onClick={() => usePlayerStore.getState().seekTo(item.timestamp_ms!)}
          className="ml-1.5 font-mono text-[11px] tabular-nums text-subtle hover:text-primary-soft hover:underline"
          title="Jump to this moment"
        >
          ({msToClock(item.timestamp_ms)})
        </button>
      )}
    </li>
  );
}

/**
 * NotesPanel — the Notepad's center column (docs/01 §5.4 + notepad1-4.png):
 * Notes | AI Skills tabs, the video surface, meeting title + Video toggle,
 * author/date/language meta row, the summary toolbar (General Summary ▾ /
 * Refine Summary / copy / Edit), topic-grouped bullets with (MM:SS)
 * timestamps, the live action-items section, the summary feedback card, and
 * the "Continue from this meeting ✨" section.
 */
export function NotesPanel({ meeting }: { meeting: Meeting }) {
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const videoVisible = useNotepadStore((s) => s.videoVisible);
  const setVideoVisible = useNotepadStore((s) => s.setVideoVisible);
  const setTranscriptHidden = useNotepadStore((s) => s.setTranscriptHidden);
  const transcriptHidden = useNotepadStore((s) => s.transcriptHidden);
  const currentTimeMs = usePlayerStore((s) => s.currentTimeMs);
  const durationMs = usePlayerStore((s) => s.durationMs);
  const toggle = usePlayerStore((s) => s.toggle);

  const { data: summary } = useQuery({
    queryKey: qk.summary(meeting.id),
    queryFn: () => api.getSummary(meeting.id),
  });

  const regenerateMutation = useMutation({
    mutationFn: (template: SummaryTemplate) => api.regenerateSummary(meeting.id, template),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.summary(meeting.id), updated);
      queryClient.invalidateQueries({ queryKey: ["action-items"] });
      toast.success("Summary reprocessed");
    },
    onError: (e) => toast.error(e.message),
  });

  const section = (type: string) => summary?.sections.find((s) => s.section_type === type);
  const notes = section("notes")?.items ?? [];
  const topics = section("topics")?.items ?? [];
  const metrics = section("metrics")?.items ?? [];
  const overview = section("overview")?.items[0]?.text ?? "";
  const activeTemplate: SummaryTemplate = summary?.template ?? "general";

  // group note bullets under their topic chapters (by anchor time) — the
  // original's bold subheaders ("Corporate Event Support") + bulleted groups
  const groups = useMemo(() => {
    const result: { topic: string; items: SummaryItem[]; startMs: number | null }[] = [];
    const withTs = notes.filter((n) => n.timestamp_ms != null);
    const withoutTs = notes.filter((n) => n.timestamp_ms == null);

    if (topics.length > 0) {
      topics.forEach((t, i) => {
        const from = t.timestamp_ms ?? 0;
        const to = topics[i + 1]?.timestamp_ms ?? Infinity;
        result.push({
          topic: t.text,
          startMs: from,
          items: withTs.filter((n) => n.timestamp_ms! >= from && n.timestamp_ms! < to),
        });
      });
      // notes that couldn't be anchored → first group keeps them
      if (withoutTs.length > 0) result[0]?.items.push(...withoutTs);
    } else {
      result.push({ topic: "", startMs: null, items: [...notes] });
    }
    return result.filter((g) => g.items.length > 0);
  }, [notes, topics]);

  const copySummary = async () => {
    if (!summary) return;
    const text = summary.sections
      .map(
        (sec) =>
          `${sec.heading.toUpperCase()}\n${sec.items
            .map((i) => `- ${i.text}${i.timestamp_ms != null ? ` (${msToClock(i.timestamp_ms)})` : ""}`)
            .join("\n")}`,
      )
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    toast.success("Summary copied to clipboard");
  };

  const progress = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* tabs row: Notes | AI Skills + fullscreen toggle */}
      <div className="flex shrink-0 items-center justify-center gap-1 border-b border-border px-3 py-2">
        <div className="flex items-center gap-1 rounded-lg bg-surface p-1">
          <span className="rounded-md bg-elevated px-3 py-1 text-sm font-medium text-foreground">
            Notes
          </span>
          <button
            type="button"
            onClick={() => toast.info("AI Skills — coming soon")}
            className="rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            AI Skills <span className="ml-1 text-xs text-subtle">0</span>
          </button>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={transcriptHidden ? "Show transcript" : "Full screen notes"}
          title={transcriptHidden ? "Show transcript" : "Full screen notes"}
          className="absolute right-3 text-muted-foreground"
          onClick={() => setTranscriptHidden(!transcriptHidden)}
        >
          <MaximizeIcon className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-4 p-5">
          {/* video surface (toggleable, like the original's Video area) */}
          {videoVisible && (
            <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-black/70">
              {/* mock participant grid (real video arrives with the backend) */}
              <div className="absolute inset-0 grid grid-cols-3 gap-px p-px opacity-80">
                {meeting.participants.slice(0, 9).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-center bg-gradient-to-br from-[#1e1e28] to-[#14141c] text-[11px] font-bold"
                    style={{ color: p.avatar_color }}
                  >
                    {p.name
                      .split(/\s+/)
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 6 - meeting.participants.length) }).map((_, i) => (
                  <div key={`pad-${i}`} className="bg-gradient-to-br from-[#1e1e28] to-[#14141c]" />
                ))}
              </div>
              <button
                type="button"
                aria-label="Play"
                onClick={toggle}
                className="absolute inset-0 m-auto flex size-12 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg transition-transform hover:scale-105"
              >
                <PlayIcon className="size-5 translate-x-[1px]" />
              </button>
              {/* progress */}
              <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
                <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* title + Video toggle */}
          <div className="flex items-start justify-between gap-3">
            <h1 className="min-w-0 font-display text-xl font-bold leading-tight text-foreground">
              {meeting.title}
            </h1>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs"
              onClick={() => setVideoVisible(!videoVisible)}
            >
              {videoVisible ? <CameraOffIcon className="size-3.5" /> : <CameraIcon className="size-3.5" />}
              Video
            </Button>
          </div>

          {/* author / date / language meta row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
            <span className="flex size-5 items-center justify-center rounded bg-elevated text-[10px] font-bold text-foreground">
              V
            </span>
            <button
              type="button"
              className="font-medium text-foreground underline decoration-border hover:decoration-foreground"
              onClick={() => toast.info(meeting.participants[0]?.name ?? "Host")}
            >
              {(meeting.participants[0]?.name ?? "Vishesh Gupta").toUpperCase()}
            </button>
            <span className="text-subtle">
              {formatDate(meeting.meeting_date, "MMM d yyyy, h:mm a")}
            </span>
            <span className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
              English (Global)
              <ChevronDownIcon className="size-3" />
            </span>
          </div>

          {/* summary toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-y border-border py-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium text-primary-soft transition-colors hover:bg-primary/10"
                >
                  <SparklesIcon className="size-3.5" />
                  {TEMPLATES.find((t) => t.value === activeTemplate)?.label ?? "General Summary"}
                  <ChevronDownIcon className="size-3" />
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
            <button
              type="button"
              disabled={regenerateMutation.isPending}
              onClick={() => regenerateMutation.mutate(activeTemplate)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium text-primary-soft transition-colors hover:bg-primary/10 disabled:opacity-50"
            >
              {regenerateMutation.isPending ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <SparklesIcon className="size-3.5" />
              )}
              Refine Summary
            </button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copy summary"
              title="Copy"
              className="text-muted-foreground"
              onClick={copySummary}
            >
              <CopyIcon className="size-3.5" />
            </Button>
            <span className="ml-auto">
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
            </span>
          </div>

          {/* Notes — topic-grouped bullets with (MM:SS), like the original */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Notes</h2>
            {groups.map((group) => (
              <div key={`${group.topic}-${group.startMs}`} className="space-y-2">
                {group.topic && (
                  <h3 className="text-[15px] font-bold text-foreground">{group.topic}</h3>
                )}
                <ul className="space-y-1.5">
                  {group.items.map((item) => (
                    <EditableBullet key={item.id} item={item} editable={editMode} />
                  ))}
                </ul>
              </div>
            ))}
            {groups.length === 0 && (
              <p className="text-sm text-muted-foreground">No notes were captured.</p>
            )}

            {/* metrics bullets */}
            {metrics.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[15px] font-bold text-foreground">Metrics</h3>
                <ul className="space-y-1.5">
                  {metrics.map((item) => (
                    <EditableBullet key={item.id} item={item} editable={editMode} />
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* action items (the guide's dedicated section) */}
          <ActionItemsSection meeting={meeting} />

          {/* "Did you like the summary?" feedback card */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-foreground">
              <span aria-hidden>🙂</span>
              Did you like the summary?
            </span>
            <span className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
                  onClick={() => toast.success("Thanks for the feedback!")}
                  className="text-muted-foreground transition-colors hover:text-primary-soft"
                >
                  <StarIcon className="size-4" />
                </button>
              ))}
            </span>
          </div>

          {/* "Continue from this meeting ✨" */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              Continue from this meeting <span aria-hidden>✨</span>
            </h2>
            {overview && (
              <div className="rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed text-muted-foreground">
                {overview}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {topics.slice(0, 3).map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toast.info("AI Skills — coming soon")}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-ring/40"
                  style={{ borderLeftColor: ["#7c5cff", "#ffd43b", "#74c0fc"][i % 3] }}
                >
                  <span className="text-primary-soft">+</span>
                  {t.text}
                </button>
              ))}
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-subtle">
              <SparklesIcon className="size-3" />
              Consumes AI credits
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
