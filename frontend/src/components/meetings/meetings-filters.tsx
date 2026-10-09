"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownWideNarrowIcon, ListFilterIcon, XIcon } from "lucide-react";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { MeetingListParams, MeetingStatus } from "@/lib/types";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FiltersState = {
  participant: string;
  tag: string;
  status: "" | MeetingStatus;
  minDuration: number;
};

export const EMPTY_FILTERS: FiltersState = {
  participant: "",
  tag: "",
  status: "",
  minDuration: 0,
};

const SORTS: { value: NonNullable<MeetingListParams["sort"]>; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "date", label: "Oldest first" },
  { value: "duration", label: "Longest" },
  { value: "title", label: "Title A–Z" },
];

/** Filters popover + sort select — the Meetings toolbar right cluster. */
export function MeetingsFilters({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
}: {
  filters: FiltersState;
  onFiltersChange: (filters: FiltersState) => void;
  sort: NonNullable<MeetingListParams["sort"]>;
  onSortChange: (sort: NonNullable<MeetingListParams["sort"]>) => void;
}) {
  const { data: tags } = useQuery({ queryKey: qk.tags, queryFn: () => api.listTags() });

  const activeCount = [
    filters.participant,
    filters.tag,
    filters.status,
    filters.minDuration ? String(filters.minDuration) : "",
  ].filter(Boolean).length;

  const set = (patch: Partial<FiltersState>) => onFiltersChange({ ...filters, ...patch });

  return (
    <div className="flex items-center gap-2">
      {/* sort */}
      <Select value={sort} onValueChange={(v) => onSortChange(v as typeof sort)}>
        <SelectTrigger size="sm" className="w-[130px] text-xs">
          <ArrowDownWideNarrowIcon className="size-3.5" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORTS.map((s) => (
            <SelectItem key={s.value} value={s.value} className="text-xs">
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* filters popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <ListFilterIcon className="size-3.5" />
            Filters
            {activeCount > 0 && (
              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {activeCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Participant</Label>
              <Input
                placeholder="e.g. Sarah"
                className="h-8 text-xs"
                value={filters.participant}
                onChange={(e) => set({ participant: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tag</Label>
              <Select value={filters.tag || "all"} onValueChange={(v) => set({ tag: v === "all" ? "" : v })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All tags</SelectItem>
                  {(tags ?? []).map((tag) => (
                    <SelectItem key={tag.name} value={tag.name} className="text-xs">
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={filters.status || "all"} onValueChange={(v) => set({ status: v === "all" ? "" : (v as MeetingStatus) })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Any status</SelectItem>
                  <SelectItem value="ready" className="text-xs">Ready</SelectItem>
                  <SelectItem value="processing" className="text-xs">Processing</SelectItem>
                  <SelectItem value="scheduled" className="text-xs">Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Minimum duration</Label>
              <Select
                value={String(filters.minDuration)}
                onValueChange={(v) => set({ minDuration: Number(v) })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0" className="text-xs">Any length</SelectItem>
                  <SelectItem value="600" className="text-xs">10+ min</SelectItem>
                  <SelectItem value="1800" className="text-xs">30+ min</SelectItem>
                  <SelectItem value="3600" className="text-xs">60+ min</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => onFiltersChange(EMPTY_FILTERS)}
              >
                <XIcon className="size-3" /> Clear all filters
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Search box styled like the real toolbar search. */
export function MeetingsSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <Input
        placeholder="Search by title or keyword"
        className="h-9 pr-9 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}
