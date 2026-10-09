"use client";

import { useRef } from "react";
import { useNotepadStore } from "@/store/notepad-store";

/**
 * SplitLayout — the real Notepad's two-panel layout with a draggable divider
 * and expand/collapse ("You can expand either side or go full screen").
 * Geometry persists via the notepad store.
 */
export function SplitLayout({ summary, transcript }: { summary: React.ReactNode; transcript: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPct = useNotepadStore((s) => s.leftPct);
  const collapsed = useNotepadStore((s) => s.collapsed);
  const setLeftPct = useNotepadStore((s) => s.setLeftPct);
  const setCollapsed = useNotepadStore((s) => s.setCollapsed);

  const onDividerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPct(pct);
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  return (
    <div ref={containerRef} className="flex min-h-0 min-w-0 flex-1">
      {collapsed !== "summary" && (
        <div
          className="flex min-h-0 min-w-0 flex-col"
          style={{ width: collapsed === "transcript" ? "100%" : `${leftPct}%` }}
        >
          {summary}
        </div>
      )}

      {collapsed === "none" && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
          tabIndex={0}
          onPointerDown={onDividerPointerDown}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setLeftPct(leftPct - 4);
            if (e.key === "ArrowRight") setLeftPct(leftPct + 4);
          }}
          className="group/div relative w-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-primary/40"
        >
          <span className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}

      {collapsed !== "transcript" && (
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {transcript}
          {collapsed === "summary" && (
            <button
              type="button"
              aria-label="Expand summary panel"
              onClick={() => setCollapsed("none")}
              className="absolute left-0 top-12 z-10 flex size-6 items-center justify-center rounded-r-md border border-l-0 border-border bg-surface text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              ▶
            </button>
          )}
        </div>
      )}
    </div>
  );
}
