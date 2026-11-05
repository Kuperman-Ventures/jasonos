import { LikelihoodPill } from "@/components/projects/oversight-agenda/LikelihoodPill";
import type { OversightArea } from "@/lib/projects/oversight-agenda/data";

export function AreaCard({ area }: { area: OversightArea }) {
  return (
    <article className="min-w-0 rounded-xl border bg-card p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold tracking-tight break-words">
            {area.num}. {area.title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed break-words text-muted-foreground">
            Lead: {area.lead}
          </p>
        </div>
        <LikelihoodPill likelihood={area.likelihood} />
      </header>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Target areas
            </h4>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed">
              {area.targets.map((target) => (
                <li key={target} className="break-words">
                  {target}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              What could slow it
            </h4>
            <p className="mt-1.5 text-xs leading-relaxed break-words">{area.blockers}</p>
          </div>
        </div>
        <div className="min-w-0 space-y-3">
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Next steps
            </h4>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed">
              {area.nextSteps.map((step) => (
                <li key={step} className="break-words">
                  {step}
                </li>
              ))}
            </ul>
          </div>
          <div className="border-l-2 border-[var(--jos-line)] pl-3">
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Basis for the rating
            </h4>
            <p className="mt-1.5 text-xs leading-relaxed break-words">{area.basis}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
