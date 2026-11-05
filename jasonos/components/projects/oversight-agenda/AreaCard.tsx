import { LikelihoodPill, likelihoodTone } from "@/components/projects/oversight-agenda/LikelihoodPill";
import type { OversightArea } from "@/lib/projects/oversight-agenda/data";

export function AreaCard({ area }: { area: OversightArea }) {
  const tone = likelihoodTone(area.likelihood);
  return (
    <article className="min-w-0 border-2 border-[var(--color-text)] bg-[var(--color-surface)]">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b-2 border-[var(--color-text)] p-6">
        <div className="flex min-w-0 flex-[1_1_320px] gap-5">
          <div className="min-w-10 text-[56px] font-extrabold leading-[0.9] text-[var(--color-accent)]">
            {area.num}
          </div>
          <div className="min-w-0">
            <h3 className="m-0 mb-2 text-[26px] font-extrabold leading-[1.1] tracking-[-0.01em] break-words">
              {area.title}
            </h3>
            <p className="text-sm leading-snug break-words text-[var(--color-neutral-700)]">
              <strong className="text-[var(--color-text)]">Lead:</strong> {area.lead}
            </p>
          </div>
        </div>
        <LikelihoodPill likelihood={area.likelihood} />
      </div>
      <div className="grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
        <div className="min-w-0 border-r border-[var(--color-neutral-300)] p-6">
          <h4 className="mb-3 text-xs font-bold tracking-[0.1em] uppercase">Target areas</h4>
          <ul className="mb-6 flex list-disc flex-col gap-1.5 pl-[18px] text-[15px] leading-normal">
            {area.targets.map((target) => (
              <li key={target} className="break-words">
                {target}
              </li>
            ))}
          </ul>
          <h4 className="mb-2 text-xs font-bold tracking-[0.1em] uppercase">What could slow it</h4>
          <p className="m-0 text-[15px] leading-normal break-words text-[var(--color-neutral-800)]">
            {area.blockers}
          </p>
        </div>
        <div className="min-w-0 bg-[var(--color-neutral-100)] p-6">
          <h4 className="mb-3 text-xs font-bold tracking-[0.1em] uppercase">Next steps</h4>
          <ul className="mb-6 flex list-disc flex-col gap-1.5 pl-[18px] text-[15px] leading-normal">
            {area.nextSteps.map((step) => (
              <li key={step} className="break-words">
                {step}
              </li>
            ))}
          </ul>
          <h4 className="mb-2 text-xs font-bold tracking-[0.1em] uppercase">Basis for the rating</h4>
          <p
            className="m-0 border-l-4 pl-3.5 text-[15px] leading-normal break-words text-[var(--color-neutral-800)]"
            style={{ borderColor: tone.fg }}
          >
            {area.basis}
          </p>
        </div>
      </div>
    </article>
  );
}
