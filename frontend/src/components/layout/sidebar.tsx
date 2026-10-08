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

/** Nav items + layout replicated from the real app shell (docs/01 §4). */
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

/** Workspace switcher avatar — 4-square mosaic, like the real workspace chip. */
function WorkspaceAvatar() {
  return (
    <span
      className="grid size-6 shrink-0 grid-cols-2 gap-[2px] rounded-md"
      aria-hidden="true"
    >
      <span className="rounded-[2px] bg-[#ff6fb5]" />
      <span className="rounded-[2px] bg-[#7c5cff]" />
      <span className="rounded-[2px] bg-[#74c0fc]" />
      <span className="rounded-[2px] bg-[#63e6be]" />
    </span>
  );
}

function navLinkClass(active: boolean) {
  return cn(
    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
    active
      ? "bg-elevated text-primary"
      : "text-muted-foreground hover:bg-elevated/50 hover:text-foreground",
  );
}

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
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* workspace switcher */}
      <button
        type="button"
        onClick={() => toast.info("Workspace switcher — coming soon")}
        className="flex items-center gap-2.5 px-4 pb-2 pt-4 text-left"
      >
        <WorkspaceAvatar />
        <span className="text-sm font-semibold tracking-wide text-foreground">VISHESH</span>
        <ChevronDownIcon className="size-3.5 text-subtle" />
      </button>

      <nav className="mt-3 flex-1 space-y-0.5 px-2.5">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.label} {...item} />
        ))}

        {/* Upgrade — green "40% OFF" badge, like the real nav */}
        <button
          type="button"
          onClick={() => toast.info("Upgrade — coming soon")}
          className={cn(navLinkClass(false), "w-full")}
        >
          <CrownIcon className="size-4" />
          Upgrade
          <span className="ml-auto rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
            40% OFF
          </span>
        </button>
      </nav>

      <div className="space-y-0.5 px-2.5 pb-4">
        {BOTTOM_NAV.map((item) => (
          <NavLink key={item.label} {...item} />
        ))}
      </div>
    </aside>
  );
}
