"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type LiveTertiaryKey = "live" | "before" | "after" | "calendar" | "metrics";

const LINKS: Array<{ key: LiveTertiaryKey; href: string; label: string }> = [
  { key: "live", href: "/live", label: "Live" },
  { key: "before", href: "/live/before", label: "Before" },
  { key: "after", href: "/live/after", label: "After" },
  { key: "calendar", href: "/calendar", label: "Calendar" },
  { key: "metrics", href: "/live/metrics", label: "Metrics" },
];

function activeKey(
  pathname: string,
  meetingMode?: "before" | "after" | null
): LiveTertiaryKey {
  if (meetingMode === "before" || meetingMode === "after") return meetingMode;
  if (pathname === "/live" || pathname === "/live/") return "live";
  if (pathname.startsWith("/live/before")) return "before";
  if (pathname.startsWith("/live/after") || pathname.startsWith("/live/library")) return "after";
  if (pathname.startsWith("/live/metrics")) return "metrics";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/live/scripts") || pathname.startsWith("/live/")) return "live";
  return "live";
}

export function LiveTertiaryNav({
  meetingMode,
  meetingId,
  onMeetingMode,
  className,
}: {
  /** When on a meeting prep page, Before/After switch this meeting's mode. */
  meetingMode?: "before" | "after" | null;
  meetingId?: string | null;
  onMeetingMode?: (mode: "before" | "after") => void;
  className?: string;
}) {
  const pathname = usePathname() ?? "";
  const active = activeKey(pathname, meetingMode ?? null);
  const onMeeting = Boolean(meetingId && onMeetingMode);

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
          const isActive = active === link.key;
          const useModeToggle =
            onMeeting && (link.key === "before" || link.key === "after");

          if (useModeToggle) {
            return (
              <button
                key={link.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={cn(
                  "min-w-[4.25rem] px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] transition-colors",
                  isActive
                    ? "bg-[var(--jos-ink)] text-[var(--jos-bg)]"
                    : "text-[var(--jos-muted)] hover:text-[var(--jos-ink)]"
                )}
                onClick={() => onMeetingMode?.(link.key as "before" | "after")}
              >
                {link.label}
              </button>
            );
          }

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
