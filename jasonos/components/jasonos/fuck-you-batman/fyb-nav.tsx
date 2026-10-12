"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/projects/fuck-you-batman", label: "Overview", exact: true },
  { href: "/projects/fuck-you-batman/decisions", label: "Decisions", exact: false },
  { href: "/projects/fuck-you-batman/reference", label: "Reference", exact: false },
] as const;

export function FybNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex flex-wrap gap-4">
      {LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "text-[10px] font-semibold uppercase tracking-widest",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
