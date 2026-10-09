"use client";

import { cn } from "cn";

/**
 * Segmented tab strip — the container + active pill styling replicated from
 * the real app (Recent/Upcoming/AI Feed on Home, Hosted/Shared on Meetings).
 */
export function SegmentedTabs({
  options,
  value,
  onChange,
  className,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 rounded-lg bg-[#2c2d31] p-1", className)}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            option === value
              ? "bg-[#3a3a3d] text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
