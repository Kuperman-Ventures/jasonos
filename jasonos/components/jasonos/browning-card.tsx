"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { UnscoredConversationsDialog } from "@/components/jasonos/browning/unscored-conversations-dialog";
import {
  BROWNING_GATE_STATUS_LABELS,
  type BrowningSummary,
} from "@/lib/browning/types";
import {
  GATE_STATUS_TONE,
  warmthColorClass,
  fmtBrowningDate,
} from "@/lib/browning/format";

interface Props {
  summary: BrowningSummary;
}

export function BrowningCard({ summary }: Props) {
  const [unscoredOpen, setUnscoredOpen] = useState(false);

  const weekly = summary.weekly;
  const prior = summary.prior_weekly;
  const warmth = weekly?.avg_warmth ?? null;
  const priorWarmth = prior?.avg_warmth ?? null;
  const delta =
    warmth !== null && priorWarmth !== null
      ? Number((warmth - priorWarmth).toFixed(2))
      : null;

  const conversations = weekly?.conversations_count ?? 0;
  const referrals = weekly?.referrals_received_total ?? 0;
  const thanks = weekly?.thank_yous_sent_count ?? 0;
  const target = summary.weekly_target;
  const nextGate = summary.next_gate;

  const hasAnyData =
    summary.unscored_count > 0 ||
    summary.pending_deliverables.length > 0 ||
    weekly !== null ||
    nextGate !== null;

  if (!hasAnyData) {
    return (
      <Card size="sm" className="border-dashed">
        <CardContent>
          <div className="flex items-baseline justify-between">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Browning
            </div>
            <Link
              href="/browning"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Open <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            No Browning activity yet. Tag your warm-market contacts at{" "}
            <Link href="/browning" className="underline hover:text-foreground">
              /browning
            </Link>{" "}
            to start scoring.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/70 bg-card/80">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-baseline justify-between">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Browning
            </div>
            <Link
              href="/browning"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View console <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>

          {/* Primary metric — Warmth */}
          <div className="flex items-baseline gap-3">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    "font-heading text-3xl font-semibold tabular-nums",
                    warmthColorClass(warmth)
                  )}
                >
                  {warmth !== null ? warmth.toFixed(1) : "—"}
                </span>
                {delta !== null && delta !== 0 ? (
                  <span
                    className={cn(
                      "inline-flex items-center text-[10px]",
                      delta > 0 ? "text-emerald-300" : "text-red-300"
                    )}
                  >
                    {delta > 0 ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    )}
                    {Math.abs(delta).toFixed(2)}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                Avg Warmth · primary signal
              </div>
            </div>
          </div>

          {/* Secondary metrics row */}
          <div className="grid grid-cols-3 gap-2 rounded-md border bg-background/30 p-2 text-xs">
            <div>
              <div className="font-semibold tabular-nums">
                {conversations}
                <span className="ml-0.5 text-[10px] text-muted-foreground">
                  / {target}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Conversations
              </div>
            </div>
            <div>
              <div className="font-semibold tabular-nums">{referrals}</div>
              <div className="text-[10px] text-muted-foreground">Referrals</div>
            </div>
            <div>
              <div className="font-semibold tabular-nums">{thanks}</div>
              <div className="text-[10px] text-muted-foreground">Thank-yous</div>
            </div>
          </div>

          {/* Next gate */}
          {nextGate ? (
            <Link
              href="/browning"
              className="block rounded-md border bg-background/30 p-2 text-xs transition-colors hover:bg-background/60"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="mr-1.5 font-mono text-[11px]">
                    {nextGate.gate_code}
                  </span>
                  <span className="truncate">{nextGate.description}</span>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px]",
                    GATE_STATUS_TONE[nextGate.status].chip
                  )}
                >
                  {BROWNING_GATE_STATUS_LABELS[nextGate.status]}
                </span>
              </div>
            </Link>
          ) : null}

          {/* Conditional alerts */}
          {summary.unscored_count > 0 ? (
            <button
              type="button"
              onClick={() => setUnscoredOpen(true)}
              className="flex w-full items-center gap-2 rounded-md border border-red-500/50 bg-red-500/10 px-2 py-1.5 text-left text-xs text-red-200 transition-colors hover:bg-red-500/15"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">
                {summary.unscored_count} conversation
                {summary.unscored_count === 1 ? "" : "s"} unscored
              </span>
              <span className="text-[10px] uppercase tracking-wider">
                Score now <ArrowRight className="inline h-3 w-3" />
              </span>
            </button>
          ) : null}

          {summary.pending_deliverables.length > 0 ? (
            <Link
              href="/browning?tab=watch"
              className="flex w-full items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1.5 text-left text-xs text-amber-100 transition-colors hover:bg-amber-500/15"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">
                Browning owes you:{" "}
                <span className="font-medium">
                  {summary.pending_deliverables[0].promised}
                </span>
                {summary.pending_deliverables.length > 1 ? (
                  <span className="text-[10px] text-amber-200/70">
                    {" "}
                    + {summary.pending_deliverables.length - 1} more
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-[10px] uppercase tracking-wider">
                {fmtBrowningDate(summary.pending_deliverables[0].month)}
              </span>
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <UnscoredConversationsDialog
        open={unscoredOpen}
        onOpenChange={setUnscoredOpen}
      />
    </>
  );
}
