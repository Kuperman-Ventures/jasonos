"use client";

import { useState } from "react";
import { currentPhaseIndex, phaseStatuses } from "@/lib/phases";
import type { Phase } from "@/lib/types";

export function TimelineTab({
  phases,
  checklist,
  onToggle,
}: {
  phases: Phase[];
  checklist: Record<string, boolean>;
  onToggle: (id: string, checked: boolean) => void;
}) {
  const statuses = phaseStatuses(phases, checklist);
  const current = currentPhaseIndex(statuses);
  const [open, setOpen] = useState<Record<number, boolean>>({ [current]: true });

  return (
    <section>
      <div className="panel-toolbar no-print">
        <button type="button" className="print-btn" onClick={() => window.print()}>
          Save as PDF
        </button>
      </div>
      <div className="roadmap">
        {phases.map((phase, index) => {
          const status = statuses[index];
          return (
            <div
              key={phase.phase}
              className={`roadmap-item state-${status.status}`}
              onClick={() => {
                setOpen((prev) => ({ ...prev, [index]: true }));
                document.getElementById(`phase-${index + 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <div className="roadmap-dot">{status.status === "done" ? "✓" : index + 1}</div>
              <div className="roadmap-info">
                <div className="roadmap-top">
                  <span className="roadmap-name">{phase.phase}</span>
                  <span className="roadmap-progress">
                    {status.doneCount}/{status.total}
                  </span>
                </div>
                <div className="roadmap-window">{phase.window}</div>
              </div>
            </div>
          );
        })}
      </div>
      {phases.map((phase, index) => {
        const status = statuses[index];
        return (
          <div
            key={phase.phase}
            id={`phase-${index + 1}`}
            className={open[index] ? "phase expanded" : "phase"}
          >
            <div className="phase-head" onClick={() => setOpen((prev) => ({ ...prev, [index]: !prev[index] }))}>
              <span className="phase-num mono">{index + 1}</span>
              <h2>{phase.phase}</h2>
              <span className="phase-window">{phase.window}</span>
              <span className="phase-progress">
                {status.doneCount}/{phase.items.length}
              </span>
            </div>
            <div className="phase-body">
              {phase.items.map((item) => (
                <div key={item.id} className={checklist[item.id] ? "item done" : "item"}>
                  <input
                    type="checkbox"
                    id={item.id}
                    checked={Boolean(checklist[item.id])}
                    onChange={(event) => onToggle(item.id, event.target.checked)}
                    onClick={(event) => event.stopPropagation()}
                  />
                  <label htmlFor={item.id} onClick={(event) => event.stopPropagation()}>
                    {item.text}
                  </label>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
