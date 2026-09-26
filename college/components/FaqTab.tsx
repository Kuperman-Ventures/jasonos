"use client";

import { useState } from "react";
import type { FaqCategory } from "@/lib/types";

export function FaqTab({ categories, dateline }: { categories: FaqCategory[]; dateline: string }) {
  const [openPhase, setOpenPhase] = useState<Record<number, boolean>>({});
  const [openQuestion, setOpenQuestion] = useState<Record<string, boolean>>({});

  return (
    <section>
      <header className="page-head">
        <div>
          <div className="dateline">{dateline}</div>
          <h2>Frequently Asked Questions</h2>
        </div>
      </header>
      <p className="section-sub">
        The questions families most commonly ask during the college search and application process, organized by
        phase. Tap a question to expand the answer.
      </p>
      {categories.map((category, index) => (
        <div key={category.cat} className={openPhase[index] ? "phase expanded" : "phase"}>
          <div className="phase-head" onClick={() => setOpenPhase((prev) => ({ ...prev, [index]: !prev[index] }))}>
            <span className="phase-num mono">{index + 1}</span>
            <h2>{category.cat}</h2>
            <span className="phase-progress">
              {category.items.length} {category.items.length === 1 ? "question" : "questions"}
            </span>
          </div>
          <div className="phase-body">
            {category.items.map((item) => {
              const key = `${category.cat}:${item.q}`;
              const open = Boolean(openQuestion[key]);
              return (
                <div key={key} className={open ? "faq-item open" : "faq-item"}>
                  <button type="button" className="faq-q" onClick={() => setOpenQuestion((prev) => ({ ...prev, [key]: !prev[key] }))}>
                    <span>{item.q}</span>
                    <span className="chev mono">›</span>
                  </button>
                  <div className="faq-a">{item.a}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
