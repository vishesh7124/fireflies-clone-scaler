"use client";

import {
  CalendarPlusIcon,
  ChevronRightIcon,
  PlayIcon,
  PlusIcon,
  UploadIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Placeholder Home — hero + Quick Start tiles replicate the real app's layout
 * (docs/01 §5.2) so the visual direction can be reviewed in Phase 0.
 * Full dashboard (stats strip, Recent/Upcoming/AI Feed lists) lands in Phase 2.
 */

const TILES: { label: string; icon: LucideIcon; tint: string }[] = [
  { label: "Schedule Meeting", icon: CalendarPlusIcon, tint: "bg-red-500/15 text-red-400" },
  { label: "Upload File", icon: UploadIcon, tint: "bg-teal-500/15 text-teal-300" },
  { label: "Capture Meeting", icon: PlusIcon, tint: "bg-primary/15 text-primary" },
];

export default function HomePlaceholder() {
  const phase2 = (what: string) => () => toast.info(`${what} — lands in Phase 2`);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-8">
      {/* welcome hero — amber-tinted border over a dark card, like the real app */}
      <section className="flex items-center gap-8 rounded-2xl border border-warning/25 bg-surface p-8">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Welcome aboard, VISHESH!
          </h1>
          <p className="text-sm text-muted-foreground">
            Fireflies is now ready to automate your meetings and streamline your
            workflows.
          </p>
        </div>
        {/* stylized video preview */}
        <div className="relative hidden aspect-video w-52 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-primary/50 via-primary/25 to-transparent sm:block">
          <span className="absolute inset-0 m-auto flex size-10 items-center justify-center rounded-full bg-background/80">
            <PlayIcon className="size-4 text-foreground" />
          </span>
        </div>
      </section>

      {/* quick start tiles — labels verbatim from the real app */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Quick Start</h2>
        <p className="text-sm text-muted-foreground">
          Capture your first meeting or upload a recording to see Fireflies in
          action.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {TILES.map(({ label, icon: Icon, tint }) => (
            <button
              key={label}
              type="button"
              onClick={phase2(label)}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-ring/40"
            >
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tint}`}>
                <Icon className="size-4" />
              </span>
              <span className="text-sm font-medium text-foreground">{label}</span>
              <ChevronRightIcon className="ml-auto size-4 shrink-0 text-subtle" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
