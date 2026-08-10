"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Loader2,
  MessageSquareQuote,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  generateInterviewPrep,
  type InterviewTarget,
} from "@/lib/server-actions/interview-prep";
import type { InterviewPrep } from "@/lib/interview-prep/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function targetLabel(t: InterviewTarget): string {
  const company = t.company?.trim() || "Unknown company";
  const role = t.roleTitle?.trim();
  return role ? `${company} · ${role}` : company;
}

export function InterviewPrepClient({
  targets: initialTargets,
}: {
  targets: InterviewTarget[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialTargets[0]?.id ?? null
  );
  const [prep, setPrep] = useState<InterviewPrep | null>(null);
  const [prepForId, setPrepForId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selected = useMemo(
    () => initialTargets.find((t) => t.id === selectedId) ?? null,
    [initialTargets, selectedId]
  );

  function runPrep() {
    if (!selectedId) {
      toast.error("Pick a role first.");
      return;
    }
    startTransition(async () => {
      const result = await generateInterviewPrep({ customizationId: selectedId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPrep(result.prep);
      setPrepForId(selectedId);
      toast.success("Interview prep ready.");
    });
  }

  const showingPrep = prep && prepForId === selectedId ? prep : null;

  return (
    <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-6 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
      <aside className="space-y-3">
        <header>
          <h1 className="text-lg font-semibold tracking-tight">Interview Prep</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick a job you already ran through Resume Customizer. We read that JD
            and the tailored resume, then surface likely questions, gaps, and
            points to highlight.
          </p>
        </header>

        {initialTargets.length === 0 ? (
          <div className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No customized roles with job descriptions yet. Customize a resume for
            a JD first, then come back here.
          </div>
        ) : (
          <ul className="max-h-[min(70vh,640px)] space-y-1 overflow-y-auto rounded-xl border bg-card/40 p-1.5">
            {initialTargets.map((t) => {
              const active = t.id === selectedId;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <div className="text-sm font-medium leading-snug text-foreground">
                      {targetLabel(t)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>{formatDate(t.createdAt)}</span>
                      {t.version != null ? <span>v{t.version}</span> : null}
                      {t.matchScore != null ? (
                        <span className="tabular-nums">{t.matchScore}% match</span>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <Button
          onClick={runPrep}
          disabled={!selected || isPending}
          className="w-full gap-1.5"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Scanning JD + resume…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate prep
            </>
          )}
        </Button>
      </aside>

      <section className="min-w-0 space-y-4">
        {!selected ? (
          <EmptyState message="Select a customized role to get started." />
        ) : isPending && !showingPrep ? (
          <EmptyState message="Reading the job description and tailored resume…" />
        ) : !showingPrep ? (
          <EmptyState
            message={`Ready for ${targetLabel(selected)}. Hit Generate prep when you want the brief.`}
          />
        ) : (
          <PrepResults prep={showingPrep} />
        )}
      </section>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed bg-card/30 px-6 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function PrepResults({ prep }: { prep: InterviewPrep }) {
  const title = [prep.company, prep.roleTitle].filter(Boolean).join(" · ");

  return (
    <div className="space-y-5">
      <header className="space-y-2 border-b pb-4">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{prep.framing}</p>
      </header>

      <PrepSection
        icon={MessageSquareQuote}
        title="Questions about your background"
        subtitle="Likely digs into experience that maps to this role."
        tone="sky"
      >
        {prep.backgroundQuestions.map((q, i) => (
          <PrepItem
            key={`bg-${i}`}
            title={q.question}
            why={q.why}
            actionLabel="Lean on"
            action={q.angle}
          />
        ))}
      </PrepSection>

      <PrepSection
        icon={AlertTriangle}
        title="Gaps they may probe"
        subtitle="Where the JD asks for something that looks thin or missing on the resume."
        tone="amber"
      >
        {prep.gapQuestions.map((q, i) => (
          <PrepItem
            key={`gap-${i}`}
            title={q.question}
            why={q.why}
            actionLabel="Handle it"
            action={q.angle}
          />
        ))}
      </PrepSection>

      <PrepSection
        icon={Target}
        title="Bring these up"
        subtitle="Resume points worth highlighting for this company and seat."
        tone="emerald"
      >
        {prep.highlights.map((h, i) => (
          <PrepItem
            key={`hi-${i}`}
            title={h.point}
            why={h.why}
            actionLabel="On resume"
            action={h.whereOnResume}
          />
        ))}
      </PrepSection>
    </div>
  );
}

function PrepSection({
  icon: Icon,
  title,
  subtitle,
  tone,
  children,
}: {
  icon: typeof CheckCircle2;
  title: string;
  subtitle: string;
  tone: "sky" | "amber" | "emerald";
  children: ReactNode;
}) {
  const toneClass =
    tone === "sky"
      ? "text-sky-300"
      : tone === "amber"
        ? "text-amber-300"
        : "text-emerald-300";

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", toneClass)} />
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function PrepItem({
  title,
  why,
  actionLabel,
  action,
}: {
  title: string;
  why: string;
  actionLabel: string;
  action: string;
}) {
  return (
    <li className="rounded-xl border bg-card/50 px-3.5 py-3">
      <p className="text-sm font-medium leading-snug">{title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{why}</p>
      <p className="mt-2 text-xs leading-relaxed">
        <span className="text-muted-foreground">{actionLabel}: </span>
        <span className="text-foreground/90">{action}</span>
      </p>
    </li>
  );
}
