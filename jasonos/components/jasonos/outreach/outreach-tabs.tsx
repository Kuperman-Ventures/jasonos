"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Inbox, CalendarDays, Users, Building2 } from "lucide-react";

const TABS = [
  { href: "/outreach/queue", label: "Queue", icon: Inbox },
  { href: "/outreach/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/outreach/people", label: "People", icon: Users },
  { href: "/outreach/firms", label: "Firms", icon: Building2 },
] as const;

export function OutreachTabs() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex items-center gap-1 border-b bg-card/40 px-4">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
