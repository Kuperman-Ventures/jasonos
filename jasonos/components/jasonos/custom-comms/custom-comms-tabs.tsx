"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Library, Mail, Megaphone, Radio, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/email-templates", label: "Email", icon: Mail },
  { href: "/network-screen", label: "Network Screen", icon: Users },
  { href: "/resume-customizer", label: "Resume", icon: FileText },
  { href: "/post-master", label: "Post Master", icon: Megaphone },
  { href: "/library", label: "Library", icon: Library },
  { href: "/live", label: "Live", icon: Radio },
] as const;

function tabActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CustomCommsTabs() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex h-12 items-stretch gap-1 overflow-x-auto border-b border-[var(--jos-line)] bg-[var(--jos-bg)] px-4">
      <div className="flex min-w-0 flex-1 items-stretch">
        {TABS.map((tab) => {
          const active = tabActive(pathname, tab.href);
          const Icon = tab.icon;
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
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
