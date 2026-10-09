"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpIcon,
  Loader2Icon,
  MessageSquareIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { msToClock } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { cn } from "cn";

const SUGGESTIONS = [
  "What action items do I have this week?",
  "Summarize my last meeting",
  "When was pricing discussed?",
  "What blockers are trending across calls?",
];

/**
 * AskFred (global) — the real app's full-page chat: left rail with history,
 * the main thread with citation chips, and the prompt composer with
 * suggestions. Citations link to the exact meeting + moment.
 */
export default function AskFredContent() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data: messages } = useQuery({
    queryKey: qk.chat(null),
    queryFn: () => api.getChat(null),
  });

  const { data: meetingsData } = useQuery({
    queryKey: qk.meetings({ sort: "recent", page_size: 20 }),
    queryFn: () => api.listMeetings({ sort: "recent", page_size: 20 }),
  });

  const sendMutation = useMutation({
    mutationFn: (question: string) => api.sendChat(null, question),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: qk.chat(null) });
    },
    onError: (e) => toast.error(e.message),
  });

  const send = (question: string) => {
    if (!question.trim() || sendMutation.isPending) return;
    sendMutation.mutate(question.trim());
  };

  const meetings: Meeting[] = (meetingsData?.items ?? []) as unknown as Meeting[];

  return (
    <div className="flex h-full min-h-0">
      {/* left rail — chat history */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border md:flex">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <MessageSquareIcon className="size-4 text-primary-soft" />
          <span className="text-sm font-medium text-foreground">AskFred</span>
          <button
            type="button"
            aria-label="New chat"
            onClick={() => toast.info("New chat — coming soon")}
            className="ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-elevated/60 hover:text-foreground"
          >
            <PlusIcon className="size-4" />
          </button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-3">
          {meetings.length === 0 ? (
            <p className="px-1 text-xs text-subtle">No chats yet.</p>
          ) : (
            meetings.slice(0, 10).map((m) => (
              <Link
                key={m.id}
                href={`/meetings/${m.id}`}
                className="block truncate rounded-md px-2.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                {m.title}
              </Link>
            ))
          )}
        </div>
      </aside>

      {/* main chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl space-y-5 p-6">
            {(messages ?? []).length === 0 && (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <SparklesIcon className="size-8 text-primary-soft" />
                <h1 className="font-display text-2xl font-semibold text-foreground">
                  Hi VISHESH, how can I help today?
                </h1>
                <p className="max-w-md text-sm text-muted-foreground">
                  Ask me anything about your meetings — I&apos;ll pull answers from your
                  transcripts and cite exactly where they came from.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-border bg-surface px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:border-ring/40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(messages ?? []).map((message) => (
              <div
                key={message.id}
                className={cn("space-y-2", message.role === "user" ? "pl-8 text-right" : "pr-4 text-left")}
              >
                <p
                  className={cn(
                    "inline-block max-w-full whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed",
                    message.role === "user"
                      ? "rounded-tr-md bg-primary text-primary-foreground"
                      : "rounded-tl-md border border-border bg-surface text-muted-foreground",
                  )}
                >
                  {message.content}
                </p>
                {message.citations && message.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {message.citations.map((c) => (
                      <Link
                        key={`${message.id}-${c.segment_id}`}
                        href={`/meetings/${c.meeting_id}?t=${Math.round(c.start_ms / 1000)}`}
                        title={c.quote}
                        className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary-soft transition-colors hover:bg-primary/20"
                      >
                        <span className="truncate max-w-[140px]">{c.meeting_title}</span>
                        <span className="text-subtle">·</span>
                        {msToClock(c.start_ms)}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {sendMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-subtle">
                <Loader2Icon className="size-4 animate-spin" />
                Fred is thinking…
              </div>
            )}
          </div>
        </div>

        {/* composer */}
        <div className="border-t border-border p-4">
          <div className="mx-auto w-full max-w-2xl">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-elevated/60 p-2">
              <textarea
                rows={1}
                placeholder="Ask anything. Type / to run AI skills."
                className="max-h-24 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-subtle"
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
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
              >
                <ArrowUpIcon className="size-4" />
              </button>
            </div>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-subtle">
              <SparklesIcon className="size-3" />
              Consumes AI credits
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
