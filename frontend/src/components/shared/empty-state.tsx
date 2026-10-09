import type { LucideIcon } from "lucide-react";

/** Centered empty state — icon, heading, subline, optional CTA (real-app copy). */
export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-elevated text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <div className="space-y-1">
        <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
