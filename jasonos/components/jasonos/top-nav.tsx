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

// ─── Nav structure ─────────────────────────────────────────────────────────
// Clusters (with hairline dividers between them):
//   Daily → Networking → Tools → System

type NavLinkItem = { kind: "link"; href: string; label: string };
type NavGroupItem = {
  kind: "group";
  label: string;
  children: { href: string; label: string }[];
};
type NavDivider = { kind: "divider" };
type NavItem = NavLinkItem | NavGroupItem | NavDivider;

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
  { kind: "link", href: "/job-alerts", label: "Job Alerts" },

  { kind: "divider" },

  {
    kind: "group",
    label: "Outreach",
    children: [
      { href: "/outreach/dashboard", label: "Dashboard" },
      { href: "/outreach/queue", label: "Queue" },
      { href: "/outreach/people", label: "People" },
      { href: "/outreach/network-map", label: "Network Map" },
      { href: "/outreach/suggested", label: "Suggested" },
      { href: "/outreach/firms", label: "Firms" },
    ],
  },
  {
    kind: "group",
    label: "Browning",
    children: [
      { href: "/browning", label: "Browning" },
      { href: "/activity", label: "Weekly Report" },
    ],
  },
  { kind: "link", href: "/scoreboard", label: "Scoreboard" },

  { kind: "divider" },

  {
    kind: "group",
    label: "Custom Comms",
    children: [
      { href: "/resume-customizer", label: "Resume & Cover Letter" },
      { href: "/email-templates", label: "Email" },
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
    ],
  },

  { kind: "divider" },

  {
    kind: "group",
    label: "Settings",
    children: [
      { href: "/settings", label: "General" },
      { href: "/ai-usage", label: "AI Usage" },
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
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
          "inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors outline-none",
          active
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        )}
      >
        {label}
        <ChevronDown className="h-3 w-3 opacity-60" />
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

function NavDivider() {
  return (
    <span
      aria-hidden
      className="mx-1.5 h-4 w-px shrink-0 bg-border/70"
    />
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
    <header className="app-top-nav sticky top-0 z-40 glass hairline border-b print:hidden">
      <div className="mx-auto flex h-12 max-w-[1800px] items-center gap-5 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
        >
          <Logo size={24} priority />
          <span className="text-sm">JasonOS</span>
        </Link>

        <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
          {NAV.map((item, i) => {
            if (item.kind === "divider") {
              return <NavDivider key={`divider-${i}`} />;
            }
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
      </div>
    </header>
  );
}
