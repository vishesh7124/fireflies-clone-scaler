"use client";

import { MailIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

/** The compact Slack/Gmail context banner shown in the original AskFred panels. */
export function ConnectContextBanner({ onDismiss }: { onDismiss: () => void }) {
  return <div className="flex items-center gap-3 rounded-md bg-primary/10 px-4 py-4">
    <span className="relative flex w-16 shrink-0 items-center">
      <span className="flex size-9 -rotate-12 items-center justify-center rounded-md bg-white">
        <span className="grid grid-cols-2 gap-0.5" aria-hidden><span className="h-2.5 w-1.5 rounded bg-[#36c5f0]" /><span className="h-2.5 w-1.5 rounded bg-[#2eb67d]" /><span className="h-1.5 w-2.5 rounded bg-[#e01e5a]" /><span className="h-1.5 w-2.5 rounded bg-[#ecb22e]" /></span>
      </span>
      <span className="-ml-2 flex size-9 rotate-12 items-center justify-center rounded-md bg-white text-destructive"><MailIcon className="size-5" /></span>
    </span>
    <p className="flex-1 text-sm leading-5 text-muted-foreground"><span className="font-medium text-foreground">Connect Slack and Gmail</span> — get answers with full context.</p>
    <button type="button" onClick={() => toast.info("Slack & Gmail — coming soon")} className="text-sm font-medium text-primary-soft hover:underline">Connect</button>
    <button type="button" aria-label="Dismiss context banner" onClick={onDismiss} className="text-subtle hover:text-foreground"><XIcon className="size-3.5" /></button>
  </div>;
}
