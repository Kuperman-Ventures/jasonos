import { InitiativeDashboard } from "@/components/jasonos/initiative-dashboard";
import { Plan90Roadmap } from "@/components/jasonos/plan90-roadmap";

export const metadata = { title: "To-Dos · JasonOS" };

export default function TodosPage() {
  return (
    <div className="mx-auto max-w-[1800px] space-y-4 px-4 py-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-domain-todo">
          To-do
        </p>
        <h1 className="text-xl font-semibold tracking-tight">To-Dos</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          90-Day Plan up top, then the full Initiative backlog. Checkbox state persists
          locally to your browser.
        </p>
      </header>

      <Plan90Roadmap />
      <InitiativeDashboard />
    </div>
  );
}
