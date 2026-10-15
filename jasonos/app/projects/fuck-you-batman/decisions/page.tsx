import { DecisionCard } from "@/components/jasonos/fuck-you-batman/decision-card";
import {
  QUESTION_SETS,
  isQuestion,
  questionSet,
  setProgress,
} from "@/lib/fuck-you-batman/process";
import type { FybDecision } from "@/lib/fuck-you-batman/types";
import { loadFybDecisions } from "@/lib/server-actions/fuck-you-batman";

export const metadata = {
  title: "Decisions · Fuck You Batman · JasonOS",
  description: "Open and recorded story decisions for Fuck You Batman.",
};

export const dynamic = "force-dynamic";

function bySortOrder(a: FybDecision, b: FybDecision) {
  return a.sort_order - b.sort_order || a.decision_key.localeCompare(b.decision_key);
}

export default async function FuckYouBatmanDecisionsPage() {
  const decisions = await loadFybDecisions();
  const questionCards = decisions.filter(isQuestion);
  const other = decisions.filter((d) => !isQuestion(d));
  const otherOpen = other
    .filter((d) => d.status === "open")
    .slice()
    .sort((a, b) => a.week - b.week || a.sort_order - b.sort_order);
  const otherDecided = other
    .filter((d) => d.status === "decided")
    .slice()
    .sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? ""));

  const sets = Object.keys(QUESTION_SETS)
    .map((set) => {
      const cards = questionCards.filter((d) => questionSet(d) === set).slice().sort(bySortOrder);
      return { set, label: QUESTION_SETS[set], cards, progress: setProgress(decisions, set) };
    })
    .filter((group) => group.cards.length > 0);

  const empty = sets.length === 0 && otherOpen.length === 0 && otherDecided.length === 0;

  return (
    <>
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Fuck You Batman
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Decisions</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Questions first, grouped by topic. Answer in your own words. Recorded decisions are below.
        </p>
      </header>

      {empty ? (
        <section className="rounded-xl border bg-card p-4">
          <p className="text-sm text-foreground/80">No decisions published yet.</p>
        </section>
      ) : null}

      {sets.map((group) => {
        const open = group.cards.filter((d) => d.status === "open");
        const answered = group.cards.filter((d) => d.status === "decided");
        return (
          <section key={group.set} className="space-y-3">
            <div id={`set-${group.set}`} className="flex scroll-mt-20 items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold">{group.label}</h2>
              <p className="num-mono shrink-0 text-[11px] text-muted-foreground">
                {group.progress.answered} of {group.progress.total} answered
              </p>
            </div>
            {open.map((decision) => {
              const stepIndex = group.cards.findIndex((card) => card.id === decision.id) + 1;
              return (
                <DecisionCard
                  key={decision.id}
                  decision={decision}
                  stepIndex={stepIndex}
                  stepTotal={group.cards.length}
                />
              );
            })}
            {answered.length > 0 ? (
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Show {answered.length} answered
                </summary>
                <div className="mt-3 space-y-3">
                  {answered.map((decision) => (
                    <DecisionCard key={decision.id} decision={decision} />
                  ))}
                </div>
              </details>
            ) : null}
          </section>
        );
      })}

      {otherOpen.length > 0 || otherDecided.length > 0 ? (
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Other Decisions
        </h2>
      ) : null}

      {otherOpen.map((decision) => (
        <DecisionCard key={decision.id} decision={decision} />
      ))}

      {otherDecided.map((decision) => (
        <DecisionCard key={decision.id} decision={decision} />
      ))}
    </>
  );
}
