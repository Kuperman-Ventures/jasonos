"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DispatchInbox } from "@/components/dispatch/DispatchInbox";
import { ContactCreateModal } from "@/components/jasonos/outreach/contact-create-modal";
import { Logo } from "@/components/jasonos/logo";
import { ChevronDown, Command, Plus, Sparkles } from "lucide-react";

// ─── Nav structure ─────────────────────────────────────────────────────────

type NavItem =
  | { kind: "link"; href: string; label: string }
  | { kind: "group"; label: string; children: { href: string; label: string }[] };

const NAV: NavItem[] = [
  { kind: "link",  href: "/",         label: "Home" },
  {
    kind: "group",
    label: "CoSA",
    children: [
      { href: "/today",          label: "Today" },
      { href: "/tasks",          label: "Task Library" },
      { href: "/calendar",       label: "Calendar" },
      { href: "/weekly-review",  label: "Weekly Review" },
      { href: "/nyui",           label: "NYUI" },
    ],
  },
  {
    kind: "group",
    label: "Custom Communications",
    children: [
      { href: "/resume-customizer", label: "Resume & Cover Letter" },
      { href: "/email-templates", label: "Email Templates" },
    ],
  },
  {
    kind: "group",
    label: "Outreach",
    children: [
      { href: "/outreach/dashboard", label: "Dashboard" },
      { href: "/outreach/queue",     label: "Queue" },
      { href: "/outreach/people",    label: "People" },
      { href: "/outreach/suggested", label: "Suggested" },
      { href: "/outreach/firms",     label: "Firms" },
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
  { kind: "link",  href: "/scoreboard", label: "Scoreboard" },
  {
    kind: "group",
    label: "Project Management",
    children: [
      { href: "/projects", label: "Projects" },
      { href: "/todos",    label: "To-Dos" },
    ],
  },
  { kind: "link",  href: "/ai-usage", label: "AI Usage" },
  { kind: "link",  href: "/settings", label: "Settings" },
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
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
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
          "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm transition-colors outline-none",
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

// ─── TopNav ───────────────────────────────────────────────────────────────

export function TopNav() {
  const pathname = usePathname();
  const [addContactOpen, setAddContactOpen] = useState(false);

  useEffect(() => {
    const open = () => setAddContactOpen(true);
    window.addEventListener("jasonos:open-add-contact", open as EventListener);
    return () => window.removeEventListener("jasonos:open-add-contact", open as EventListener);
  }, []);

  function isActive(item: NavItem): boolean {
    if (item.kind === "link") {
      return item.href === "/" ? pathname === "/" : !!pathname?.startsWith(item.href);
    }
    return item.children.some((c) => pathname?.startsWith(c.href));
  }

  return (
    <header className="app-top-nav sticky top-0 z-40 glass hairline border-b print:hidden">
      <div className="mx-auto flex h-12 max-w-[1800px] items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo size={24} priority />
          <span className="text-sm">JasonOS</span>
          <span className="ml-2 hidden rounded-sm bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
            v0.1
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) =>
            item.kind === "link" ? (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={isActive(item)}
              />
            ) : (
              <NavGroup
                key={item.label}
                label={item.label}
                items={item.children}
                active={isActive(item)}
              />
            )
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <DispatchInbox />
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setAddContactOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add contact
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("jasonos:open-tell-claude"))
            }
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            Tell Claude
            <kbd className="ml-2 inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              <Command className="h-3 w-3" /> K
            </kbd>
          </Button>
        </div>
      </div>
      <ContactCreateModal
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
      />
    </header>
  );
}
