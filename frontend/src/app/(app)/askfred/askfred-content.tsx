"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpIcon,
  CalendarIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  LayersIcon,
  Loader2Icon,
  MessageSquareIcon,
  MicIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { msToClock } from "@/lib/format";
import { cn } from "cn";

const SUGGESTIONS: { label: string; icon: typeof CheckSquareIcon }[] = [
  { label: "List my action items & todos for this week", icon: CheckSquareIcon },
  { label: "Summarize my last meeting", icon: MessageSquareIcon },
  { label: "Prepare me for the upcoming meeting", icon: CalendarIcon },
  { label: "Connect Gmail, Notion, and 30+ sources for richer insights.", icon: LayersIcon },
  { label: "Prepare weekly digest, based on my meetings", icon: CalendarIcon },
];

/**
 * AskFred (global) — replicates the real app's chat page (askfred.png):
 * icon-strip sidebar (from AppShell), a chat-history rail (New Chat /
 * Search / Connectors + Recents), a large centered prompt input with model
 * selector + MCP context bar, and full-width suggestion rows.
 */
export default function AskFredContent() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [mcpVisible, setMcpVisible] = useState(true);

  const { data: messages } = useQuery({
    queryKey: qk.chat(null),
    queryFn: () => api.getChat(null),
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


  return (
    <div className="flex h-full min-h-0">
      {/* chat-history rail (like the original) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border md:flex">
        <div className="space-y-0.5 p-3">
          <button
            type="button"
            onClick={() => {
              api.clearChat(null).then(() => {
                queryClient.invalidateQueries({ queryKey: qk.chat(null) });
                toast.success("Started a new chat");
              });
            }}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-accent/60"
          >
            <PlusIcon className="size-4 text-muted-foreground" />
            New Chat
          </button>
          <button
            type="button"
            onClick={() => toast.info("Search — coming soon")}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <SearchIcon className="size-4" />
            Search
          </button>
          <button
            type="button"
            onClick={() => toast.info("Connectors — coming soon")}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <LayersIcon className="size-4" />
            Connectors
          </button>
        </div>
        <div className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-subtle">
          Recents
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <div className="px-1 pb-1 pt-1 text-[11px] text-subtle">Today</div>
          <button
            type="button"
            onClick={() => send("List my action items & todos for this week")}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <MessageSquareIcon className="size-3.5 shrink-0 text-subtle" />
            <span className="truncate">past week&apos;s action items</span>
          </button>
        </div>
      </aside>

      {/* main chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          {(messages ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16">
              <h1 className="font-display text-2xl font-semibold text-foreground">
                Hi VISHESH, how can I help today?
              </h1>

              {/* large centered prompt input (like the original) */}
              <div className="mt-6 w-full max-w-xl">
                <div className="rounded-2xl border border-border bg-elevated/60 p-3 shadow-lg">
                  <textarea
                    rows={2}
                    placeholder="Ask anything, @ for context and / for skills"
                    className="w-full resize-none bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-subtle"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send(draft);
                      }
                    }}
                  />
                  <div className="mt-1 flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Attach"
                      onClick={() => toast.info("Attachments — coming soon")}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    >
                      <PlusIcon className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Skills"
                      onClick={() => toast.info("AI Skills — coming soon")}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    >
                      <LayersIcon className="size-4" />
                    </button>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toast.info("Model selector — coming soon")}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      >
                        Sonnet 5
                        <ChevronDownIcon className="size-3" />
                      </button>
                      <button
                        type="button"
                        aria-label="Voice"
                        onClick={() => toast.info("Voice input — coming soon")}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      >
                        <MicIcon className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Send"
                        disabled={!draft.trim() || sendMutation.isPending}
                        onClick={() => send(draft)}
                        className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
                      >
                        {sendMutation.isPending ? (
                          <Loader2Icon className="size-3.5 animate-spin" />
                        ) : (
                          <ArrowUpIcon className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* MCP context bar (like the original) */}
                {mcpVisible && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <LayersIcon className="size-3 text-primary-soft" />
                      <SparklesIcon className="size-3 text-primary-soft" />
                    </span>
                    <span className="flex-1">Bring context from 100+ apps with custom MCP</span>
                    <button
                      type="button"
                      onClick={() => toast.info("MCP connectors — coming soon")}
                      className="flex items-center gap-0.5 font-medium text-primary-soft hover:underline"
                    >
                      <PlusIcon className="size-3" /> Add
                    </button>
                    <button
                      type="button"
                      aria-label="Dismiss"
                      onClick={() => setMcpVisible(false)}
                      className="text-subtle hover:text-foreground"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </div>
                )}

                {/* full-width suggestion rows (like the original) */}
                <div className="mt-6 space-y-1.5">
                  {SUGGESTIONS.map(({ label, icon: Icon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => send(label)}
                      className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground"
                    >
                      <Icon className="size-4 shrink-0 text-subtle" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="mt-10 flex items-center gap-1.5 text-[11px] text-subtle">
                <SparklesIcon className="size-3" />
                Consumes AI credits
              </p>
            </div>
          ) : (
            /* thread view */
            <div className="mx-auto w-full max-w-2xl space-y-5 p-6">
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
                          <span className="max-w-[140px] truncate">{c.meeting_title}</span>
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
          )}
        </div>

        {/* bottom composer (visible when there are messages) */}
        {(messages ?? []).length > 0 && (
          <div className="border-t border-border p-4">
            <div className="mx-auto flex w-full max-w-2xl items-end gap-2 rounded-2xl border border-border bg-elevated/60 p-2">
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
        )}
      </div>
    </div>
  );
}
