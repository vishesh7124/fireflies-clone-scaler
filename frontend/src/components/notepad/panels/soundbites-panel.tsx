"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlayIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { msToClock } from "@/lib/format";
import { usePlayerStore } from "@/store/player-store";

/**
 * Soundbites panel — clip cards (play seeks + auto-stops at the clip end)
 * with delete. Created from transcript-line hover actions.
 */
export function SoundbitesPanel({ meetingId }: { meetingId: number }) {
  const queryClient = useQueryClient();
  const playClip = usePlayerStore((s) => s.playClip);

  const { data: soundbites } = useQuery({
    queryKey: qk.soundbites(meetingId),
    queryFn: () => api.listSoundbites(meetingId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteSoundbite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.soundbites(meetingId) });
      toast.success("Soundbite deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-border">
      <div className="space-y-3 p-3">
        <h3 className="px-1 text-sm font-semibold text-foreground">Soundbites</h3>
        {(soundbites ?? []).length === 0 && (
          <p className="px-1 text-xs leading-relaxed text-subtle">
            No soundbites yet — hover a transcript line and hit the soundbite button to clip it.
          </p>
        )}
        <div className="space-y-2">
          {(soundbites ?? []).map((sb) => (
            <div key={sb.id} className="group/sb space-y-2 rounded-lg border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-xs font-medium leading-snug text-foreground">
                  {sb.title}
                </p>
                <button
                  type="button"
                  aria-label="Delete soundbite"
                  onClick={() => deleteMutation.mutate(sb.id)}
                  className="shrink-0 text-subtle opacity-0 transition-opacity hover:text-destructive group-hover/sb:opacity-100"
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => playClip(sb.start_ms, sb.end_ms)}
                  className="flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-medium text-primary-soft transition-colors hover:bg-primary/25"
                >
                  <PlayIcon className="size-3" />
                  {msToClock(sb.start_ms)} – {msToClock(sb.end_ms)}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
