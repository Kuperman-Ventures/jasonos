"use client";

import { ChevronDown, ChevronRight, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addProfessorQuestion,
  markQuestionConfirmed,
  reopenQuestion,
  runQuestionResearch,
} from "@/lib/server-actions/professor-roadmap";
import type {
  ProfessorQuestion,
  ProfessorSchool,
} from "@/lib/professor-roadmap/types";

const markdownComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mt-1 text-sm leading-relaxed text-foreground/80">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-foreground/80">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mt-1 list-decimal space-y-1 pl-4 text-sm text-foreground/80">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li>{children}</li>,
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2"
    >
      {children}
    </a>
  ),
};

function statusPill(status: ProfessorQuestion["status"]) {
  if (status === "confirmed") {
    return (
      <span className="rounded-[2px] bg-[color-mix(in_srgb,var(--color-done)_18%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-done-800)]">
        Confirmed
      </span>
    );
  }
  if (status === "researched") {
    return (
      <span className="rounded-[2px] bg-[color-mix(in_srgb,var(--jos-action)_16%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-action)]">
        Researched
      </span>
    );
  }
  return (
    <span className="rounded-[2px] border border-[var(--jos-line)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
      Open
    </span>
  );
}

function QuestionRow({ question }: { question: ProfessorQuestion }) {
  const router = useRouter();
  const [open, setOpen] = useState(
    question.status === "researched" || question.status === "confirmed"
  );
  const [confirmedBy, setConfirmedBy] = useState(question.confirmedBy || "");
  const [busy, startBusy] = useTransition();
  const [researching, startResearch] = useTransition();

  function run(label: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
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
    <li className="rounded-xl border bg-card">
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mt-0.5 num-mono text-sm font-semibold text-[var(--jos-muted)]">
          {question.sortOrder}
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium text-[var(--jos-ink)]">
          {question.question}
        </span>
        <span className="mt-0.5 shrink-0">{statusPill(question.status)}</span>
        {open ? (
          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-[var(--jos-muted)]" />
        ) : (
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--jos-muted)]" />
        )}
      </button>

      {open ? (
        <div className="space-y-3 border-t border-[var(--jos-line)] px-4 py-3">
          {question.whyItMatters ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
                Why it matters
              </p>
              <p className="mt-1 text-sm leading-relaxed text-foreground/80">
                {question.whyItMatters}
              </p>
            </div>
          ) : null}

          {question.findingMd ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
                Finding
              </p>
              <div className="mt-1">
                <ReactMarkdown components={markdownComponents}>
                  {question.findingMd}
                </ReactMarkdown>
              </div>
            </div>
          ) : null}

          {question.findingSources.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
                Sources
              </p>
              <ul className="mt-1 space-y-1">
                {question.findingSources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--jos-action)] underline underline-offset-2"
                    >
                      {source.title || source.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={researching || busy}
              onClick={() => {
                startResearch(async () => {
                  const result = await runQuestionResearch(question.id);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Research saved.");
                  router.refresh();
                });
              }}
            >
              {researching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              {question.status === "open" ? "Research" : "Re-run"}
            </Button>

            {question.status !== "open" ? (
              <>
                <Input
                  value={confirmedBy}
                  onChange={(e) => setConfirmedBy(e.target.value)}
                  placeholder="Confirmed by…"
                  className="h-8 max-w-[180px] text-sm"
                  disabled={busy || researching}
                />
                <Button
                  type="button"
                  variant="okOutline"
                  size="sm"
                  disabled={busy || researching || !confirmedBy.trim()}
                  onClick={() =>
                    run("Marked confirmed.", async () => {
                      const result = await markQuestionConfirmed(
                        question.id,
                        confirmedBy
                      );
                      return result.ok
                        ? { ok: true }
                        : { ok: false, error: result.error };
                    })
                  }
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy || researching}
                  onClick={() =>
                    run("Reopened.", async () => {
                      const result = await reopenQuestion(question.id);
                      return result.ok
                        ? { ok: true }
                        : { ok: false, error: result.error };
                    })
                  }
                >
                  Reopen
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function OpenQuestionsPanel({
  questions,
  schools,
}: {
  questions: ProfessorQuestion[];
  schools: ProfessorSchool[];
}) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [why, setWhy] = useState("");
  const [pending, startPending] = useTransition();
  const primary = schools.find((s) => s.isPrimary) ?? schools[0];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
          Open Questions
        </h2>
        <p className="mt-1 text-xs text-[var(--jos-muted)]">
          Research first. Confirm with a person when the finding still needs one.
        </p>
      </div>

      <ul className="space-y-2">
        {questions.map((q) => (
          <QuestionRow key={q.id} question={q} />
        ))}
      </ul>

      <form
        className="space-y-2 rounded-xl border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!question.trim()) return;
          startPending(async () => {
            const result = await addProfessorQuestion({
              question,
              whyItMatters: why,
              schoolId: primary?.id ?? null,
            });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            setQuestion("");
            setWhy("");
            toast.success("Question added.");
            router.refresh();
          });
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
          Add a question
        </p>
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Question"
          rows={2}
          className="text-sm"
          required
        />
        <Textarea
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="Why it matters"
          rows={2}
          className="text-sm"
        />
        <Button type="submit" size="sm" disabled={pending || !question.trim()}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Add question
        </Button>
      </form>
    </section>
  );
}
