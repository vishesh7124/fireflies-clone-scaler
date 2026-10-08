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
  { label: "Try Email Assistant", href: "/integrations", icon: MailIcon },
  { label: "Integrations", href: "/integrations", icon: PuzzleIcon },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
];

/**
 * Workspace switcher avatar — mosaic block in the purple family
 * (the real app's workspace chip, toned to match its monochrome look).
 */
function WorkspaceAvatar() {
  return (
    <span className="grid size-6 shrink-0 grid-cols-2 gap-[2px] rounded-md" aria-hidden="true">
      <span className="rounded-[2px] bg-[#9d8bff]" />
      <span className="rounded-[2px] bg-[#7c5cff]" />
      <span className="rounded-[2px] bg-[#5b3ee6]" />
      <span className="rounded-[2px] bg-[#b197fc]" />
    </span>
  );
}

/** Active = plum pill + purple text; inactive = muted (like the real sidebar). */
const navLinkClass = (active: boolean) =>
  cn(
    "flex items-center gap-3 rounded-lg whitespace-nowrap px-3 py-2.5 text-[15px] font-medium transition-colors",
    active
      ? "bg-accent text-primary"
      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
  );

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link href={href} className={navLinkClass(active)}>
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* workspace switcher */}
      <button
        type="button"
        onClick={() => toast.info("Workspace switcher — coming soon")}
        className="flex items-center gap-2.5 px-5 pb-2 pt-5 text-left"
      >
        <WorkspaceAvatar />
        <span className="text-[15px] font-semibold tracking-wide text-foreground">VISHESH</span>
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </button>

      <nav className="mt-3 flex-1 space-y-1 px-3">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.label} {...item} />
        ))}

        {/* Upgrade — green text badge only (no filled pill, like the original) */}
        <button
          type="button"
          onClick={() => toast.info("Upgrade — coming soon")}
          className={cn(navLinkClass(false), "w-full")}
        >
          <CrownIcon className="size-4" />
          Upgrade
          <span className="ml-auto text-[11px] font-semibold text-success">40% OFF</span>
        </button>
      </nav>

      <div className="space-y-1 px-3 pb-5">
        {BOTTOM_NAV.map((item) => (
          <NavLink key={item.label} {...item} />
        ))}
      </div>
    </aside>
  );
}
