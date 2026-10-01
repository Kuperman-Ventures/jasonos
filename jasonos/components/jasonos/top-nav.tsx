"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/jasonos/logo";
import { ChevronDown } from "lucide-react";
import { SyncNowButton } from "@/components/jasonos/outreach/sync-now-button";

// ─── Nav structure ─────────────────────────────────────────────────────────
// Clusters (with hairline dividers between them):
//   Daily → Networking / Job Search → Tools → System

type NavLinkItem = { kind: "link"; href: string; label: string };
type NavGroupItem = {
  kind: "group";
  label: string;
  children: { href: string; label: string }[];
};
type NavItem = NavLinkItem | NavGroupItem;

const NAV: NavItem[] = [
  { kind: "link", href: "/", label: "Home" },
  {
    kind: "group",
    label: "CoSA",
    children: [
      { href: "/today", label: "Today" },
      { href: "/tasks", label: "Task Library" },
      { href: "/calendar", label: "Calendar" },
      { href: "/weekly-review", label: "Weekly Review" },
      { href: "/nyui", label: "NYUI" },
    ],
  },
  {
    kind: "group",
    label: "Networking",
    children: [
      { href: "/outreach/dashboard", label: "Dashboard" },
      { href: "/outreach/queue", label: "Queue" },
      { href: "/outreach/people", label: "People" },
      { href: "/outreach/network-map", label: "Network Map" },
      { href: "/outreach/suggested", label: "Suggested" },
      { href: "/outreach/sent", label: "Follow Up" },
      { href: "/outreach/firms", label: "Firms" },
      { href: "/outreach/browning-networking", label: "Browning Networking" },
    ],
  },
  {
    kind: "group",
    label: "Job Search",
    children: [
      { href: "/scoreboard", label: "Scoreboard" },
      { href: "/job-alerts", label: "Job Alerts" },
      { href: "/interview-prep", label: "Interview Prep" },
      { href: "/browning", label: "Browning" },
      { href: "/activity", label: "Weekly Report" },
    ],
  },

  {
    kind: "group",
    label: "Custom Comms",
    children: [
      { href: "/resume-customizer", label: "Resume & Cover Letter" },
      { href: "/email-templates", label: "Email" },
      { href: "/post-master", label: "Post Master" },
    ],
  },
  {
    kind: "group",
    label: "Projects",
    children: [
      { href: "/projects", label: "Projects" },
      { href: "/todos", label: "To-Dos" },
      {
        href: "/projects/professor-roadmap",
        label: "Professor Roadmap",
      },
      {
        href: "/projects/trailbound-at",
        label: "Trailbound AT",
      },
      {
        href: "/iugr",
        label: "IUGR",
      },
    ],
  },

  {
    kind: "group",
    label: "Settings",
    children: [
      { href: "/settings", label: "General" },
      { href: "/ai-usage", label: "AI Usage" },
      { href: "/settings/sync-log", label: "Sync Log" },
    ],
  },
];

// ─── NavLink ──────────────────────────────────────────────────────────────

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-[2px] px-3 text-[16px] font-medium text-[var(--jos-ink)] transition-colors",
        active
          ? "bg-[var(--jos-surface)] font-semibold"
          : "hover:bg-[var(--jos-surface)]"
      )}
    >
      {label}
    </Link>
  );
}

// ─── NavGroup (dropdown) ──────────────────────────────────────────────────

function NavGroup({
  label,
  items,
  active,
}: {
  label: string;
  items: { href: string; label: string }[];
  active: boolean;
}) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-10 items-center gap-1 rounded-[2px] px-3 text-[16px] font-medium text-[var(--jos-ink)] transition-colors",
          active
            ? "bg-[var(--jos-surface)] font-semibold"
            : "hover:bg-[var(--jos-surface)]"
        )}
      >
        {label}
        <ChevronDown className="h-5 w-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.href}
            className="cursor-pointer"
            onClick={() => router.push(item.href)}
          >
            <span className="flex-1">{item.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── TopNav ───────────────────────────────────────────────────────────────

export function TopNav() {
  const pathname = usePathname();

  function isActive(item: NavLinkItem | NavGroupItem): boolean {
    if (item.kind === "link") {
      return item.href === "/"
        ? pathname === "/"
        : !!pathname?.startsWith(item.href);
    }
    return item.children.some((c) => pathname?.startsWith(c.href));
  }

  return (
    <header className="app-top-nav sticky top-0 z-40 border-b border-[var(--jos-ink)] bg-[var(--jos-bg)] print:hidden">
      <div className="flex h-14 items-center gap-5 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-[16px] font-semibold tracking-tight text-[var(--jos-ink)]"
        >
          <Logo size={24} priority />
          <span>JasonOS</span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {NAV.map((item) => {
            if (item.kind === "link") {
              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={isActive(item)}
                />
              );
            }
            return (
              <NavGroup
                key={item.label}
                label={item.label}
                items={item.children}
                active={isActive(item)}
              />
            );
          })}
        </nav>
        <div className="shrink-0">
          <SyncNowButton />
        </div>
      </div>
    </header>
  );
}
