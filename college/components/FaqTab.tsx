"use client";

import { useState } from "react";
import type { FaqCategory } from "@/lib/types";

function categorySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatQuestionNum(n: number): string {
  return String(n).padStart(2, "0");
}

function FaqQuestion({
  num,
  question,
  answer,
  open,
  onToggle,
}: {
  num: number;
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}) {
  const detailId = `faq-q-${num}-detail`;
  return (
    <div className={open ? "faq-q is-open" : "faq-q"}>
      <button
        type="button"
        className="faq-q-row"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={onToggle}
      >
        <span className="faq-q-num">{formatQuestionNum(num)}</span>
        <span className="faq-q-title">{question}</span>
      </button>
      <div className="faq-q-detail" id={detailId} hidden={!open}>
        <span />
        <div className="faq-q-body">
          <p>{answer}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqTab({ categories }: { categories: FaqCategory[]; dateline?: string }) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  let questionCounter = 0;
  const numbered = categories.map((category) => ({
    ...category,
    id: categorySlug(category.cat),
    items: category.items.map((item) => {
      questionCounter += 1;
      return { ...item, n: questionCounter };
    }),
  }));
  const totalQuestions = questionCounter;

  function toggle(key: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="faq-page">
      <header className="faq-head">
        <p className="faq-intro">
          The questions families most commonly ask during the college search and
          application process, organized by phase. Tap a question to expand the
          answer.
        </p>
        <nav className="faq-toc" aria-label="On this page">
          {numbered.map((category, index) => (
            <a
              key={category.id}
              className="faq-toc-item"
              href={`#faq-${category.id}`}
            >
              <span className="faq-toc-num">{formatQuestionNum(index + 1)}</span>
              <span className="faq-toc-name">{category.cat}</span>
              <span className="faq-toc-meta">
                {category.items.length}{" "}
                {category.items.length === 1 ? "question" : "questions"}
              </span>
            </a>
          ))}
        </nav>
        <p className="faq-count mono">
          {totalQuestions} questions · {categories.length} sections
        </p>
      </header>

      {numbered.map((category, index) => (
        <section
          key={category.id}
          id={`faq-${category.id}`}
          className="faq-section"
        >
          <div className="faq-sec-head">
            <span className="faq-label">
              Section {formatQuestionNum(index + 1)}
            </span>
            <h2>{category.cat}</h2>
            <p className="faq-sec-lede">
              {category.items.length}{" "}
              {category.items.length === 1 ? "question" : "questions"} in this
              phase
            </p>
          </div>
          <div className="faq-list">
            {category.items.map((item) => {
              const key = `${category.id}:${item.n}`;
              return (
                <FaqQuestion
                  key={key}
                  num={item.n}
                  question={item.q}
                  answer={item.a}
                  open={openIds.has(key)}
                  onToggle={() => toggle(key)}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
