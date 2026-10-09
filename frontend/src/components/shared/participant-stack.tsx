import type { ParticipantSummary } from "@/lib/types";

/** Overlapping participant avatars (initials) + "+N" overflow, like the real app. */
export function ParticipantStack({
  participants,
  max = 4,
}: {
  participants: ParticipantSummary[];
  max?: number;
}) {
  const shown = participants.slice(0, max);
  const rest = participants.length - shown.length;
  if (participants.length === 0) return null;

  return (
    <span className="flex shrink-0 items-center -space-x-1.5" title={participants.map((p) => p.name).join(", ")}>
      {shown.map((p) => (
        <span
          key={p.name}
          className="flex size-6 items-center justify-center rounded-full border-2 border-background text-[9px] font-bold text-background"
          style={{ backgroundColor: p.avatar_color }}
        >
          {p.name
            .split(/\s+/)
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </span>
      ))}
      {rest > 0 && (
        <span className="flex size-6 items-center justify-center rounded-full border-2 border-background bg-elevated text-[9px] font-bold text-muted-foreground">
          +{rest}
        </span>
      )}
    </span>
  );
}
