import { DecisionCard } from "@/components/jasonos/fuck-you-batman/decision-card";
import { loadFybDecisions } from "@/lib/server-actions/fuck-you-batman";

export const metadata = {
  title: "Decisions · Fuck You Batman · JasonOS",
  description: "Open and recorded story decisions for Fuck You Batman.",
};

export const dynamic = "force-dynamic";

export default async function FuckYouBatmanDecisionsPage() {
  const decisions = await loadFybDecisions();
  const open = decisions.filter((d) => d.status === "open");
  const decided = decisions
    .filter((d) => d.status === "decided")
    .slice()
    .sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? ""));

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

      {open.map((decision) => (
        <DecisionCard key={decision.id} decision={decision} />
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
