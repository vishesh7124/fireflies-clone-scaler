"use client";

import { useState } from "react";
import { HashIcon, PlusIcon, SearchIcon, UploadIcon, Building2Icon, BotIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

export type ChannelId = "my" | "all" | "voice" | "uploads";

const CHANNELS: { id: ChannelId; label: string; prefix?: string; badge?: string }[] = [
  { id: "my", label: "My Meetings", prefix: "#" },
  { id: "all", label: "All Meetings", prefix: "#" },
  { id: "voice", label: "Voice Agent Meetings" },
  { id: "uploads", label: "Uploads", badge: "NEW" },
];

/**
 * Left channels rail — replicates the real Meetings page rail: channel search,
 * plain channel pills ("# My Meetings" highlighted purple when selected),
 * "All channels" section with + Channel. No icons on channel items.
 */
export function ChannelsRail({
  active,
  onSelect,
}: {
  active: ChannelId;
  onSelect: (id: ChannelId) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = CHANNELS.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <aside className="hidden w-[250px] shrink-0 flex-col border-r border-border md:flex">
      <div className="relative p-3">
        <SearchIcon className="pointer-events-none absolute left-5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
        <Input
          placeholder="Search channels"
          className="pl-8 text-xs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <nav className="space-y-0.5 px-3">
        {filtered.map((channel) => (
          <button
            key={channel.id}
            type="button"
            onClick={() => onSelect(channel.id)}
            className={cn(
               "flex h-11 w-full items-center gap-3 rounded px-3 text-sm font-medium transition-colors",
              channel.id === active
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            {channel.id === "my" ? <HashIcon className="size-4" /> : channel.id === "all" ? <Building2Icon className="size-4" /> : channel.id === "voice" ? <BotIcon className="size-4" /> : <UploadIcon className="size-4" />}
            <span className="truncate">{channel.label}</span>
            {channel.badge && (
               <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                {channel.badge}
              </span>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="px-2.5 py-2 text-xs text-subtle">No channels match “{query}”.</p>
        )}
      </nav>

      <div className="mt-4 space-y-4 border-t border-border px-5 py-5">
        <div className="flex items-center justify-between px-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <HashIcon className="size-3 opacity-50" /> All channels
          </span>
        </div>
        <div className="flex flex-col items-center gap-3 pt-1 text-center">
          <HashIcon className="size-6 text-primary-soft" />
          <p className="text-sm leading-5 text-muted-foreground">Create channels to organize your conversations</p>
          <button
            type="button"
            onClick={() => toast.info("Custom channels — coming soon")}
            className="flex items-center gap-1.5 rounded border border-border bg-surface px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <PlusIcon className="size-3" /> Channel
          </button>
        </div>
      </div>
    </aside>
  );
}
