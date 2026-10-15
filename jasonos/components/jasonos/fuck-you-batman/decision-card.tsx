"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chosenAnswerLabel } from "@/lib/fuck-you-batman/logic";
import { displayQuestion, isProvisional } from "@/lib/fuck-you-batman/process";
import type { FybDecision } from "@/lib/fuck-you-batman/types";
import {
  chooseCustom,
  chooseOption,
  reopenDecision,
} from "@/lib/server-actions/fuck-you-batman";
import { cn } from "@/lib/utils";

function decidedDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const markdownComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mt-1 text-sm leading-relaxed text-foreground/80">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-foreground/80">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-sm text-foreground/80">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li>{children}</li>,
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
};

export function DecisionCard({
  decision,
  stepIndex,
  stepTotal,
}: {
  decision: FybDecision;
  stepIndex?: number;
  stepTotal?: number;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const question = displayQuestion(decision);

  if (decision.status === "decided") {
    const date = decidedDate(decision.decided_at);
    return (
      <section id={decision.decision_key} className="scroll-mt-20 rounded-xl border bg-card p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Decided{date ? ` · ${date}` : ""}
        </p>
        <h2 className="mt-1 text-sm font-semibold">
          {question}
          {isProvisional(decision) ? (
            <span className="ml-1 rounded-full border px-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              Provisional
            </span>
          ) : null}
        </h2>
        <p className="mt-2 text-sm text-foreground/80">
          <span className="font-semibold text-foreground">Answer: </span>
          {chosenAnswerLabel(decision) || "(none)"}
        </p>
        {decision.jason_note ? (
          <p className="mt-2 text-xs text-muted-foreground">{decision.jason_note}</p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm("Reopen this decision? The recorded answer stays in history only until you pick again.")) {
              return;
            }
            setBusy(true);
            const result = await reopenDecision(decision.decision_key);
            setBusy(false);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Decision reopened.");
            router.refresh();
          }}
        >
          Reopen
        </Button>
      </section>
    );
  }

  const record = async () => {
    if (!picked) {
      toast.error("Pick an option, or write your own answer.");
      return;
    }
    if (picked === "custom" && !custom.trim()) {
      toast.error("Write your own answer, or pick one of the options.");
      return;
    }
    setBusy(true);
    const result =
      picked === "custom"
        ? await chooseCustom(decision.decision_key, custom, note)
        : await chooseOption(decision.decision_key, picked, note);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      stepTotal != null && stepTotal > 1
        ? "Decision recorded. Next one is at the top."
        : "Decision recorded."
    );
    router.refresh();
  };

  return (
    <section id={decision.decision_key} className="scroll-mt-20 rounded-xl border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {stepIndex != null && stepTotal != null
          ? `Step ${stepIndex} of ${stepTotal} · Week ${decision.week} · Phase ${decision.phase}`
          : `Week ${decision.week} · Phase ${decision.phase}`}
      </p>
      <h2 className="mt-1 text-sm font-semibold">{question}</h2>
      {decision.context ? (
        <div className="mt-2">
          <ReactMarkdown components={markdownComponents}>{decision.context}</ReactMarkdown>
        </div>
      ) : null}

      <ul className="mt-3 space-y-2">
        {decision.options.map((option) => {
          const selected = picked === option.key;
          return (
            <li key={option.key}>
              <button
                type="button"
                onClick={() => setPicked(option.key)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  selected ? "border-foreground bg-background" : "border-border hover:border-foreground/40"
                )}
              >
                <p className="text-sm font-semibold">{option.label}</p>
                <p className="mt-1 text-xs text-foreground/80">{option.summary}</p>
                {option.strengths.length ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Strengths: {option.strengths.join("; ")}
                  </p>
                ) : null}
                {option.holes.length ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Holes: {option.holes.join("; ")}</p>
                ) : null}
              </button>
            </li>
          );
        })}
        <li>
          <div
            className={cn(
              "w-full rounded-lg border p-3 text-left transition-colors",
              picked === "custom" ? "border-foreground bg-background" : "border-border"
            )}
          >
            <button type="button" className="w-full text-left" onClick={() => setPicked("custom")}>
              <p className="text-sm font-semibold">My own answer</p>
            </button>
            <Textarea
              className="mt-2"
              rows={3}
              value={custom}
              placeholder="Write the call in your own words."
              onChange={(event) => {
                setCustom(event.target.value);
                setPicked("custom");
              }}
            />
          </div>
        </li>
      </ul>

      <label className="mt-3 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Note (optional)
        <Textarea
          className="mt-1"
          rows={2}
          value={note}
          placeholder="Why this one."
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <Button type="button" size="sm" className="mt-3" disabled={busy} onClick={record}>
        Record decision
      </Button>
    </section>
  );
}
