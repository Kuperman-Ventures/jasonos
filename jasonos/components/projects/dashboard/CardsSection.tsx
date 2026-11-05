"use client";

import { useState } from "react";
import type { Likelihood, Section } from "@/lib/dashboard/schema";
import { LikelihoodPill } from "./LikelihoodPill";
import { SectionHeading } from "./section-heading";

type Cards = Extract<Section, { type: "cards" }>;
type Card = Cards["cards"][number];
type Filter = "all" | Likelihood;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

function Column({ column }: { column: Card["columns"][number] }) {
  if (column.kind === "list") {
    return (
      <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed">
        {(column.items ?? []).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if (column.kind === "basis") {
    return (
      <p className="border-l-2 border-muted-foreground/40 pl-3 text-xs leading-relaxed text-muted-foreground">
        {column.text}
      </p>
    );
  }
  return <p className="text-xs leading-relaxed">{column.text}</p>;
}

export function CardsSection({ section }: { section: Cards }) {
  const [filter, setFilter] = useState<Filter>("all");
  const filtering = section.filterBy === "likelihood";
  const cards =
    !filtering || filter === "all"
      ? section.cards
      : section.cards.filter((card) => card.likelihood === filter);

  return (
    <section id={section.id} className="scroll-mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <SectionHeading className="mb-0">{section.heading}</SectionHeading>
        {filtering ? (
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by likelihood">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                  filter === item.id
                    ? "border-foreground bg-foreground text-background"
                    : "bg-card text-muted-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="space-y-3">
        {cards.map((card) => (
          <article key={card.id} id={card.id} className="scroll-mt-6 rounded-xl border bg-card p-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold tracking-tight">
                  {card.num != null ? <span className="mr-2 tabular-nums">{card.num}</span> : null}
                  {card.title}
                </h3>
                {card.lead ? (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Lead: {card.lead}
                  </p>
                ) : null}
              </div>
              {card.likelihood ? <LikelihoodPill likelihood={card.likelihood} /> : null}
            </header>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {card.columns.map((column) => (
                <div key={column.label} className="min-w-0">
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {column.label}
                  </div>
                  <Column column={column} />
                </div>
              ))}
            </div>
          </article>
        ))}
        {cards.length === 0 ? (
          <p className="text-xs text-muted-foreground">None in this group.</p>
        ) : null}
      </div>
      {section.legend ? (
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          {section.legend}
        </p>
      ) : null}
    </section>
  );
}
