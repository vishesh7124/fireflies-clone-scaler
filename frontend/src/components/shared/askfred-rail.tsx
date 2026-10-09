"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpIcon,
  BotIcon,
  CheckIcon,
  CircleIcon,
  ExpandIcon,
  LayoutGridIcon,
  Loader2Icon,
  MapPinIcon,
  MessageSquareIcon,
  MicIcon,
  PlusIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { msToClock } from "@/lib/format";
import { usePlayerStore } from "@/store/player-store";
import { cn } from "cn";

/** Full-width suggestion cards (like the original rail's stacked rows). */
const CARDS: { label: string; icon: typeof CheckIcon; tint: string; prompt: string }[] = [
  {
    label: "My action items",
    icon: CheckIcon,
    tint: "bg-success/15 text-success",
    prompt: "What action items do I have this week?",
  },
  {
    label: "Key decisions",
    icon: CircleIcon,
    tint: "bg-[#ff6fb5]/15 text-[#ff6fb5]",
    prompt: "What key decisions were made in my recent meetings?",
  },
  {
    label: "Key initiatives",
    icon: MapPinIcon,
    tint: "bg-[#e5484d]/15 text-[#e5484d]",
    prompt: "What are the key initiatives across my meetings?",
  },
];

/**
 * Docked AskFred rail — a working mini-chat (not just a link to the full
 * page). Type a question and get an answer with citation chips right here,
 * or use the suggestion cards. The full-page chat is still reachable via the
 * expand icon in the header.
 */
export function AskFredRail() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [promoVisible, setPromoVisible] = useState(true);
  const [draft, setDraft] = useState("");

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

  const thread = messages ?? [];
  const isEmpty = thread.length === 0;

  return (
    <aside className="hidden w-[30rem] shrink-0 flex-col border-l border-border lg:flex">
      {/* header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <BotIcon className="size-4 text-primary-soft" />
        <span className="text-sm font-medium text-foreground">Ask Fred</span>
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Open full page"
            title="Open full page"
            onClick={() => router.push("/askfred")}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-elevated/60 hover:text-foreground"
          >
            <ExpandIcon className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="New chat"
            title="New chat"
            onClick={() => {
              api.clearChat(null).then(() => {
                queryClient.invalidateQueries({ queryKey: qk.chat(null) });
                toast.success("Started a new chat");
              });
            }}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-elevated/60 hover:text-foreground"
          >
            <PlusIcon className="size-4" />
          </button>
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {/* connect promo (dismissible, like the original) */}
        {promoVisible && isEmpty && (
          <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs leading-relaxed text-foreground">
                Connect Slack and Gmail — get answers with full context.
              </p>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setPromoVisible(false)}
                className="text-subtle transition-colors hover:text-foreground"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => toast.info("Slack & Gmail — coming soon")}
              className="mt-1 text-xs font-medium text-primary-soft hover:underline"
            >
              Connect
            </button>
          </div>
        )}

        {/* empty state: greeting + suggestion cards */}
        {isEmpty && (
          <>
            <div className="flex flex-col items-center gap-1 py-6 text-center">
              <SparklesIcon className="size-5 text-primary-soft" />
              <p className="font-display text-lg font-semibold text-foreground">Hi VISHESH!</p>
              <p className="text-sm text-muted-foreground">Get ready for your meeting</p>
            </div>
            <div className="space-y-2">
              {CARDS.map(({ label, icon: Icon, tint, prompt }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => send(prompt)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-ring/40"
                >
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tint}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* chat thread */}
        {thread.map((message) => (
          <div
            key={message.id}
            className={cn("space-y-1.5", message.role === "user" ? "pl-6 text-right" : "pr-1 text-left")}
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
                    onClick={() => {
                      window.location.href = `/meetings/${c.meeting_id}?t=${Math.round(c.start_ms / 1000)}`;
                    }}
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
          <div className="flex items-center gap-2 text-xs text-subtle">
            <Loader2Icon className="size-3.5 animate-spin" />
            Fred is thinking…
          </div>
        )}
      </div>

      {/* working prompt input (like the original) */}
      <div className="space-y-1.5 border-t border-border p-3">
        <p className="px-1 text-xs font-medium text-muted-foreground"># My Meetings</p>
        <div className="flex items-end gap-2 rounded-lg border border-border bg-elevated/60 p-2">
          <textarea
            rows={1}
            placeholder="Ask anything. Type / to run AI skills."
            className="max-h-20 flex-1 resize-none bg-transparent px-1 py-1 text-xs text-foreground outline-none placeholder:text-subtle"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
          />
          <span className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Voice"
              onClick={() => toast.info("Voice input — coming soon")}
              className="flex size-6 items-center justify-center rounded-md text-subtle hover:text-foreground"
            >
              <MicIcon className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Send"
              disabled={!draft.trim() || sendMutation.isPending}
              onClick={() => send(draft)}
              className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            >
              <ArrowUpIcon className="size-3" />
            </button>
          </span>
        </div>
      </div>
    </aside>
  );
}
