import { cn } from "@/lib/utils";
import { Delta } from "./track-pill";
import { EmptyState } from "./empty-state";
import type { CrossKpi } from "@/lib/data/dashboard";

export function CrossTrackKpis({
  kpis,
  className,
}: {
  kpis: CrossKpi[];
  className?: string;
}) {
  return (
    <section
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-4",
        className
      )}
    >
      {kpis.map((k) => (
        <div key={k.label} className="bg-card px-4 py-2.5" title={k.sourceNote}>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            {k.label}
            {k.source === "live" ? (
              <span className="inline-block h-1 w-1 rounded-full bg-rung-4" />
            ) : null}
          </div>
          {k.empty ? (
            <EmptyState title="No data yet" hint={k.hint} action={k.cta} size="sm" className="mt-2" />
          ) : (
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <div
                className={cn(
                  "num-mono text-lg font-semibold tracking-tight",
                  k.alarm && "text-rung-1"
                )}
              >
                {k.value}
              </div>
              <Delta value={k.delta} />
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
