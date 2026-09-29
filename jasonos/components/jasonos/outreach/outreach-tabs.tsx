"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Inbox,
  Users,
  Building2,
  UserPlus,
  LayoutDashboard,
  Mail,
  Share2,
  Handshake,
} from "lucide-react";

// The Schedule tab was retired once its buckets moved into the Queue page;
// the /outreach/schedule route still exists for direct links.
const TABS = [
  { href: "/outreach/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/outreach/queue", label: "Queue", icon: Inbox },
  { href: "/outreach/people", label: "People", icon: Users },
  { href: "/outreach/network-map", label: "Network Map", icon: Share2 },
  { href: "/outreach/suggested", label: "Suggested", icon: UserPlus },
  { href: "/outreach/sent", label: "Follow Up", icon: Mail },
  { href: "/outreach/firms", label: "Firms", icon: Building2 },
  { href: "/outreach/browning-networking", label: "Browning Networking", icon: Handshake },
] as const;

export function OutreachTabs({
  suggestedCount = 0,
  sentCount = 0,
  gmailPersonalConnected = true,
}: {
  suggestedCount?: number;
  sentCount?: number;
  gmailPersonalConnected?: boolean;
}) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex h-12 items-stretch gap-1 overflow-x-auto border-b border-[var(--jos-line)] bg-[var(--jos-bg)] px-4">
      <div className="flex min-w-0 flex-1 items-stretch">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          const Icon = tab.icon;
          const badgeCount =
            tab.href === "/outreach/suggested"
              ? suggestedCount
              : tab.href === "/outreach/sent"
                ? sentCount
                : 0;
          const showBadge = badgeCount > 0;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex items-center gap-1.5 border-b-[3px] px-3 text-[15px] font-medium text-[var(--jos-ink)] transition-colors",
                active
                  ? "border-[var(--jos-focus)] font-semibold"
                  : "border-transparent hover:bg-[color-mix(in_srgb,var(--jos-surface)_50%,transparent)]"
              )}
            >
              <Icon className="h-5 w-5" />
              {tab.label}
              {showBadge ? (
                <span className="ml-0.5 rounded-full bg-[var(--jos-ink)] px-1.5 py-0.5 text-[12px] font-semibold leading-none text-[var(--jos-bg)] tabular-nums">
                  {badgeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
      {!gmailPersonalConnected ? (
        <div className="flex items-center gap-2">
          <a
            href="/api/auth/google?account=gmail"
            className="hidden rounded-[2px] bg-[var(--jos-warn-tint)] px-2.5 py-1 text-[13px] font-medium text-[var(--jos-ink)] sm:inline-flex"
          >
            Connect personal Gmail
          </a>
        </div>
      ) : null}
    </nav>
  );
}
