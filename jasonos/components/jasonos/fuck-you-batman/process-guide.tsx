import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { PHASES } from "@/lib/fuck-you-batman/plan";
import {
  SKETCH_DOC_URL,
  SKETCH_NOTE,
  PROCESS_STEPS,
  partStatus,
  partWaitingHref,
  phaseDateLabel,
  stepStatus,
  weekMonday,
  weekRangeLabel,
  type ProcessPart,
  type ProcessStepStatus,
} from "@/lib/fuck-you-batman/process";
import type { FybDecision, FybEntry } from "@/lib/fuck-you-batman/types";
import { cn } from "@/lib/utils";

function StepCircle({
  status,
  phase,
  className,
}: {
  status: ProcessStepStatus;
  phase: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card",
        status === "done" && "bg-foreground text-background",
        status === "now" && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
        (status === "next" || status === "later") && "border border-muted-foreground/40 text-muted-foreground",
        className
      )}
    >
      {status === "done" ? (
        <Check size={12} />
      ) : (
        <span className="num-mono text-[11px] font-semibold">{phase}</span>
      )}
    </span>
  );
}

function pillClass(status: ProcessStepStatus): string {
  if (status === "done") return "bg-muted text-muted-foreground";
  if (status === "now") return "bg-foreground text-background";
  if (status === "next") return "border text-foreground";
  return "text-muted-foreground";
}

function statusLabel(status: ProcessStepStatus): string {
  if (status === "done") return "Done";
  if (status === "now") return "Now";
  if (status === "next") return "Next";
  return "Later";
}

function groupPartsByWeek(parts: ProcessPart[]): { week: number; parts: ProcessPart[] }[] {
  const groups: { week: number; parts: ProcessPart[] }[] = [];
  for (const part of parts) {
    const last = groups[groups.length - 1];
    if (last && last.week === part.week) last.parts.push(part);
    else groups.push({ week: part.week, parts: [part] });
  }
  return groups;
}

function PartRow({
  part,
  decisions,
  entries,
}: {
  part: ProcessPart;
  decisions: FybDecision[];
  entries: FybEntry[];
}) {
  const status = partStatus(part, decisions, entries);
  return (
    <div className="flex gap-2 border-b py-1.5 last:border-0">
      <span
        className={cn(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          status === "done" && "bg-foreground",
          status === "waiting" && "bg-amber-500",
          status === "not-posted" && "border border-muted-foreground/50"
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium">{part.label}</p>
        <p className="text-xs text-muted-foreground">{part.why}</p>
      </div>
      <p className="shrink-0 text-[10px] whitespace-nowrap text-muted-foreground">
        {status === "done" ? (
          "Decided"
        ) : status === "waiting" ? (
          <Link href={partWaitingHref(part)} className="underline">
            Waiting on you
          </Link>
        ) : (
          `Posted ${weekMonday(part.week)}`
        )}
      </p>
    </div>
  );
}

export function ProcessGuide({
  week,
  decisions,
  entries,
}: {
  week: number;
  decisions: FybDecision[];
  entries: FybEntry[];
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        How the Book Gets Made
      </p>
      <p className="mt-1 text-sm text-foreground/80">
        Built from the ending backward, then written from the start forward. Each step needs the one
        before it.
      </p>

      <div className="relative mt-3">
        <div
          aria-hidden
          className="pointer-events-none absolute top-3 right-[6.25%] left-[6.25%] hidden h-px bg-border sm:block"
        />
        <ol className="grid grid-cols-4 gap-y-3 sm:grid-cols-8">
        {PROCESS_STEPS.map((step) => {
          const phase = PHASES.find((p) => p.number === step.phase);
          const status = stepStatus(step.phase, week);
          return (
            <li key={step.phase} className="relative flex flex-col items-center">
              <Link href={`#step-${step.phase}`} className="flex flex-col items-center">
                <StepCircle status={status} phase={step.phase} />
                <span
                  className={cn(
                    "mt-1 text-center text-[10px] leading-tight",
                    status === "now" && "font-semibold text-foreground",
                    (status === "next" || status === "later") && "text-muted-foreground"
                  )}
                >
                  {phase?.name ?? `Phase ${step.phase}`}
                </span>
              </Link>
            </li>
          );
        })}
        </ol>
      </div>

      <ol className="relative mt-4 space-y-1 before:absolute before:top-3 before:bottom-3 before:left-[11px] before:w-px before:bg-border">
        {PROCESS_STEPS.map((step) => {
          const phase = PHASES.find((p) => p.number === step.phase);
          const status = stepStatus(step.phase, week);
          const open = status === "now" || status === "next";
          return (
            <li key={step.phase} id={`step-${step.phase}`} className="scroll-mt-20">
              <details className="group" open={open || undefined}>
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 [&::-webkit-details-marker]:hidden">
                  <StepCircle status={status} phase={step.phase} />
                  <span
                    className={cn(
                      "min-w-0 text-sm font-semibold",
                      status === "done" && "text-muted-foreground"
                    )}
                  >
                    {phase?.name ?? `Phase ${step.phase}`}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest",
                      pillClass(status)
                    )}
                  >
                    {statusLabel(status)}
                  </span>
                  <span className="num-mono ml-auto shrink-0 text-[11px] whitespace-nowrap text-muted-foreground">
                    {phaseDateLabel(step.phase)}
                  </span>
                  <ChevronDown size={14} className="shrink-0 text-muted-foreground group-open:rotate-180" />
                </summary>
                <div className="space-y-3 pb-3 pl-8">
                  <p className="text-sm text-foreground/80">{step.purpose}</p>
                  <dl className="grid grid-cols-[76px_1fr] gap-x-3 gap-y-1.5">
                    <dt className="pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      You
                    </dt>
                    <dd className="text-xs text-foreground/80">{step.you}</dd>
                    <dt className="pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Claude
                    </dt>
                    <dd className="text-xs text-foreground/80">{step.claude}</dd>
                    <dt className="pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Where
                    </dt>
                    <dd className="text-xs text-foreground/80">
                      {step.inApp.href ? (
                        <Link href={step.inApp.href} className="underline">
                          {step.inApp.label}
                        </Link>
                      ) : (
                        step.inApp.label
                      )}
                    </dd>
                  </dl>
                  {step.parts
                    ? groupPartsByWeek(step.parts).map((group) => (
                        <div key={group.week}>
                          <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Week {group.week} · {weekRangeLabel(group.week)}
                          </p>
                          {group.parts.map((part) => (
                            <PartRow
                              key={part.label}
                              part={part}
                              decisions={decisions}
                              entries={entries}
                            />
                          ))}
                        </div>
                      ))
                    : null}
                </div>
              </details>
            </li>
          );
        })}
      </ol>

      <aside className="mt-4 border-l-2 border-foreground/30 pl-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Writing Before Phase 4
        </p>
        <p className="mt-1 text-xs text-foreground/80">
          {SKETCH_NOTE}{" "}
          <Link href={SKETCH_DOC_URL} target="_blank" rel="noreferrer" className="underline">
            Open the sketch doc
          </Link>
        </p>
      </aside>

      <p className="mt-3 text-[11px] text-muted-foreground">
        A missed drafting week moves the end date out by a week. Later phases are not compressed.
      </p>
    </div>
  );
}
