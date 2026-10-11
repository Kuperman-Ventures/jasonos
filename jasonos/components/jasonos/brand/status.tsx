import { cn } from "@/lib/utils";

/**
 * Urgency rungs: 1 magenta, 2 yellow, 3 cyan 700, 4 ink/paper.
 * done = completed / connected / goal met (green). idle = surface. next = bright cyan.
 * "ok" is kept as an alias of "done".
 */
export type StatusRung = 1 | 2 | 3 | 4 | "done" | "ok" | "idle" | "next";

export type DomainColor = "calendar" | "email" | "todo" | "done";

const RUNG_CLASS: Record<StatusRung, string> = {
  1: "bg-rung-1",
  2: "bg-rung-2",
  3: "bg-rung-3",
  4: "bg-rung-4",
  done: "bg-rung-done",
  ok: "bg-rung-done",
  idle: "bg-rung-idle",
  next: "bg-rung-next",
};

const DOMAIN_CLASS: Record<DomainColor, string> = {
  calendar: "bg-domain-calendar",
  email: "bg-domain-email",
  todo: "bg-domain-todo",
  done: "bg-domain-done",
};

export function rungClass(rung: StatusRung) {
  return RUNG_CLASS[rung];
}

export function domainClass(domain: DomainColor) {
  return DOMAIN_CLASS[domain];
}

/** Solid status pill — 14/700, caps, radius 2px. */
export function StatusPill({
  rung,
  children,
  className,
}: {
  rung: StatusRung;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[2px] px-2 py-0.5 text-[14px] font-bold uppercase leading-none tracking-[0.04em]",
        RUNG_CLASS[rung],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBand({
  rung,
  children,
  className,
}: {
  rung: StatusRung;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 px-4 py-3", RUNG_CLASS[rung], className)}>
      {children}
    </div>
  );
}

/** Domain section header — calendar / email / to-do / done. Not for urgency. */
export function DomainBand({
  domain,
  children,
  className,
}: {
  domain: DomainColor;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 px-4 py-3", DOMAIN_CLASS[domain], className)}>
      {children}
    </div>
  );
}

/** Full-width solid banner — 14/20 padding, 600 weight, no border or stripe. */
export function Banner({
  rung,
  children,
  className,
}: {
  rung: StatusRung;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full px-5 py-3.5 text-[14px] font-semibold leading-snug",
        RUNG_CLASS[rung],
        className
      )}
    >
      {children}
    </div>
  );
}
