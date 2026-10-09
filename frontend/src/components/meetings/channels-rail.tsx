"use client";

import { useState } from "react";
import { HashIcon, PlusIcon, SearchIcon, UploadIcon, VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

export type ChannelId = "my" | "all" | "voice" | "uploads";

const CHANNELS: { id: ChannelId; label: string; badge?: string }[] = [
  { id: "my", label: "My Meetings" },
  { id: "all", label: "All Meetings" },
  { id: "voice", label: "Voice Agent Meetings" },
  { id: "uploads", label: "Uploads", badge: "NEW" },
];

/**
 * Left channels rail — replicates the real Meetings page rail (docs/01 §5.3):
 * channel search, channel pills, "All channels" section with + Channel.
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
    <aside className="hidden w-56 shrink-0 flex-col border-r border-border md:flex">
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
              "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
              channel.id === active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            {channel.id === "uploads" ? (
              <UploadIcon className="size-3.5" />
            ) : (
              <VideoIcon className="size-3.5" />
            )}
            {channel.label}
            {channel.badge && (
              <span className="ml-auto rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                {channel.badge}
              </span>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="px-2.5 py-2 text-xs text-subtle">No channels match “{query}”.</p>
        )}
      </nav>

      <div className="mt-auto space-y-2 p-3">
        <div className="flex items-center justify-between px-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <HashIcon className="size-3" /> All channels
          </span>
          <button
            type="button"
            onClick={() => toast.info("Custom channels — coming soon")}
            className="flex items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <PlusIcon className="size-3" /> Channel
          </button>
        </div>
        <p className="px-1 text-[11px] leading-relaxed text-subtle">
          Create channels to organize your conversations.
        </p>
      </div>
    </aside>
  );
}
