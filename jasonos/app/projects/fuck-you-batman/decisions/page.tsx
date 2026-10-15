import { DecisionCard } from "@/components/jasonos/fuck-you-batman/decision-card";
import { weekNumber } from "@/lib/fuck-you-batman/plan";
import { loadFybDecisions } from "@/lib/server-actions/fuck-you-batman";

export const metadata = {
  title: "Decisions · Fuck You Batman · JasonOS",
  description: "Open and recorded story decisions for Fuck You Batman.",
};

export const dynamic = "force-dynamic";

export default async function FuckYouBatmanDecisionsPage() {
  const decisions = await loadFybDecisions();
  const week = weekNumber();
  const open = decisions
    .filter((d) => d.status === "open")
    .slice()
    .sort((a, b) => a.week - b.week || a.sort_order - b.sort_order);
  const decided = decisions
    .filter((d) => d.status === "decided")
    .slice()
    .sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? ""));
  const thisWeek = decisions.filter((d) => d.week === week);
  const decidedThisWeek = thisWeek.filter((d) => d.status === "decided").length;

  return (
    <>
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Fuck You Batman
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Decisions</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Open calls first. Record a pick here, or tell Claude in chat and it will write it back.
        </p>
      </header>

      {open.length === 0 && decided.length === 0 ? (
        <section className="rounded-xl border bg-card p-4">
          <p className="text-sm text-foreground/80">No decisions published yet.</p>
        </section>
      ) : null}

      {open.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          This week: {decidedThisWeek} of {thisWeek.length} decided.
        </p>
      ) : null}

      {open.map((decision, index) => (
        <DecisionCard
          key={decision.id}
          decision={decision}
          stepIndex={index + 1}
          stepTotal={open.length}
        />
      ))}

      {decided.length > 0 ? (
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Decided
        </h2>
      ) : null}

      {decided.map((decision) => (
        <DecisionCard key={decision.id} decision={decision} />
      ))}
    </>
  );
}
