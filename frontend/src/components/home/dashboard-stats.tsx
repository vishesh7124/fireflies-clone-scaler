"use client";

import { useEffect, useState } from "react";
import { CalendarClockIcon, ListChecksIcon, TimerIcon, VideoIcon, type LucideIcon } from "lucide-react";
import type { DashboardData } from "@/lib/types";

/** Ease-out count-up — a small, dependency-free "AI dashboard" flourish. */
function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function StatCard({
  icon: Icon,
  label,
  target,
  suffix = "",
}: {
  icon: LucideIcon;
  label: string;
  target: number;
  suffix?: string;
}) {
  const value = useCountUp(target);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-xl font-semibold text-foreground">
          {value}
          {suffix}
        </p>
        <p className="truncate text-xs text-subtle">{label}</p>
      </div>
    </div>
  );
}

/** Home stats strip — totals from the dashboard endpoint. */
export function DashboardStats({ data }: { data: DashboardData }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard icon={VideoIcon} label="Meetings recorded" target={data.total_meetings} />
      <StatCard icon={TimerIcon} label="Minutes captured" target={data.total_minutes} />
      <StatCard icon={ListChecksIcon} label="Open tasks" target={data.open_tasks} />
      <StatCard icon={CalendarClockIcon} label="Upcoming" target={data.upcoming_count} />
    </div>
  );
}
