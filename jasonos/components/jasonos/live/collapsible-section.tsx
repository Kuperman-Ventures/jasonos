"use client";

import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LIVE_SECTION_LABEL } from "./tokens";

const STORAGE_PREFIX = "jasonos.live.section.";

function readStored(id: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function CollapsibleSection({
  id,
  label,
  meta,
  defaultOpen = false,
  remember = true,
  children,
  className,
}: {
  id: string;
  label: string;
  meta?: ReactNode;
  defaultOpen?: boolean;
  remember?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(() => (remember ? readStored(id, defaultOpen) : defaultOpen));

  const toggle = () => {
    setOpen((value) => {
      const next = !value;
      if (remember) {
        try {
          window.localStorage.setItem(`${STORAGE_PREFIX}${id}`, next ? "1" : "0");
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  };

  return (
    <section className={cn("border-t-2 border-[var(--jos-ink)] pt-3", className)}>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={open}
      >
        <span className={LIVE_SECTION_LABEL}>{label}</span>
        <span className="min-w-0 flex-1 text-right text-[13px] text-[var(--jos-muted)]">
          {meta}
        </span>
        {open ? (
          <CaretDown size={14} weight="bold" className="shrink-0 text-[var(--jos-muted)]" aria-hidden />
        ) : (
          <CaretRight size={14} weight="bold" className="shrink-0 text-[var(--jos-muted)]" aria-hidden />
        )}
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
