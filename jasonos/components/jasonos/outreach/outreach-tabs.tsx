"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Inbox, Users, Building2, UserPlus, LayoutDashboard } from "lucide-react";
import { SyncNowButton } from "@/components/jasonos/outreach/sync-now-button";
import type { OutreachSyncSnapshot } from "@/lib/outreach/data";

// The Schedule tab was retired once its buckets moved into the Queue page;
// the /outreach/schedule route still exists for direct links.
const TABS = [
  { href: "/outreach/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/outreach/queue", label: "Queue", icon: Inbox },
  { href: "/outreach/people", label: "People", icon: Users },
  { href: "/outreach/suggested", label: "Suggested", icon: UserPlus },
  { href: "/outreach/firms", label: "Firms", icon: Building2 },
] as const;

export function OutreachTabs({
  syncState,
  suggestedCount = 0,
}: {
  syncState: OutreachSyncSnapshot[];
  suggestedCount?: number;
}) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex items-center gap-1 border-b bg-card/40 px-4">
      <div className="flex flex-1 items-center gap-1">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          const Icon = tab.icon;
          const showBadge =
            tab.href === "/outreach/suggested" && suggestedCount > 0;
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
              {showBadge ? (
                <span className="ml-0.5 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-medium leading-none text-background">
                  {suggestedCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-2 py-1.5">
        <SyncNowButton initial={syncState} />
      </div>
    </nav>
  );
}
