import { cn } from "@/lib/utils";

const PILL = "inline-flex shrink-0 items-center rounded-[2px] px-1.5 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.08em]";

/** Magenta: a referral nobody has contacted 48 hours after it came in. */
export function Past48hPill({ className }: { className?: string }) {
  return <span className={cn(PILL, "bg-[var(--color-accent-2)] text-white", className)}>Past 48 h</span>;
}

/** Yellow: the next contact date has passed. */
export function OverduePill({ className }: { className?: string }) {
  return (
    <span className={cn(PILL, "bg-[var(--color-process-yellow)] text-[var(--jos-ink)]", className)}>Overdue</span>
  );
}

/** "Nov 6" from a YYYY-MM-DD day. */
export function shortDay(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
