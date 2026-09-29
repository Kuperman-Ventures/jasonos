import { Sparkles } from "lucide-react";
import { format } from "date-fns";
import { EmptyState } from "./empty-state";

export function DailyWrap() {
  const today = format(new Date(), "EEEE, MMM d");
  return (
    <section className="rounded-xl border bg-card p-4">
      <header className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-rung-ink" />
        <h2 className="text-sm font-semibold tracking-tight">Daily Wrap</h2>
        <span className="text-[11px] text-muted-foreground">· {today} · auto-generated 6pm</span>
      </header>
      <EmptyState
        title="No daily wrap yet"
        hint="Generated automatically each evening from your activity once the review job has run."
        size="md"
        className="mt-3"
      />
    </section>
  );
}
