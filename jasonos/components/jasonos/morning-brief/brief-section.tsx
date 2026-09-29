"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BriefSectionProps {
  title: string;
  subtitle?: string;
  count?: number;
  source?: string;
  liveBadge?: boolean;
  defaultOpen?: boolean;
  emptyState?: ReactNode;
  isEmpty?: boolean;
  children: ReactNode;
}

export function BriefSection({
  title,
  subtitle,
  count,
  source,
  liveBadge,
  defaultOpen = true,
  emptyState,
  isEmpty,
  children,
}: BriefSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border bg-background/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40"
        aria-expanded={open}
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            !open && "-rotate-90"
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-foreground">
              {title}
            </h3>
            {typeof count === "number" ? (
              <span className="num-mono text-[11px] text-muted-foreground">· {count}</span>
            ) : null}
            {liveBadge ? (
              <span
                className="inline-block h-1 w-1 rounded-full bg-rung-4"
                title="Live source"
              />
            ) : null}
            {subtitle ? (
              <span className="truncate text-[11px] text-muted-foreground">{subtitle}</span>
            ) : null}
          </div>
        </div>
        {source ? (
          <span className="hidden sm:inline text-[10px] text-muted-foreground">{source}</span>
        ) : null}
      </button>
      {open ? (
        <div className="border-t px-3 py-2.5">
          {isEmpty && emptyState ? (
            <div className="py-3 text-center text-[11px] text-muted-foreground">
              {emptyState}
            </div>
          ) : (
            children
          )}
        </div>
      ) : null}
    </div>
  );
}
