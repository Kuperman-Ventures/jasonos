"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { BriefText } from "@/components/jasonos/home/brief-text";

// Checkable "Needs your attention" list. Click the number to mark done
// (strike-through); click again to undo. Remembered in this browser for the
// brief's date so a refresh doesn't lose your checks.

function storageKey(briefDate: string): string {
  return `jasonos.morning-brief.attention.${briefDate}`;
}

function loadDone(briefDate: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(briefDate));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveDone(briefDate: string, done: Set<string>) {
  try {
    window.localStorage.setItem(
      storageKey(briefDate),
      JSON.stringify([...done])
    );
  } catch {
    // private mode / quota — ignore; UI still works for the session
  }
}

export function MorningBriefAttention({
  briefDate,
  items,
}: {
  briefDate: string;
  items: string[];
}) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDone(loadDone(briefDate));
    setReady(true);
  }, [briefDate]);

  if (items.length === 0) return null;

  const toggle = (item: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      saveDone(briefDate, next);
      return next;
    });
  };

  const doneCount = items.filter((item) => done.has(item)).length;

  return (
    <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
            Needs your attention
          </h3>
        </div>
        {ready && doneCount > 0 ? (
          <span className="text-[11px] text-muted-foreground">
            {doneCount} of {items.length} done
          </span>
        ) : null}
      </div>
      <ol className="space-y-2">
        {items.map((item, i) => {
          const isDone = ready && done.has(item);
          return (
            <li key={`${i}-${item.slice(0, 24)}`} className="flex gap-2.5 text-sm leading-snug">
              <button
                type="button"
                onClick={() => toggle(item)}
                aria-pressed={isDone}
                aria-label={
                  isDone
                    ? `Mark item ${i + 1} incomplete`
                    : `Mark item ${i + 1} complete`
                }
                title={isDone ? "Mark incomplete" : "Mark complete"}
                className={
                  isDone
                    ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/20 text-emerald-200 transition-colors hover:bg-emerald-500/30"
                    : "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-semibold tabular-nums text-amber-200 transition-colors hover:bg-amber-500/35"
                }
              >
                {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
              </button>
              <span
                className={
                  isDone
                    ? "text-muted-foreground line-through decoration-muted-foreground/70"
                    : "text-foreground/90"
                }
              >
                <BriefText text={item} />
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
