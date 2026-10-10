import { cn } from "@/lib/utils";

/** 1 magenta, 2 yellow, 3 dark teal, 4 ink, ok green (meetings on Home), next bright cyan. Idle is surface. */
export type StatusRung = 1 | 2 | 3 | 4 | "ok" | "idle" | "next";

const RUNG_CLASS: Record<StatusRung, string> = {
  1: "bg-rung-1",
  2: "bg-rung-2",
  3: "bg-rung-3",
  4: "bg-rung-4",
  ok: "bg-rung-ok",
  idle: "bg-rung-idle",
  next: "bg-rung-next",
};

export function rungClass(rung: StatusRung) {
  return RUNG_CLASS[rung];
}

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
        "inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-bold leading-none",
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
    <div className={cn("w-full px-4 py-3 text-[16px]", RUNG_CLASS[rung], className)}>
      {children}
    </div>
  );
}
