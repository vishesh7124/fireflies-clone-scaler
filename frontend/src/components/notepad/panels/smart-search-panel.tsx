"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, HashIcon } from "lucide-react";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { Meeting, Transcript } from "@/lib/types";
import { useNotepadStore } from "@/store/notepad-store";
import { usePlayerStore } from "@/store/player-store";
import { classifySegment } from "@/mock/engine";
import { cn } from "cn";

/** Collapsible section header (like the original's AI FILTERS / SENTIMENTS…). */
function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group/sec">
      <summary className="flex cursor-pointer list-none items-center justify-between px-1 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDownIcon className="size-3 transition-transform group-open/sec:rotate-180" />
      </summary>
      <div className="pb-2">{children}</div>
    </details>
  );
}

/** Small ring/donut showing a speaker's talk-time share. */
function TalkRing({ pct, color }: { pct: number; color: string }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 18 18" className="size-[18px] shrink-0">
      <circle cx="9" cy="9" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" />
      <circle
        cx="9"
        cy="9"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 9 9)"
      />
    </svg>
  );
}

/**
 * Smart Search panel — the real Notepad's left panel: keyword search, AI
 * FILTERS chips (Tasks/Questions/Metrics/Date & Time with counts), SENTIMENTS
 * distribution, the SPEAKER TALKTIME table (avatar · WPM · ring %), and the
 * TOPIC TRACKERS empty state.
 */
export function SmartSearchPanel({ meeting, transcript }: { meeting: Meeting; transcript: Transcript }) {
  const smartFilter = useNotepadStore((s) => s.smartFilter);
  const setSmartFilter = useNotepadStore((s) => s.setSmartFilter);

  const { data: stats } = useQuery({
    queryKey: qk.stats(meeting.id),
    queryFn: () => api.getStats(meeting.id),
  });

  const segments = transcript.segments;

  const filters = useMemo(() => {
    const counts = { questions: 0, tasks: 0, metrics: 0, dates: 0 };
    for (const s of segments) {
      const c = classifySegment(s.text);
      if (c.question) counts.questions++;
      if (c.task) counts.tasks++;
      if (c.metric) counts.metrics++;
      if (c.date) counts.dates++;
    }
    return [
      { id: "tasks", label: "Tasks", dot: "#ffa94d", count: counts.tasks },
      { id: "questions", label: "Questions", dot: "#ff6fb5", count: counts.questions },
      { id: "metrics", label: "Metrics", dot: "#7c5cff", count: counts.metrics },
      { id: "dates", label: "Date & Time", dot: "#63e6be", count: counts.dates },
    ];
  }, [segments]);

  const sentiments = useMemo(() => {
    let positive = 0;
    let negative = 0;
    for (const s of segments) {
      const c = classifySegment(s.text);
      if (c.sentimentScore > 0.15) positive++;
      else if (c.sentimentScore < -0.15) negative++;
    }
    const neutral = segments.length - positive - negative;
    const pct = (n: number) => (segments.length ? Math.round((n / segments.length) * 100) : 0);
    return [
      { id: "sentiment-positive", label: "Positive", dot: "#63e6be", pct: pct(positive) },
      { id: null, label: "Neutral", dot: "#8a8a90", pct: pct(neutral) },
      { id: "sentiment-negative", label: "Negative", dot: "#e5484d", pct: pct(negative) },
    ];
  }, [segments]);

  return (
    <div className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-border">
      <div className="space-y-3 p-3">
        {/* section heading (no input — filters below do the work) */}
        <h2 className="px-1 text-sm font-semibold text-foreground">Smart Search</h2>

        <Section title="AI Filters">
          <div className="grid grid-cols-2 gap-1.5">
            {filters.map((f) => {
              const active = smartFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSmartFilter(active ? null : f.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors",
                    active
                      ? "border-primary/40 bg-primary/15 text-primary-soft"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: f.dot }} />
                  <span className="truncate">{f.label}</span>
                  <span className="ml-auto tabular-nums text-subtle">{f.count}</span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Sentiments">
          <div className="space-y-1">
            {sentiments.map((s) => (
              <button
                key={s.label}
                type="button"
                disabled={s.id == null}
                onClick={() => setSmartFilter(smartFilter === s.id ? null : s.id!)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-[11px] font-medium transition-colors",
                  s.id && smartFilter === s.id
                    ? "bg-primary/15 text-primary-soft"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  s.id == null && "cursor-default",
                )}
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
                {s.label}
                <span className="ml-auto h-1 w-16 overflow-hidden rounded-full bg-elevated">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${s.pct}%`, backgroundColor: s.dot }}
                  />
                </span>
                <span className="w-8 text-right tabular-nums text-subtle">{s.pct}%</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Speaker Talktime">
          <div className="mb-1 grid grid-cols-[1fr_auto_auto] gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-subtle">
            <span>Speakers</span>
            <span>WPM</span>
            <span>Talktime</span>
          </div>
          <div className="space-y-0.5">
            {(stats?.speakers ?? []).map((sp) => {
              const firstTurn = segments.find((s) => s.speaker_name === sp.name);
              return (
                <button
                  key={sp.name}
                  type="button"
                  disabled={!firstTurn}
                  onClick={() => firstTurn && usePlayerStore.getState().seekTo(firstTurn.start_ms)}
                  title={firstTurn ? "Jump to this speaker's first turn" : undefined}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-[11px] transition-colors hover:bg-accent/60 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-background"
                    style={{ backgroundColor: sp.avatar_color }}
                  >
                    {sp.name
                      .split(/\s+/)
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span className="truncate text-muted-foreground">{sp.name}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-2 text-subtle">
                    <span className="tabular-nums">{sp.wpm}</span>
                    <TalkRing pct={sp.talk_time_pct} color={sp.avatar_color} />
                    <span className="w-8 text-right tabular-nums">{sp.talk_time_pct}%</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Topic Trackers" defaultOpen={false}>
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-6 text-center">
            <HashIcon className="size-4 text-subtle" />
            <p className="text-xs font-medium text-foreground">No topic tracker</p>
            <p className="max-w-[220px] text-[11px] leading-relaxed text-subtle">
              This meeting is not transcribed yet to show keywords mentioned in the meeting.
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}
