"use client";

import type { Phase } from "@/lib/types";

const TEST_PATTERN = /\b(sat|act|psat|test|score|nmsqt)\b/i;

export function testingItems(phases: Phase[]): { phase: string; text: string; id: string }[] {
  const items: { phase: string; text: string; id: string }[] = [];
  for (const phase of phases) {
    for (const item of phase.items) {
      if (TEST_PATTERN.test(item.text)) items.push({ phase: phase.phase, text: item.text, id: item.id });
    }
  }
  return items;
}

export function TestingTab({
  phases,
  checklist,
  onToggle,
  dateline,
}: {
  phases: Phase[];
  checklist: Record<string, boolean>;
  onToggle: (id: string, checked: boolean) => void;
  dateline: string;
}) {
  const items = testingItems(phases);
  return (
    <section>
      <header className="page-head">
        <div>
          <div className="dateline">{dateline}</div>
          <h2>Testing</h2>
        </div>
        <div className="readout">
          <span className="label">Items</span>
          <span className="figure">{items.length}</span>
          <span className="unit">from the timeline</span>
        </div>
      </header>
      <div className="testing-list">
        {items.map((item) => (
          <label key={item.id} className="testing-item">
            <input
              type="checkbox"
              checked={Boolean(checklist[item.id])}
              onChange={(event) => onToggle(item.id, event.target.checked)}
            />
            <span>
              <span className="label">{item.phase}</span>
              <span className="testing-text">{item.text}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
