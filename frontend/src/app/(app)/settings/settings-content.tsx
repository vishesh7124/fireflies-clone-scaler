"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LogOutIcon,
  RefreshCwIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { signOut } from "@/lib/auth";
import type { Settings, SummaryTemplate } from "@/lib/types";
import { resetDb } from "@/mock/store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

const TEMPLATES: { value: SummaryTemplate; label: string }[] = [
  { value: "general", label: "General Summary" },
  { value: "sales", label: "Sales Summary" },
  { value: "one_on_one", label: "1:1 Meeting Notes" },
  { value: "bant", label: "BANT Summary" },
];

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Settings — the real app's persisted settings (docs/01 §5.7): profile,
 * summary template, playback, meeting behavior, and the danger zone.
 */
export default function SettingsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: me } = useQuery({ queryKey: qk.me, queryFn: () => api.getMe() });
  const { data: settings, isPending } = useQuery({
    queryKey: qk.settings,
    queryFn: () => api.getSettings(),
  });

  const updateMutation = useMutation({
    mutationFn: (patch: Partial<Settings>) => api.updateSettings(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.settings });
      toast.success("Settings saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleReseed = () => {
    resetDb();
    queryClient.invalidateQueries();
    toast.success("Demo data reseeded");
    router.push("/");
  };

  if (isPending || !settings) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 p-8">
      <h1 className="font-display text-2xl font-semibold text-foreground">Settings</h1>

      {/* profile */}
      <Section title="Profile">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
            {me?.name?.[0] ?? "V"}
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{me?.name ?? "Vishesh Gupta"}</p>
            <p className="text-xs text-subtle">{me?.email ?? ""}</p>
          </div>
        </div>
      </Section>

      {/* AI summary */}
      <Section title="AI summary">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-sm">Default summary template</Label>
            <p className="text-xs text-subtle">
              Applied to new meetings — switch per-meeting from the Notepad.
            </p>
          </div>
          <Select
            value={settings.default_summary_template}
            onValueChange={(v) =>
              updateMutation.mutate({ default_summary_template: v as SummaryTemplate })
            }
          >
            <SelectTrigger className="w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-sm">Auto-join meetings</Label>
            <p className="text-xs text-subtle">
              The notetaker joins automatically based on your settings.
            </p>
          </div>
          <Switch
            checked={settings.auto_join_meetings}
            onCheckedChange={(v) => updateMutation.mutate({ auto_join_meetings: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-sm">Send meeting recaps to</Label>
            <p className="text-xs text-subtle">Who receives the email recap after each meeting.</p>
          </div>
          <Select
            value={settings.send_recaps_to}
            onValueChange={(v) => updateMutation.mutate({ send_recaps_to: v })}
          >
            <SelectTrigger className="w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="everyone" className="text-xs">Everyone on the invite</SelectItem>
              <SelectItem value="me" className="text-xs">Just me</SelectItem>
              <SelectItem value="host" className="text-xs">Host only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>

      {/* playback */}
      <Section title="Playback">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-sm">Default playback speed</Label>
            <p className="text-xs text-subtle">Applied when a meeting opens.</p>
          </div>
          <Select
            value={String(settings.default_playback_speed)}
            onValueChange={(v) => updateMutation.mutate({ default_playback_speed: Number(v) })}
          >
            <SelectTrigger className="w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPEEDS.map((s) => (
                <SelectItem key={s} value={String(s)} className="text-xs">
                  {s}×
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Section>

      {/* integrations / team — placeholders */}
      <Section title="Integrations & team">
        <p className="text-xs text-muted-foreground">
          Zoom, Google Meet, Slack, HubSpot, Notion and 100+ more — coming soon.
        </p>
        <Button variant="outline" size="sm" className="mt-1" onClick={() => router.push("/integrations")}>
          <SparklesIcon className="size-3.5" />
          Browse integrations
        </Button>
      </Section>

      {/* danger zone */}
      <Section title="Danger zone">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReseed}>
            <RefreshCwIcon className="size-3.5" />
            Reseed demo data
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              signOut();
              toast.info("Signed out");
              router.replace("/login");
            }}
          >
            <LogOutIcon className="size-3.5" />
            Sign out
          </Button>
          <Button variant="ghost" size="sm" disabled className="text-subtle">
            <Trash2Icon className="size-3.5" />
            Delete workspace — coming soon
          </Button>
        </div>
      </Section>
    </div>
  );
}
