"use client";

import { useState } from "react";
import { Flame, AlertCircle, ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { GatesPanel } from "@/components/jasonos/browning/gates-panel";
import { PipelinePanel } from "@/components/jasonos/browning/pipeline-panel";
import { WatchPanel } from "@/components/jasonos/browning/watch-panel";
import { UnscoredConversationsDialog } from "@/components/jasonos/browning/unscored-conversations-dialog";
import {
  BROWNING_GATE_STATUS_LABELS,
  type BrowningContactRow,
  type BrowningDeliverable,
  type BrowningGate,
  type BrowningSummary,
  type BrowningWeeklyKpi,
} from "@/lib/browning/types";
import {
  GATE_STATUS_TONE,
  warmthColorClass,
} from "@/lib/browning/format";

interface Props {
  summary: BrowningSummary;
  contacts: BrowningContactRow[];
  gates: BrowningGate[];
  deliverables: BrowningDeliverable[];
  weeklyKpis: BrowningWeeklyKpi[];
}

export function BrowningClient({
  summary,
  contacts,
  gates,
  deliverables,
  weeklyKpis,
}: Props) {
  const [unscoredOpen, setUnscoredOpen] = useState(false);

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">Browning</h1>
          <p className="text-xs text-muted-foreground">
            Browning Associates engagement console — warmth coaching, action-plan
            gates, and accountability for what they promised.
          </p>
        </div>
        <BrowningKpiStrip
          summary={summary}
          weeklyKpis={weeklyKpis}
          onOpenUnscored={() => setUnscoredOpen(true)}
        />
      </header>

      <Tabs defaultValue="gates">
        <TabsList>
          <TabsTrigger value="gates">Gates</TabsTrigger>
          <TabsTrigger value="pipeline">
            Pipeline
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {contacts.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="watch">Watch</TabsTrigger>
        </TabsList>

        <TabsContent value="gates" className="mt-2">
          <GatesPanel gates={gates} />
        </TabsContent>
        <TabsContent value="pipeline" className="mt-2">
          <PipelinePanel contacts={contacts} />
        </TabsContent>
        <TabsContent value="watch" className="mt-2">
          <WatchPanel deliverables={deliverables} />
        </TabsContent>
      </Tabs>

      <UnscoredConversationsDialog
        open={unscoredOpen}
        onOpenChange={setUnscoredOpen}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI strip
// ---------------------------------------------------------------------------

function BrowningKpiStrip({
  summary,
  weeklyKpis,
  onOpenUnscored,
}: {
  summary: BrowningSummary;
  weeklyKpis: BrowningWeeklyKpi[];
  onOpenUnscored: () => void;
}) {
  const weekly = summary.weekly ?? weeklyKpis[0] ?? null;
  const prior = summary.prior_weekly ?? weeklyKpis[1] ?? null;

  const warmth = weekly?.avg_warmth ?? null;
  const priorWarmth = prior?.avg_warmth ?? null;
  const delta =
    warmth !== null && priorWarmth !== null
      ? Number((warmth - priorWarmth).toFixed(2))
      : null;

  const conversations = weekly?.conversations_count ?? 0;
  const target = summary.weekly_target;
  const nextGate = summary.next_gate;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card/40 px-4 py-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Avg Warmth (7d)
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "font-heading text-2xl font-semibold tabular-nums",
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
      </div>

      <div className="h-10 w-px bg-border" />

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Conversations this week
        </div>
        <div className="font-heading text-2xl font-semibold tabular-nums">
          {conversations}
          <span className="ml-1 text-sm text-muted-foreground">/ {target}</span>
        </div>
      </div>

      <div className="h-10 w-px bg-border" />

      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Next open gate
        </div>
        {nextGate ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{nextGate.gate_code}</span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px]",
                GATE_STATUS_TONE[nextGate.status].chip
              )}
            >
              {BROWNING_GATE_STATUS_LABELS[nextGate.status]}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-sm text-emerald-300">
            <Flame className="h-3.5 w-3.5" />
            All gates complete
          </div>
        )}
      </div>

      {summary.unscored_count > 0 ? (
        <Button
          variant="destructive"
          size="sm"
          onClick={onOpenUnscored}
          className="gap-1.5"
        >
          <span className="relative">
            <AlertCircle className="h-3.5 w-3.5" />
            <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-red-400" />
          </span>
          {summary.unscored_count} unscored
        </Button>
      ) : null}
    </div>
  );
}
