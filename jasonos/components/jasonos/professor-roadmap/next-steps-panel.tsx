"use client";

import { ChevronDown, ChevronRight, ListTodo, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  addHandNextStep,
  generateNextSteps,
  pushNextStepToTodos,
  setNextStep,
} from "@/lib/server-actions/professor-roadmap";
import type {
  ProfessorDecision,
  ProfessorNextStep,
  ProfessorQuestion,
} from "@/lib/professor-roadmap/types";

function StepRow({
  step,
  questions,
  decisions,
}: {
  step: ProfessorNextStep;
  questions: ProfessorQuestion[];
  decisions: ProfessorDecision[];
}) {
  const router = useRouter();
  const [showWhy, setShowWhy] = useState(false);
  const [busy, startBusy] = useTransition();

  const linkLabel = useMemo(() => {
    if (step.questionId) {
      const q = questions.find((item) => item.id === step.questionId);
      return q ? `Question ${q.sortOrder}` : null;
    }
    if (step.decisionId) {
      const d = decisions.find((item) => item.id === step.decisionId);
      return d ? d.title : null;
    }
    return null;
  }, [step, questions, decisions]);

  function act(
    label: string,
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>
  ) {
    startBusy(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(label);
      router.refresh();
    });
  }

  return (
    <li className="rounded-xl border bg-card px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-[var(--jos-ink)]">{step.text}</p>
            {step.generated ? (
              <span className="rounded-[2px] border border-[var(--jos-line)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
                Proposed
              </span>
            ) : null}
          </div>
          {linkLabel ? (
            <p className="mt-1 text-[11px] text-[var(--jos-muted)]">{linkLabel}</p>
          ) : null}
          {step.rationale ? (
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--jos-muted)]"
              onClick={() => setShowWhy((v) => !v)}
            >
              {showWhy ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Why
            </button>
          ) : null}
          {showWhy && step.rationale ? (
            <p className="mt-1 text-xs leading-relaxed text-foreground/80">
              {step.rationale}
            </p>
          ) : null}
        </div>
        {step.status === "open" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="okOutline"
              size="sm"
              disabled={busy}
              onClick={() =>
                act("Marked done.", async () => {
                  const result = await setNextStep(step.id, "done");
                  return result.ok
                    ? { ok: true }
                    : { ok: false, error: result.error };
                })
              }
            >
              Done
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                act("Skipped.", async () => {
                  const result = await setNextStep(step.id, "skipped");
                  return result.ok
                    ? { ok: true }
                    : { ok: false, error: result.error };
                })
              }
            >
              Skip
            </Button>
            {step.todoId ? (
              <span className="inline-flex h-8 items-center text-xs font-semibold text-[var(--jos-muted)]">
                In to-dos
              </span>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  act("Pushed to to-dos.", async () => {
                    const result = await pushNextStepToTodos(step.id);
                    return result.ok
                      ? { ok: true }
                      : { ok: false, error: result.error };
                  })
                }
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ListTodo className="h-3.5 w-3.5" />
                )}
                Push to to-dos
              </Button>
            )}
          </div>
        ) : (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
            {step.status}
          </span>
        )}
      </div>
    </li>
  );
}

export function NextStepsPanel({
  nextSteps,
  questions,
  decisions,
}: {
  nextSteps: ProfessorNextStep[];
  questions: ProfessorQuestion[];
  decisions: ProfessorDecision[];
}) {
  const router = useRouter();
  const [showCompleted, setShowCompleted] = useState(false);
  const [text, setText] = useState("");
  const [rationale, setRationale] = useState("");
  const [generating, startGenerate] = useTransition();
  const [adding, startAdd] = useTransition();

  const open = nextSteps.filter((s) => s.status === "open");
  const completed = nextSteps.filter((s) => s.status !== "open");

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
            Next Steps
          </h2>
          <p className="mt-1 text-xs text-[var(--jos-muted)]">
            Proposed from open questions and ready decisions. Hand-added steps stay put.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={generating}
          onClick={() => {
            startGenerate(async () => {
              const result = await generateNextSteps();
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success(`Proposed ${result.data.count} steps.`);
              router.refresh();
            });
          }}
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Propose next steps
        </Button>
      </div>

      {open.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-3 text-sm text-[var(--jos-muted)]">
          No open steps. Propose some after you research a question.
        </p>
      ) : (
        <ul className="space-y-2">
          {open.map((step) => (
            <StepRow
              key={step.id}
              step={step}
              questions={questions}
              decisions={decisions}
            />
          ))}
        </ul>
      )}

      {completed.length > 0 ? (
        <div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--jos-muted)]"
            onClick={() => setShowCompleted((v) => !v)}
          >
            {showCompleted ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Show completed ({completed.length})
          </button>
          {showCompleted ? (
            <ul className="mt-2 space-y-2">
              {completed.map((step) => (
                <StepRow
                  key={step.id}
                  step={step}
                  questions={questions}
                  decisions={decisions}
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <form
        className="space-y-2 rounded-xl border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          startAdd(async () => {
            const result = await addHandNextStep({ text, rationale });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            setText("");
            setRationale("");
            toast.success("Step added.");
            router.refresh();
          });
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
          Add a step
        </p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What to do next"
          rows={2}
          className="text-sm"
          required
        />
        <Textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Why (optional)"
          rows={2}
          className="text-sm"
        />
        <Button type="submit" size="sm" disabled={adding || !text.trim()}>
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Add step
        </Button>
      </form>
    </section>
  );
}
