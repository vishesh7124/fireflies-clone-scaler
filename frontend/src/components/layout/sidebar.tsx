"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumnIcon,
  ChevronDownIcon,
  CrownIcon,
  HouseIcon,
  ListChecksIcon,
  MailIcon,
  MicIcon,
  PuzzleIcon,
  SettingsIcon,
  SparklesIcon,
  VideoIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

/** Nav items + layout replicate the real app shell (docs/01 §4). */
const MAIN_NAV: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Home", href: "/", icon: HouseIcon },
  { label: "AskFred", href: "/askfred", icon: SparklesIcon },
  { label: "Meetings", href: "/meetings", icon: VideoIcon },
  { label: "Tasks", href: "/tasks", icon: ListChecksIcon },
  { label: "AI Skills", href: "/ai-skills", icon: ZapIcon },
  { label: "Analytics", href: "/analytics", icon: ChartColumnIcon },
  { label: "Voice Agents", href: "/voice-agents", icon: MicIcon },
];

const BOTTOM_NAV: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Integrations", href: "/integrations", icon: PuzzleIcon },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
];

/**
 * Active state = subtle neutral pill, white icon+text (like the original —
 * purple is reserved for the highlighted promo items, not nav).
 */
const navLinkClass = (active: boolean) =>
  cn(
    "flex items-center gap-3 rounded-md whitespace-nowrap px-3 py-2.5 text-[15px] font-medium transition-colors",
    active
      ? "bg-accent text-foreground"
      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
  );

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link href={href} className={navLinkClass(active)}>
      <Icon className="size-4 text-foreground" />
      {label}
    </Link>
  );
}

/**
 * Collapsed icon strip — the real app shows this thin rail on the Meetings
 * page (icon-only nav: home, bot, video, list, sparkles, chart, voice, crown).
 */
function RailIcon({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-lg transition-colors",
        active ? "bg-elevated text-primary" : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4.5" />
    </Link>
  );
}

export function Sidebar({ variant = "full" }: { variant?: "full" | "rail" }) {
  const pathname = usePathname();

  if (variant === "rail") {
    return (
      <aside className="flex h-full w-14 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-3">
        {MAIN_NAV.map((item) => (
          <RailIcon key={item.label} {...item} />
        ))}
        <button
          type="button"
          title="Upgrade"
          aria-label="Upgrade"
          onClick={() => toast.info("Upgrade — coming soon")}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-elevated/60 hover:text-foreground"
        >
          <CrownIcon className="size-4.5" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* workspace switcher — initials avatar (the original shows a user photo) */}
      <button
        type="button"
        onClick={() => toast.info("Workspace switcher — coming soon")}
        className="flex items-center gap-2.5 px-5 pb-2 pt-5 text-left"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-elevated text-[11px] font-bold text-foreground">
          V
        </span>
        <span className="text-[15px] font-semibold tracking-wide text-foreground">VISHESH</span>
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </button>

      <nav className="mt-3 flex-1 space-y-0.5 px-3">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.label} {...item} />
        ))}

        {/* Upgrade — muted green pill badge (like the original) */}
        <button
          type="button"
          onClick={() => toast.info("Upgrade — coming soon")}
          className={cn(navLinkClass(false), "w-full")}
        >
          <CrownIcon className="size-4 text-foreground" />
          Upgrade
          <span className="ml-auto rounded-[4px] bg-[#0f2a1c] px-1.5 py-0.5 text-[11px] font-semibold text-success">
            40% OFF
          </span>
        </button>

        {/* faint separator between nav groups (original has one) */}
        <div className="mx-3 my-2 h-px bg-border" />

        {/* highlighted promo item — deep-purple pill in the original */}
        <Link
          href="/integrations"
          className="flex items-center gap-3 rounded-md bg-primary/15 px-3 py-2.5 text-[15px] font-medium text-primary-soft transition-colors hover:bg-primary/25"
        >
          <MailIcon className="size-4" />
          Try Email Assistant
        </Link>

        {BOTTOM_NAV.map((item) => (
          <NavLink key={item.label} {...item} />
        ))}
      </nav>

      {/* invite card — bottom of sidebar, like the original's cycling promo */}
      <div className="mx-3 mb-4 rounded-xl border border-border bg-elevated p-3.5">
        <p className="text-[13px] font-medium leading-snug text-foreground">
          Invite coworkers to your Fireflies team
        </p>
        <div className="mt-2.5 flex items-center justify-between">
          <Button size="sm" onClick={() => toast.info("Create team — coming soon")}>
            Create Team
          </Button>
          <span className="flex gap-1.5">
            <span className="size-1.5 rounded-full bg-primary" />
            <span className="size-1.5 rounded-full bg-muted" />
          </span>
        </div>
      </div>
    </aside>
  );
}
