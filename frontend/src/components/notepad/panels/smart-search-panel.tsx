"use client";

import { useQuery } from "@tanstack/react-query";
import { MicIcon } from "lucide-react";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { Meeting, Transcript } from "@/lib/types";
import { useNotepadStore } from "@/store/notepad-store";
import { cn } from "cn";

/**
 * Smart Search panel — the real product's AI filters: Questions, Tasks, Dates,
 * Metrics, Pricing, Sentiment, Fillers. Counts + click → seek to the first
 * match (rules ported from docs/03 §5.2). Plus speaker talk-time + pace.
 */
export function SmartSearchPanel({ meeting, transcript }: { meeting: Meeting; transcript: Transcript }) {
  const { data: stats } = useQuery({
    queryKey: qk.stats(meeting.id),
    queryFn: () => api.getStats(meeting.id),
  });
  const smartFilter = useNotepadStore((s) => s.smartFilter);
  const setSmartFilter = useNotepadStore((s) => s.setSmartFilter);

  const filters = [
    { id: "questions", label: "Questions", count: stats?.filters.questions },
    { id: "tasks", label: "Tasks", count: stats?.filters.tasks },
    { id: "dates", label: "Dates", count: stats?.filters.dates },
    { id: "metrics", label: "Metrics", count: stats?.filters.metrics },
    { id: "pricing", label: "Pricing", count: stats?.filters.pricing },
    { id: "sentiment", label: "Sentiment", count: undefined },
    { id: "fillers", label: "Fillers", count: stats?.filters.fillers },
  ];

  const totalDurationMin = Math.round(transcript.duration_ms / 60000);

  return (
    <div className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-border">
      <div className="space-y-3 p-3">
        <h3 className="px-1 text-sm font-semibold text-foreground">Smart Search</h3>
        <div className="space-y-1">
          {filters.map((f) => {
            const active = smartFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setSmartFilter(active ? null : f.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                {f.label}
                <span className={cn("text-xs tabular-nums", active ? "text-primary" : "text-subtle")}>
                  {f.count ?? "—"}
                </span>
              </button>
            );
          })}
        </div>

        {stats && (
          <div className="space-y-3 border-t border-border pt-3">
            <h4 className="px-1 text-xs font-semibold uppercase tracking-wide text-subtle">
              Speakers
            </h4>
            <div className="space-y-2.5">
              {stats.speakers.map((s) => (
                <div key={s.name} className="space-y-1 px-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="size-2 rounded-full" style={{ backgroundColor: s.avatar_color }} />
                    <span className="truncate text-foreground">{s.name}</span>
                    <span className="ml-auto shrink-0 tabular-nums text-subtle">
                      {s.talk_time_pct}% · {s.wpm} wpm
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${s.talk_time_pct}%`, backgroundColor: s.avatar_color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 px-1 text-xs text-subtle">
              <MicIcon className="size-3" />
              {totalDurationMin} min total
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
