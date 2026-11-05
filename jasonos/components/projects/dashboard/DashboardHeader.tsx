"use client";

import { useEffect, useState } from "react";
import type { DashboardDocument, Likelihood } from "@/lib/dashboard/schema";
import { countNote, counterLines } from "@/lib/dashboard/present";
import { DashboardMark } from "./DashboardMark";
import { useDashboardFilter } from "./DashboardFilterContext";
import styles from "./dashboard.module.css";

function visibleCount(document: DashboardDocument, filter: "all" | Likelihood, sectionId: string) {
  const cards = document.sections.find((section) => section.type === "cards" && section.id === sectionId);
  if (!cards || cards.type !== "cards") return 0;
  if (filter === "all") return cards.cards.length;
  return cards.cards.filter((card) => card.likelihood === filter).length;
}

export function DashboardHeader({ document }: { document: DashboardDocument }) {
  const shared = useDashboardFilter();
  const counter = document.header?.counter;
  const filter = shared?.filter ?? "all";
  const total = counter ? visibleCount(document, "all", counter.sectionId) : 0;
  const target = counter ? visibleCount(document, filter, counter.sectionId) : 0;
  const [count, setCount] = useState(total);
  const words = document.title.trim().split(/\s+/).filter(Boolean);
  const last = words[words.length - 1] ?? "";
  const lead = words.slice(0, -1);

  useEffect(() => {
    if (count === target) return;
    const id = window.setInterval(() => {
      setCount((current) => (current === target ? current : current + (target > current ? 1 : -1)));
    }, 220);
    return () => window.clearInterval(id);
  }, [count, target]);

  return (
    <header className={styles.header}>
      <div>
        <div className={styles.brand}>
          <DashboardMark />
          <h1 className={styles.title}>
            {lead.map((word, index) => (
              <span key={`${word}-${index}`}>
                {word}
                <br />
              </span>
            ))}
            <span className={styles.titleAccent}>{last}</span>
          </h1>
        </div>
        {document.header?.eyebrow ? <p className={styles.eyebrow}>{document.header.eyebrow}</p> : null}
      </div>
      {counter ? (
        <div className={styles.counter}>
          <div className={styles.counterRow}>
            <div className={styles.count}>{count}</div>
            <p className={styles.counterLabel}>
              {counterLines(counter.label).map((line, index) => (
                <span key={line}>
                  {index > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </p>
          </div>
          <p className={styles.countNote}>{countNote(filter, total)}</p>
          <p className={styles.updated}>Updated {document.updatedOn}</p>
        </div>
      ) : null}
    </header>
  );
}
