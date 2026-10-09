"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon, FileTextIcon, SearchIcon, VideoIcon } from "lucide-react";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { formatDate, msToClock } from "@/lib/format";
import { useDebounced } from "@/hooks/use-debounced";
import { useUiStore } from "@/store/ui-store";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Command as CommandPrimitive } from "cmdk";
import { SearchSnippet } from "./search-snippet";

/**
 * Global search (⌘K / Ctrl+K) — searches meeting titles AND transcript text
 * in one place, with marked snippets and click-to-jump links.
 */
export function SearchDialog() {
  const router = useRouter();
  const { searchOpen, openSearch, closeSearch } = useUiStore();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 250);

  // global ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openSearch]);

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: qk.search(debounced.trim()),
    queryFn: () => api.search(debounced.trim()),
    enabled: searchOpen && debounced.trim().length > 0,
  });

  const hasResults = data && (data.meetings.length > 0 || data.transcript_matches.length > 0);
  const ready = query.trim() === debounced.trim() && query.trim().length > 0;

  return (
    <Dialog open={searchOpen} onOpenChange={(open) => !open && closeSearch()}>
      <DialogContent className="top-24 max-w-xl translate-y-0 gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Search meetings and transcripts</DialogTitle>
        <CommandPrimitive shouldFilter={false} label="Search results">
        {/* search input */}
        <div className="flex items-center gap-2 border-b border-border px-4">
          <SearchIcon className="size-4 shrink-0 text-subtle" />
          <CommandPrimitive.Input
            autoFocus
            placeholder="Search by title or keyword"
            className="h-12 flex-1 border-0 bg-transparent text-sm outline-none focus-visible:ring-0"
            value={query}
            onValueChange={setQuery}
          />
          {isFetching && <span className="text-xs text-subtle">Searching…</span>}
        </div>

        {/* results */}
        <CommandPrimitive.List className="max-h-[60vh] overflow-y-auto p-2">
          {query.trim().length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-subtle">
              Search across all your meetings and transcripts.
            </p>
          )}
          {isError && ready && <button type="button" onClick={() => refetch()} className="w-full px-3 py-8 text-sm text-destructive">Search failed. Click to retry.</button>}
          {ready && !hasResults && !isFetching && !isError && (
            <p className="px-3 py-8 text-center text-sm text-subtle">
              No results for “{query}”.
            </p>
          )}

          {ready && data && data.meetings.length > 0 && (
            <>
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-subtle">
                Meetings
              </p>
              {data.meetings.map((m) => (
                <CommandPrimitive.Item
                  key={m.id}
                  value={`meeting-${m.id}`}
                  onSelect={() => {
                    closeSearch();
                    router.push(`/meetings/${m.id}`);
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent data-[selected=true]:bg-accent"
                >
                  <VideoIcon className="size-4 shrink-0 text-subtle" />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{m.title}</span>
                  <span className="shrink-0 text-xs text-subtle">
                    {formatDate(m.meeting_date, "MMM d")}
                  </span>
                  <ArrowRightIcon className="size-3.5 shrink-0 text-subtle" />
                </CommandPrimitive.Item>
              ))}
            </>
          )}

          {ready && data && data.transcript_matches.length > 0 && (
            <>
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-subtle">
                Transcript matches
              </p>
              {data.transcript_matches.map((t) => (
                <CommandPrimitive.Item
                  key={t.segment_id}
                  value={`segment-${t.segment_id}`}
                  onSelect={() => {
                    closeSearch();
                    router.push(`/meetings/${t.meeting_id}?t=${t.start_ms / 1000}`);
                  }}
                  className="flex w-full cursor-pointer items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent data-[selected=true]:bg-accent"
                >
                  <FileTextIcon className="mt-0.5 size-4 shrink-0 text-subtle" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-subtle">
                      {t.meeting_title} · {msToClock(t.start_ms)} · {t.speaker}
                    </span>
                    <span className="block text-sm text-foreground"><SearchSnippet text={t.text} /></span>
                  </span>
                </CommandPrimitive.Item>
              ))}
            </>
          )}
        </CommandPrimitive.List>
        </CommandPrimitive>

        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-subtle">
          <span>
            <kbd className="rounded border border-border bg-elevated px-1 py-0.5">↵</kbd> to open
          </span>
          <span>
            <kbd className="rounded border border-border bg-elevated px-1 py-0.5">Esc</kbd> to close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
