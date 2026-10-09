"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpIcon, BotIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { msToClock } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { usePlayerStore } from "@/store/player-store";
import { cn } from "cn";

const SUGGESTIONS = [
  "What were the key takeaways?",
  "When was pricing discussed?",
  "Summarize the action items",
];

/**
 * AskFred panel (meeting-scoped) — "ChatGPT for this meeting": suggested
 * prompts, a threaded chat, and citations that seek the player to the exact
 * moment (docs/03 §5.4). Rendered as the AskFred tab of the right column
 * (notepad4.png).
 */
export function AskFredPanel({ meeting }: { meeting: Meeting }) {
  const queryClient = useQueryClient();
  const seekTo = usePlayerStore((s) => s.seekTo);
  const [draft, setDraft] = useState("");

  const { data: messages } = useQuery({
    queryKey: qk.chat(meeting.id),
    queryFn: () => api.getChat(meeting.id),
  });

  const sendMutation = useMutation({
    mutationFn: (question: string) => api.sendChat(meeting.id, question),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: qk.chat(meeting.id) });
    },
    onError: (e) => toast.error(e.message),
  });

  const send = (question: string) => {
    if (!question.trim() || sendMutation.isPending) return;
    sendMutation.mutate(question.trim());
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <BotIcon className="size-4 text-primary-soft" />
        <span className="text-sm font-medium text-foreground">AskFred</span>
        <span className="ml-auto text-[11px] text-subtle">about this meeting</span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {(messages ?? []).length === 0 && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="font-display text-base font-semibold text-foreground">
              Hi VISHESH!
            </p>
            <p className="text-sm text-muted-foreground">Ask anything about this meeting</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="w-full rounded-full border border-border bg-surface px-3 py-2 text-center text-xs font-medium text-foreground transition-colors hover:border-ring/40"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {(messages ?? []).map((message) => (
          <div
            key={message.id}
            className={cn(
              "space-y-2",
              message.role === "user" ? "pl-6 text-right" : "pr-2 text-left",
            )}
          >
            <p
              className={cn(
                "inline-block max-w-full whitespace-pre-wrap rounded-xl px-3 py-2 text-left text-xs leading-relaxed",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-surface text-muted-foreground",
              )}
            >
              {message.content}
            </p>
            {message.citations && message.citations.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {message.citations.map((c) => (
                  <button
                    key={`${message.id}-${c.segment_id}`}
                    type="button"
                    onClick={() => seekTo(c.start_ms)}
                    title={c.quote}
                    className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary-soft transition-colors hover:bg-primary/20"
                  >
                    {c.speaker.split(/\s+/)[0]} · {msToClock(c.start_ms)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {sendMutation.isPending && (
          <div className="flex items-center gap-2 pr-2 text-xs text-subtle">
            <Loader2Icon className="size-3.5 animate-spin" />
            Fred is thinking…
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-lg border border-border bg-elevated/60 p-2">
          <textarea
            rows={1}
            placeholder="Ask Fred about this meeting…"
            className="max-h-24 flex-1 resize-none bg-transparent text-xs text-foreground outline-none placeholder:text-subtle"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
          />
          <button
            type="button"
            aria-label="Send"
            disabled={!draft.trim() || sendMutation.isPending}
            onClick={() => send(draft)}
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            <ArrowUpIcon className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
