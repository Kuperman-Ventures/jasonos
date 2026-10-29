"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  recordDecision,
  reopenProfessorDecision,
  runDecisionProposal,
} from "@/lib/server-actions/professor-roadmap";
import type {
  ProfessorDecision,
  ProfessorQuestion,
  QuestionStatus,
} from "@/lib/professor-roadmap/types";
import { cn } from "@/lib/utils";

const markdownComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mt-1 text-sm leading-relaxed text-foreground/80">{children}</p>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
};

function depColor(status: QuestionStatus | undefined): string {
  if (status === "confirmed") return "text-[var(--color-done-800)]";
  if (status === "researched") return "text-[var(--jos-action)]";
  return "text-[var(--jos-muted)]";
}

function DecisionCard({
  decision,
  questions,
}: {
  decision: ProfessorDecision;
  questions: ProfessorQuestion[];
}) {
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const [chooseOpen, setChooseOpen] = useState(false);
  const [picked, setPicked] = useState(decision.proposedOption || "");
  const [note, setNote] = useState("");

  const deps = useMemo(() => {
    return decision.dependsOnQuestionIds.map((id) => {
      const q = questions.find((item) => item.id === id);
      return {
        id,
        sortOrder: q?.sortOrder ?? 0,
        status: q?.status,
      };
    });
  }, [decision, questions]);

  const unfinished = deps.filter(
    (d) => d.status !== "researched" && d.status !== "confirmed"
  );
  const canPropose = unfinished.length === 0;
  const blockedTooltip = canPropose
    ? undefined
    : `Research questions ${unfinished
        .map((d) => d.sortOrder)
        .sort((a, b) => a - b)
        .join(", ")} first.`;

  return (
    <article className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-[var(--jos-ink)]">
          {decision.title}
        </h3>
        {decision.whyItMatters ? (
          <p className="mt-1 text-sm leading-relaxed text-foreground/80">
            {decision.whyItMatters}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-[var(--jos-muted)]">
          Depends on questions{" "}
          {deps.map((d, i) => (
            <span key={d.id}>
              {i > 0 ? ", " : ""}
              <span className={cn("font-semibold", depColor(d.status))}>
                {d.sortOrder}
              </span>
            </span>
          ))}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--jos-line)] text-[10px] uppercase tracking-widest text-[var(--jos-muted)]">
              <th className="py-1.5 pr-3 font-semibold">Option</th>
              <th className="py-1.5 pr-3 font-semibold">Pros</th>
              <th className="py-1.5 font-semibold">Cons</th>
            </tr>
          </thead>
          <tbody>
            {decision.options.map((option) => {
              const highlighted =
                (decision.status === "proposed" &&
                  option.name === decision.proposedOption) ||
                (decision.status === "decided" &&
                  option.name === decision.decidedOption);
              return (
                <tr
                  key={option.name}
                  className={cn(
                    "border-b border-[var(--jos-line)] align-top last:border-0",
                    highlighted && "bg-[color-mix(in_srgb,var(--jos-action)_8%,transparent)]"
                  )}
                >
                  <td className="py-2 pr-3 font-medium text-[var(--jos-ink)]">
                    {option.name}
                  </td>
                  <td className="py-2 pr-3 text-foreground/80">{option.pros}</td>
                  <td className="py-2 text-foreground/80">{option.cons}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {decision.status === "open" || decision.status === "proposed" ? (
        <div className="space-y-3">
          {decision.status === "proposed" ? (
            <div className="rounded-[2px] border border-[var(--jos-line)] bg-[var(--jos-surface)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
                Proposed
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--jos-ink)]">
                {decision.proposedOption}
              </p>
              {decision.proposedRationaleMd ? (
                <div className="mt-1">
                  <ReactMarkdown components={markdownComponents}>
                    {decision.proposedRationaleMd}
                  </ReactMarkdown>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <span title={blockedTooltip}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canPropose || busy}
                onClick={() => {
                  startBusy(async () => {
                    const result = await runDecisionProposal(decision.id);
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Decision proposed.");
                    router.refresh();
                  });
                }}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Propose decision
              </Button>
            </span>

            {decision.status === "proposed" ? (
              <>
                <Button
                  type="button"
                  variant="ok"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    startBusy(async () => {
                      const result = await recordDecision(
                        decision.id,
                        decision.proposedOption,
                        note
                      );
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success("Decision recorded.");
                      router.refresh();
                    });
                  }}
                >
                  Accept
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setChooseOpen((v) => !v);
                    setPicked(decision.proposedOption || decision.options[0]?.name || "");
                  }}
                >
                  Choose another
                </Button>
              </>
            ) : null}
          </div>

          {chooseOpen ? (
            <div className="space-y-2 rounded-[2px] border border-[var(--jos-line)] p-3">
              <select
                className="h-9 w-full rounded-[2px] border border-[var(--jos-line)] bg-[var(--jos-bg)] px-2 text-sm"
                value={picked}
                onChange={(e) => setPicked(e.target.value)}
              >
                {decision.options.map((option) => (
                  <option key={option.name} value={option.name}>
                    {option.name}
                  </option>
                ))}
              </select>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                rows={2}
                className="text-sm"
              />
              <Button
                type="button"
                size="sm"
                disabled={busy || !picked}
                onClick={() => {
                  startBusy(async () => {
                    const result = await recordDecision(
                      decision.id,
                      picked,
                      note
                    );
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Decision recorded.");
                    router.refresh();
                  });
                }}
              >
                Save decision
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
            Decided
            {decision.decidedAt
              ? ` · ${new Date(decision.decidedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}`
              : ""}
          </p>
          <p className="text-sm font-semibold text-[var(--jos-ink)]">
            {decision.decidedOption}
          </p>
          {decision.decidedNote ? (
            <p className="text-sm text-foreground/80">{decision.decidedNote}</p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              startBusy(async () => {
                const result = await reopenProfessorDecision(decision.id);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Decision reopened.");
                router.refresh();
              });
            }}
          >
            Reopen
          </Button>
        </div>
      )}
    </article>
  );
}

export function DecisionsPanel({
  decisions,
  questions,
}: {
  decisions: ProfessorDecision[];
  questions: ProfessorQuestion[];
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
          Decisions
        </h2>
        <p className="mt-1 text-xs text-[var(--jos-muted)]">
          Propose only after the dependent questions are researched or confirmed.
        </p>
      </div>
      <div className="space-y-3">
        {decisions.map((decision) => (
          <DecisionCard
            key={decision.id}
            decision={decision}
            questions={questions}
          />
        ))}
      </div>
    </section>
  );
}
