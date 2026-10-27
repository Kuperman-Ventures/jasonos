"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";

export function LiveCollapsibleList({
  title,
  subtitle,
  count,
  storageKey,
  defaultOpen = true,
  empty,
  children,
}: {
  title: string;
  subtitle?: string;
  count: number;
  storageKey: string;
  defaultOpen?: boolean;
  empty?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate collapse choice from localStorage
      if (stored === "1") setOpen(false);
      else if (stored === "0") setOpen(true);
    } catch {
      // private mode / quota
    }
  }, [storageKey]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, next ? "0" : "1");
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <section className="mt-12">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
        className="flex w-full items-start gap-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
            {title}
            <span className="ml-2 font-semibold normal-case tracking-normal text-[var(--jos-muted)]">
              {count}
            </span>
          </h2>
          {subtitle ? (
            <p className="mt-1 text-[13px] text-[var(--jos-muted)]">{subtitle}</p>
          ) : null}
        </div>
        <CaretDown
          size={16}
          weight="bold"
          className={`mt-0.5 shrink-0 text-[var(--jos-muted)] transition-transform ${
            open ? "" : "-rotate-90"
          }`}
          aria-hidden
        />
      </button>

      {open ? (
        count === 0 && empty ? (
          <div className="mt-4">{empty}</div>
        ) : (
          children
        )
      ) : null}
    </section>
  );
}
