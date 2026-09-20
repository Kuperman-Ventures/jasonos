"use client";

import { phaseStatuses } from "@/lib/phases";
import type { Phase } from "@/lib/types";

export function TimelineTab({
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
  const statuses = phaseStatuses(phases, checklist);

  return (
    <section>
      <header className="page-head">
        <div>
          <div className="dateline">{dateline}</div>
          <h2>Timeline</h2>
        </div>
        <button type="button" className="btn btn-secondary no-print" onClick={() => window.print()}>
          Save as PDF
        </button>
      </header>
      <ol className="track">
        {phases.map((phase, index) => {
          const status = statuses[index];
          const pct = status.total ? Math.round((status.doneCount / status.total) * 100) : 0;
          return (
            <li key={phase.phase} id={`phase-${index + 1}`} className={`track-item state-${status.status}`}>
              <div className="track-date">{phase.window}</div>
              <div className="track-rail" aria-hidden="true">
                <span className="track-mark" />
              </div>
              <div className="track-body">
                <h3>{phase.phase}</h3>
                <p className="track-count">
                  {status.doneCount}/{status.total}
                </p>
                <div
                  className="progress"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${phase.phase} progress`}
                >
                  <span style={{ width: `${pct}%` }} />
                </div>
                {phase.items.map((item) => (
                  <div key={item.id} className={checklist[item.id] ? "item done" : "item"}>
                    <input
                      type="checkbox"
                      id={item.id}
                      checked={Boolean(checklist[item.id])}
                      onChange={(event) => onToggle(item.id, event.target.checked)}
                    />
                    <label htmlFor={item.id}>{item.text}</label>
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
