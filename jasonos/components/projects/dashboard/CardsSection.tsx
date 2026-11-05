"use client";

import { useState } from "react";
import type { Likelihood, Section } from "@/lib/dashboard/schema";
import { LikelihoodPill } from "./LikelihoodPill";
import { SectionHeading } from "./section-heading";
import styles from "./dashboard.module.css";

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
  return (
    <div className={styles.column}>
      <div className={styles.columnLabel}>{column.label}</div>
      {column.kind === "list" ? (
        <ul className={styles.list}>
          {(column.items ?? []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {column.kind === "text" ? <p className={styles.text}>{column.text}</p> : null}
      {column.kind === "basis" ? <p className={styles.basis}>{column.text}</p> : null}
    </div>
  );
}

function Halves({ columns }: { columns: Card["columns"] }) {
  const mid = Math.ceil(columns.length / 2);
  const halves = [columns.slice(0, mid), columns.slice(mid)].filter((half) => half.length > 0);
  return (
    <div className={styles.columns}>
      {halves.map((half) => (
        <div key={half[0]?.label}>
          {half.map((column) => (
            <Column key={column.label} column={column} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardsSection({ section }: { section: Cards }) {
  const [filter, setFilter] = useState<Filter>("all");
  const filtering = section.filterBy === "likelihood";
  const cards =
    !filtering || filter === "all"
      ? section.cards
      : section.cards.filter((card) => card.likelihood === filter);

  return (
    <section id={section.id} className={styles.section}>
      <div className={styles.sectionBar}>
        <SectionHeading className={styles.headingInline}>{section.heading}</SectionHeading>
        {filtering ? (
          <div className={styles.filters} role="group" aria-label="Filter by likelihood">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={styles.chip}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className={styles.cards}>
        {cards.map((card) => (
          <article key={card.id} id={card.id} className={styles.card}>
            <header className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>
                  {card.num != null ? <span className={styles.num}>{card.num}</span> : null}
                  {card.title}
                </h3>
                {card.lead ? <p className={styles.lead}>Lead: {card.lead}</p> : null}
              </div>
              {card.likelihood ? <LikelihoodPill likelihood={card.likelihood} /> : null}
            </header>
            <hr className={styles.rule} />
            <Halves columns={card.columns} />
          </article>
        ))}
        {cards.length === 0 ? <p className={styles.empty}>None in this group.</p> : null}
      </div>
      {section.legend ? <p className={styles.legend}>{section.legend}</p> : null}
    </section>
  );
}
