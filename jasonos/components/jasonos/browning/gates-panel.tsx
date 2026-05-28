"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { GateEditDialog } from "@/components/jasonos/browning/gate-edit-dialog";
import {
  BROWNING_GATE_STATUS_LABELS,
  type BrowningGate,
} from "@/lib/browning/types";
import { GATE_STATUS_TONE, fmtBrowningDate } from "@/lib/browning/format";

const STEP_HEADERS: Record<number, string> = {
  1: "STEP 1 — BUILD THE SUPER NETWORK",
  2: "STEP 2 — ACTIVATE THE NETWORK",
  3: "STEP 3 — POSITION & APPLY",
};

interface Props {
  gates: BrowningGate[];
}

export function GatesPanel({ gates }: Props) {
  const [activeGate, setActiveGate] = useState<BrowningGate | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<number, BrowningGate[]>();
    for (const g of gates) {
      const arr = map.get(g.step_number) ?? [];
      arr.push(g);
      map.set(g.step_number, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [gates]);

  const completedCount = gates.filter((g) => g.status === "completed").length;
  const pct = gates.length ? (completedCount / gates.length) * 100 : 0;

  return (
    <div className="grid grid-cols-[12px_minmax(0,1fr)] gap-4">
      {/* Vertical progress rail */}
      <div className="relative">
        <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-border" />
        <div
          className="absolute left-1/2 top-0 w-[3px] -translate-x-1/2 rounded-full bg-emerald-400 transition-all"
          style={{ height: `${pct}%` }}
        />
      </div>

      <div className="space-y-6">
        {grouped.map(([step, items]) => (
          <section key={step} className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {STEP_HEADERS[step] ?? `STEP ${step}`}
            </h3>
            <ul className="divide-y divide-border rounded-lg border bg-card/40">
              {items.map((g) => {
                const tone = GATE_STATUS_TONE[g.status];
                const completed = g.status === "completed";
                return (
                  <li key={g.gate_code}>
                    <button
                      type="button"
                      onClick={() => setActiveGate(g)}
                      className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="mt-0.5 flex items-center gap-2">
                        {completed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Circle
                            className={cn(
                              "h-4 w-4",
                              g.status === "in_progress"
                                ? "text-sky-400"
                                : "text-muted-foreground/60"
                            )}
                          />
                        )}
                        <span className="font-mono text-xs text-muted-foreground">
                          {g.gate_code}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-snug">
                          {g.description}
                        </div>
                        {g.browning_sla ? (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            SLA: {g.browning_sla}
                          </div>
                        ) : null}
                        {g.notes ? (
                          <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground/80">
                            {g.notes}
                          </div>
                        ) : null}
                        <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                          {g.target_date ? (
                            <span>Target: {fmtBrowningDate(g.target_date)}</span>
                          ) : null}
                          {g.completed_date ? (
                            <span>
                              Completed: {fmtBrowningDate(g.completed_date)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          tone.chip
                        )}
                      >
                        {BROWNING_GATE_STATUS_LABELS[g.status]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <GateEditDialog
        open={!!activeGate}
        onOpenChange={(next) => {
          if (!next) setActiveGate(null);
        }}
        gate={activeGate}
      />
    </div>
  );
}
