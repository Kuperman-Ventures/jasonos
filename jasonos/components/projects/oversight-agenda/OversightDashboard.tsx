"use client";

import { useEffect, useState } from "react";
import { AreaList } from "@/components/projects/oversight-agenda/AreaList";
import { NewsList } from "@/components/projects/oversight-agenda/NewsList";
import { OversightMark } from "@/components/projects/oversight-agenda/OversightMark";
import { Timeline } from "@/components/projects/oversight-agenda/Timeline";
import {
  areas,
  impeachmentMath,
  likelihoodLegend,
  sources,
  updatedOn,
  type Likelihood,
} from "@/lib/projects/oversight-agenda/data";
import { countNote, type NewsCard, type TimelineView } from "@/lib/projects/oversight-agenda/view";
import { cn } from "@/lib/utils";

const mono = "[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]";

export default function OversightDashboard({
  news,
  timeline,
}: {
  news: NewsCard[];
  timeline: TimelineView;
}) {
  const [filter, setFilter] = useState<"all" | Likelihood>("all");
  const target =
    filter === "all" ? areas.length : areas.filter((area) => area.likelihood === filter).length;
  const [count, setCount] = useState(areas.length);

  useEffect(() => {
    if (count === target) return;
    const id = window.setInterval(() => {
      setCount((current) =>
        current === target ? current : current + (target > current ? 1 : -1)
      );
    }, 220);
    return () => window.clearInterval(id);
  }, [count, target]);

  return (
    <div className="mx-auto max-w-[1280px] overflow-x-clip px-[clamp(16px,4vw,48px)] pb-24 text-[var(--color-text)]">
      <header className="grid items-end gap-6 py-10 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))] md:pt-14 md:pb-10">
        <div>
          <div className="mb-7 flex items-center gap-5">
            <OversightMark />
            <div className="text-[clamp(28px,4.5vw,52px)] font-extrabold leading-[0.95] tracking-[-0.01em] uppercase">
              Oversight
              <br />
              Agenda
              <br />
              <span className="text-[var(--color-accent-700)]">Dashboard</span>
            </div>
          </div>
          <div className="text-[13px] font-semibold tracking-[0.12em] text-[var(--color-neutral-700)] uppercase">
            120th Congress
          </div>
        </div>
        <div className="max-w-[420px]">
          <div className="mb-3 flex items-end gap-4">
            <div className="min-w-[0.6em] text-[clamp(88px,12vw,144px)] font-extrabold leading-[0.8] tracking-[-0.05em] text-[var(--color-accent)] tabular-nums">
              {count}
            </div>
            <div className="pb-1 text-[13px] font-bold leading-snug tracking-[0.1em] uppercase">
              Investigations
              <br />
              in process
              <br />
              or on deck
            </div>
          </div>
          <div className="mb-3 text-sm text-[var(--color-neutral-700)]">{countNote(filter)}</div>
          <div className={`${mono} text-[13px] text-[var(--color-neutral-600)]`}>
            Updated {updatedOn}
          </div>
        </div>
      </header>

      <NewsList items={news} updatedOn={updatedOn} />
      <Timeline view={timeline} />

      <section className="border-b-2 border-[var(--color-divider)] py-14">
        <AreaList areas={areas} filter={filter} onFilter={setFilter} />
        <p className="mt-8 max-w-[820px] text-sm leading-relaxed text-[var(--color-neutral-700)]">
          {likelihoodLegend}
        </p>
      </section>

      <section className="border-b-2 border-[var(--color-divider)] py-14">
        <h2 className="m-0 mb-8 text-[32px] font-extrabold tracking-[-0.02em]">Impeachment Math</h2>
        <div className="grid border-t border-[var(--color-neutral-300)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
          {impeachmentMath.map((tile) => {
            const numeric = /^\d+$/.test(tile.value);
            return (
              <div key={tile.label} className="min-w-0 pt-6 pr-6">
                <div className="text-xs font-semibold tracking-[0.1em] text-[var(--color-neutral-600)] uppercase">
                  {tile.label}
                </div>
                <div
                  className={cn(
                    mono,
                    "my-3 font-bold leading-none break-words",
                    numeric ? "text-[56px]" : "text-[22px]"
                  )}
                >
                  {tile.value}
                </div>
                <div className="text-sm leading-normal break-words text-[var(--color-neutral-700)]">
                  {tile.note}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="pt-14">
        <h2 className="m-0 mb-6 text-[32px] font-extrabold tracking-[-0.02em]">Sources</h2>
        <ol className="flex list-decimal flex-col gap-2.5 pl-6 text-[15px] leading-normal">
          {sources.map((source) => (
            <li key={source.url} className="min-w-0 break-words">
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title}
              </a>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
