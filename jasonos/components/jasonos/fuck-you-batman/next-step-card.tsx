import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nextStep } from "@/lib/fuck-you-batman/process";
import type { FybDecision, FybEntry } from "@/lib/fuck-you-batman/types";

export function NextStepCard({
  week,
  decisions,
  entries,
}: {
  week: number;
  decisions: FybDecision[];
  entries: FybEntry[];
}) {
  const step = nextStep(week, decisions, entries);
  const href = step.href;
  const external = Boolean(href?.startsWith("https://"));

  return (
    <section className="rounded-xl border-2 border-foreground/80 bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Your Next Step
        </p>
        {step.stepOf ? (
          <p className="num-mono text-[11px] text-muted-foreground">
            {step.stepOf.index} of {step.stepOf.total}
          </p>
        ) : null}
      </div>
      <h2 className="mt-1 text-base font-semibold">{step.title}</h2>
      <p className="mt-1 text-sm text-foreground/80">{step.detail}</p>
      {href && step.hrefLabel ? (
        <Button
          size="sm"
          className="mt-3"
          render={
            external ? (
              <a href={href} target="_blank" rel="noreferrer" />
            ) : (
              <Link href={href} />
            )
          }
        >
          {step.hrefLabel}
          <ArrowRight size={14} />
        </Button>
      ) : null}
    </section>
  );
}
