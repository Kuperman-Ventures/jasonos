"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface BriefItemProps {
  title: string;
  subtitle?: string;
  detail?: string;
  meta?: string;
  actions?: ReactNode;
  accent?: "amber" | "emerald" | "sky" | "violet" | "rose" | "muted";
  className?: string;
}

const ACCENT: Record<NonNullable<BriefItemProps["accent"]>, string> = {
  amber: "border-[var(--jos-line)]",
  emerald: "border-[var(--jos-line)]",
  sky: "border-rung-3",
  violet: "border-[var(--jos-line)]",
  rose: "border-rung-1",
  muted: "",
};

export function BriefItem({
  title,
  subtitle,
  detail,
  meta,
  actions,
  accent = "muted",
  className,
}: BriefItemProps) {
  return (
    <div
      className={cn(
        "jos-card-enter rounded-md border bg-card px-3 py-2 transition-colors hover:border-foreground/20",
        ACCENT[accent],
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-xs font-medium text-foreground">{title}</p>
            {meta ? <span className="shrink-0 text-[10px] text-muted-foreground">{meta}</span> : null}
          </div>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</p>
          ) : null}
          {detail ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
              {detail}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
    </div>
  );
}
