"use client";

import { useMemo } from "react";
import {
  STATE_CENTROIDS,
  dashboardPhaseCards,
  schoolsByState,
  selectivityBreakdown,
} from "@/lib/dashboard";
import type { PhaseStatus } from "@/lib/phases";
import type { Phase, School } from "@/lib/types";

export function DashboardTab({
  schools,
  phases,
  statuses,
  phaseIndex,
  dateline,
}: {
  schools: School[];
  phases: Phase[];
  statuses: PhaseStatus[];
  phaseIndex: number;
  dateline: string;
}) {
  const selectivity = useMemo(() => selectivityBreakdown(schools), [schools]);
  const byState = useMemo(() => schoolsByState(schools), [schools]);
  const cards = useMemo(() => dashboardPhaseCards(phases, statuses), [phases, statuses]);
  const maxState = Math.max(1, ...byState.map((item) => item.count));
  const mapped = byState.filter((item) => STATE_CENTROIDS[item.state]);

  return (
    <section className="dashboard">
      <header className="page-head">
        <div>
          <div className="dateline">{dateline}</div>
          <h2>Dashboard</h2>
        </div>
        <div className="readout">
          <span className="label">Schools</span>
          <span className="figure">{schools.length}</span>
          <span className="unit">on the list</span>
        </div>
      </header>

      <div className="dash-block">
        <h3 className="dash-title">Process at a glance</h3>
        <p className="section-sub">Where the plan sits across all six phases. Current phase is marked.</p>
        <ol className="dash-timeline">
          {cards.map((card, index) => (
            <li
              key={card.phase}
              className={`dash-phase state-${card.status}${index === phaseIndex ? " is-now" : ""}`}
            >
              <div className="dash-phase-top">
                <span className="dash-phase-num mono">{String(index + 1).padStart(2, "0")}</span>
                <span className="dash-phase-name">{card.phase}</span>
              </div>
              <span className="dash-phase-window mono">{card.window}</span>
              <div
                className="dash-phase-meter"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={card.percent}
                aria-label={`${card.phase} checklist ${card.done} of ${card.total}`}
              >
                <span style={{ width: `${card.percent}%` }} />
              </div>
              <span className="dash-phase-stat mono">
                {card.done}/{card.total} · {card.percent}%
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="dash-block">
        <h3 className="dash-title">Phase 1 · Build the list</h3>
        <p className="section-sub">Selectivity mix and where the schools sit geographically. Counts come from the live college list.</p>

        <div className="dash-grid">
          <div className="dash-panel">
            <h4 className="dash-subtitle">Selectivity</h4>
            <ul className="dash-bars">
              {selectivity.map((slice) => (
                <li key={slice.id || "unset"}>
                  <div className="dash-bar-label">
                    <span>{slice.label}</span>
                    <span className="mono">
                      {slice.count} · {slice.percent}%
                    </span>
                  </div>
                  <div className="dash-bar-track" aria-hidden="true">
                    <span
                      className="fill"
                      style={{ width: `${Math.max(slice.percent, slice.count ? 2 : 0)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="dash-panel">
            <h4 className="dash-subtitle">Schools by state</h4>
            <svg className="dash-map" viewBox="0 0 1000 620" role="img" aria-label="School counts by state">
              <rect className="dash-map-bg" x="0" y="0" width="1000" height="620" rx="2" />
              {mapped.map((item) => {
                const point = STATE_CENTROIDS[item.state];
                const radius = 10 + (item.count / maxState) * 22;
                return (
                  <g key={item.state} transform={`translate(${point.x} ${point.y})`}>
                    <circle className="dash-map-dot" r={radius} />
                    <text className="dash-map-code" textAnchor="middle" dy="4">
                      {item.state}
                    </text>
                    <title>
                      {item.state}: {item.count} {item.count === 1 ? "school" : "schools"}
                    </title>
                  </g>
                );
              })}
            </svg>
            <ul className="dash-state-list">
              {byState.map((item) => (
                <li key={item.state}>
                  <span className="mono">{item.state}</span>
                  <span className="mono">{item.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
