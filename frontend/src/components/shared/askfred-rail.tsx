"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpIcon,
  BotIcon,
  CheckIcon,
  CircleIcon,
  LayoutGridIcon,
  MapPinIcon,
  MessageSquareIcon,
  MicIcon,
  PlusIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

/** Full-width suggestion cards (like the original rail's stacked rows). */
const CARDS: { label: string; icon: typeof CheckIcon; tint: string; to: string }[] = [
  { label: "My action items", icon: CheckIcon, tint: "bg-success/15 text-success", to: "/tasks" },
  { label: "Key decisions", icon: CircleIcon, tint: "bg-[#ff6fb5]/15 text-[#ff6fb5]", to: "/askfred" },
  { label: "Key initiatives", icon: MapPinIcon, tint: "bg-[#e5484d]/15 text-[#e5484d]", to: "/askfred" },
];

/**
 * Docked AskFred rail — replicates the real app's right panel (docs/01 §5.3):
 * header with bot icon + chat/new actions, the Slack/Gmail connect promo,
 * greeting + suggestion cards, and the "# My Meetings" prompt.
 * The live chat lands in Phase 4; the prompt routes there meanwhile.
 */
export function AskFredRail() {
  const router = useRouter();
  const [promoVisible, setPromoVisible] = useState(true);

  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l border-border lg:flex">
      {/* header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <BotIcon className="size-4 text-primary-soft" />
        <span className="text-sm font-medium text-foreground">Ask Fred</span>
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Chats"
            onClick={() => router.push("/askfred")}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-elevated/60 hover:text-foreground"
          >
            <MessageSquareIcon className="size-4" />
          </button>
          <button
            type="button"
            aria-label="New chat"
            onClick={() => router.push("/askfred")}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-elevated/60 hover:text-foreground"
          >
            <PlusIcon className="size-4" />
          </button>
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {/* connect promo (dismissible, like the original) */}
        {promoVisible && (
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

        {/* greeting */}
        <div className="flex flex-col items-center gap-1 py-6 text-center">
          <SparklesIcon className="size-5 text-primary-soft" />
          <p className="font-display text-lg font-semibold text-foreground">Hi VISHESH!</p>
          <p className="text-sm text-muted-foreground">Get ready for your meeting</p>
        </div>

        {/* suggestion cards */}
        <div className="space-y-2">
          {CARDS.map(({ label, icon: Icon, tint, to }) => (
            <button
              key={label}
              type="button"
              onClick={() => router.push(to)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-ring/40"
            >
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tint}`}>
                <Icon className="size-4" />
              </span>
              <span className="text-sm font-medium text-foreground">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* prompt — routes to the full chat (Phase 4 wires the live version) */}
      <div className="space-y-1.5 border-t border-border p-3">
        <p className="px-1 text-xs font-medium text-muted-foreground"># My Meetings</p>
        <button
          type="button"
          onClick={() => router.push("/askfred")}
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-elevated/60 px-3 py-2.5 text-left transition-colors hover:border-ring/40"
        >
          <span className="flex items-center gap-1.5 text-subtle">
            <PlusIcon className="size-3.5" />
            <LayoutGridIcon className="size-3.5" />
          </span>
          <span className="flex-1 truncate text-xs text-subtle">
            Ask anything. Type / to run AI skills.
          </span>
          <span className="flex items-center gap-1.5">
            <MicIcon className="size-3.5 text-subtle" />
            <span className="flex size-6 items-center justify-center rounded-full bg-primary">
              <ArrowUpIcon className="size-3 text-primary-foreground" />
            </span>
          </span>
        </button>
      </div>
    </aside>
  );
}
