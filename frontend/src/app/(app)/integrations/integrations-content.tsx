"use client";

import { toast } from "sonner";
import { ExternalLinkIcon } from "lucide-react";

/**
 * Integrations — replicates the real app's integration grid (docs/01 §5.7):
 * Zoom, Google Meet, Slack, HubSpot, Notion, Asana, Trello, Jira, Zapier,
 * Google Drive, Dropbox and more, each with a Connect button. The
 * assignment marks integrations as a mocked/placeholder section.
 */

const INTEGRATIONS: {
  name: string;
  category: string;
  description: string;
  color: string;
  initial: string;
}[] = [
  { name: "Zoom", category: "Video conferencing", description: "Record and transcribe Zoom meetings.", color: "#2D8CFF", initial: "Z" },
  { name: "Google Meet", category: "Video conferencing", description: "Join and capture Google Meet calls.", color: "#00832D", initial: "G" },
  { name: "Microsoft Teams", category: "Video conferencing", description: "Capture Teams meetings automatically.", color: "#6264A7", initial: "T" },
  { name: "Slack", category: "Collaboration", description: "Send meeting notes to Slack channels.", color: "#4A154B", initial: "S" },
  { name: "HubSpot", category: "CRM", description: "Auto-fill your CRM with meeting notes.", color: "#FF7A59", initial: "H" },
  { name: "Salesforce", category: "CRM", description: "Sync call insights to Salesforce.", color: "#00A1E0", initial: "S" },
  { name: "Notion", category: "Knowledge", description: "Push summaries to Notion databases.", color: "#000000", initial: "N" },
  { name: "Asana", category: "Project management", description: "Create tasks from action items.", color: "#F06A6A", initial: "A" },
  { name: "Trello", category: "Project management", description: "Turn action items into Trello cards.", color: "#0079BF", initial: "T" },
  { name: "Jira", category: "Project management", description: "File issues from meeting discussions.", color: "#0052CC", initial: "J" },
  { name: "Google Drive", category: "Storage", description: "Save recordings and transcripts.", color: "#34A853", initial: "G" },
  { name: "Dropbox", category: "Storage", description: "Back up meeting assets to Dropbox.", color: "#0061FF", initial: "D" },
  { name: "Zapier", category: "Automation", description: "Connect Fireflies to 6,000+ apps.", color: "#FF4A00", initial: "Z" },
  { name: "Google Calendar", category: "Calendar", description: "Auto-join meetings from your calendar.", color: "#1A73E8", initial: "C" },
  { name: "Salesloft", category: "Sales", description: "Log calls and coaching insights.", color: "#00A1E0", initial: "S" },
  { name: "Webhooks", category: "Developer", description: "Trigger workflows from meeting events.", color: "#7C5CFF", initial: "W" },
];

/**
 * Integrations — the real app's grid of integration cards with Connect
 * buttons (all "Coming Soon" per the assignment's mocked scope).
 */
export default function IntegrationsContent() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect Fireflies to the tools your team already uses — 100+ integrations.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((app) => (
          <div
            key={app.name}
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-ring/40"
          >
            <div className="flex items-center gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: app.color }}
              >
                {app.initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{app.name}</p>
                <p className="text-[11px] text-subtle">{app.category}</p>
              </div>
            </div>
            <p className="flex-1 text-xs leading-relaxed text-muted-foreground">{app.description}</p>
            <button
              type="button"
              onClick={() => toast.info(`${app.name} — coming soon`)}
              className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-elevated/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-ring/40"
            >
              <ExternalLinkIcon className="size-3" />
              Connect
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
