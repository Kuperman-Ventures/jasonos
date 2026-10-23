"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type LiveTertiaryKey = "live" | "playbooks" | "guides" | "library" | "metrics";

const LINKS: Array<{ key: LiveTertiaryKey; href: string; label: string }> = [
  { key: "live", href: "/live", label: "Live" },
  { key: "playbooks", href: "/live/playbooks", label: "Playbooks" },
  { key: "guides", href: "/live/guides", label: "Guides" },
  { key: "library", href: "/live/library", label: "Library" },
  { key: "metrics", href: "/live/metrics", label: "Metrics" },
];

function activeKey(pathname: string): LiveTertiaryKey {
  if (pathname === "/live" || pathname === "/live/") return "live";
  if (pathname.startsWith("/live/playbooks")) return "playbooks";
  if (pathname.startsWith("/live/guides")) return "guides";
  if (pathname.startsWith("/live/library")) return "library";
  if (pathname.startsWith("/live/metrics")) return "metrics";
  if (pathname.startsWith("/live/scripts/")) {
    return "live";
  }
  if (pathname.startsWith("/live/")) return "live";
  return "live";
}

export function LiveTertiaryNav({
  active,
  className,
}: {
  /** Override active tab (e.g. playbook vs guide on /live/scripts/[id]). */
  active?: LiveTertiaryKey | null;
  className?: string;
}) {
  const pathname = usePathname() ?? "";
  const current = active ?? activeKey(pathname);

  return (
    <nav
      aria-label="Live"
      className={cn(
        "flex flex-wrap items-center gap-1 border-b border-[var(--jos-line)] bg-[var(--jos-bg)] px-4 py-2 min-[900px]:px-10",
        className
      )}
    >
      <div
        role="tablist"
        aria-label="Live sections"
        className="inline-flex flex-wrap rounded-[2px] border border-[var(--jos-ink)] p-0.5"
      >
        {LINKS.map((link) => {
          const isActive = current === link.key;
          return (
            <Link
              key={link.key}
              href={link.href}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "min-w-[4.25rem] px-3 py-1.5 text-center text-[12px] font-bold uppercase tracking-[0.08em] transition-colors",
                isActive
                  ? "bg-[var(--jos-ink)] text-[var(--jos-bg)]"
                  : "text-[var(--jos-muted)] hover:text-[var(--jos-ink)]"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
