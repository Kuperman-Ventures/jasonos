"use client";

import { useState } from "react";
import type { Likelihood, Section } from "@/lib/dashboard/schema";
import { LIKELIHOOD_TONE, LikelihoodPill } from "./LikelihoodPill";
import { useDashboardFilter, type DashboardFilter } from "./DashboardFilterContext";
import { MobileCollapse } from "./MobileCollapse";
import { SectionHeading } from "./section-heading";
import { TableSection } from "./TableSection";
import { TilesSection } from "./TilesSection";
import styles from "./dashboard.module.css";

type Cards = Extract<Section, { type: "cards" }>;
type Card = Cards["cards"][number];
type AppendixSection = Extract<Section, { type: "tiles" | "table" }>;

const FILTERS: { id: DashboardFilter; label: (total: number) => string }[] = [
  { id: "all", label: (total) => `All ${total}` },
  { id: "high", label: () => "High likelihood" },
  { id: "medium", label: () => "Medium" },
  { id: "low", label: () => "Low" },
];

function ColumnBlock({ column, likelihood }: { column: Card["columns"][number]; likelihood?: Likelihood }) {
  return (
    <div className={styles.columnBlock}>
      <h4 className={styles.columnLabel}>{column.label}</h4>
      {column.kind === "list" ? (
        <ul className={styles.list}>
          {(column.items ?? []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {column.kind === "text" ? <p className={styles.columnText}>{column.text}</p> : null}
      {column.kind === "basis" ? (
        <p
          className={styles.basis}
          style={likelihood ? { borderColor: LIKELIHOOD_TONE[likelihood].fg } : undefined}
        >
          {column.text}
        </p>
      ) : null}
    </div>
  );
}

function Halves({ card }: { card: Card }) {
  const mid = Math.ceil(card.columns.length / 2);
  const halves = [card.columns.slice(0, mid), card.columns.slice(mid)].filter((half) => half.length > 0);
  return (
    <div className={styles.cardBody}>
      {halves.map((half, index) => (
        <div key={half[0]?.label ?? index} className={styles.column}>
          {half.map((column) => (
            <ColumnBlock key={column.label} column={column} likelihood={card.likelihood} />
          ))}
        </div>
      ))}
    </div>
  );
}

function CardAppendix({ appendix }: { appendix: AppendixSection[] }) {
  if (!appendix.length) return null;
  return (
    <>
      {appendix.map((section) => (
        <div key={section.id} id={section.id} className={styles.cardAppendix}>
          {section.type === "tiles" ? <TilesSection section={section} /> : <TableSection section={section} />}
        </div>
      ))}
    </>
  );
}

export function CardsSection({
  section,
  appendix = [],
}: {
  section: Cards;
  appendix?: AppendixSection[];
  updatedOn?: string;
}) {
  const shared = useDashboardFilter();
  const linked = section.filterBy === "likelihood" && shared?.sectionId === section.id;
  const [local, setLocal] = useState<DashboardFilter>("all");
  const filter = linked && shared ? shared.filter : local;
  const setFilter = linked && shared ? shared.setFilter : setLocal;
  const shown = filter === "all" ? section.cards : section.cards.filter((card) => card.likelihood === filter);
  const host = section.cards[section.cards.length - 1];
  const hostVisible = Boolean(host && shown.some((card) => card.id === host.id));
  const total = section.cards.length;
  const summary = `${total} ${total === 1 ? "area" : "areas"}`;
  const filters =
    section.filterBy === "likelihood" ? (
      <div role="group" aria-label="Filter by likelihood" className={styles.filters}>
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={styles.filterButton}
          >
            {item.label(section.cards.length)}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <MobileCollapse
      title={section.heading}
      summary={summary}
      desktopHeading={
        <div className={styles.filterRow}>
          <SectionHeading>{section.heading}</SectionHeading>
          {filters}
        </div>
      }
    >
      {filters ? <div className={styles.mobileFilters}>{filters}</div> : null}
      <div className={styles.cards}>
        {shown.map((card) => (
          <article key={card.id} className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardIdentity}>
                {card.num != null ? <div className={styles.cardNum}>{card.num}</div> : null}
                <div>
                  <h3 className={styles.cardTitle}>{card.title}</h3>
                  {card.lead ? (
                    <p className={styles.lead}>
                      <strong>Lead:</strong> {card.lead}
                    </p>
                  ) : null}
                </div>
              </div>
              {card.likelihood ? <LikelihoodPill likelihood={card.likelihood} /> : null}
            </div>
            <Halves card={card} />
            {host && card.id === host.id ? <CardAppendix appendix={appendix} /> : null}
          </article>
        ))}
        {!hostVisible && appendix.length ? (
          <article className={styles.card}>
            <CardAppendix appendix={appendix} />
          </article>
        ) : null}
      </div>
      {section.legend ? <p className={styles.legend}>{section.legend}</p> : null}
    </MobileCollapse>
  );
}
