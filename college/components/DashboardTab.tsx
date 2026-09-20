"use client";

import { useMemo } from "react";
import { ProcessRoadmap } from "./ProcessRoadmap";
import {
  US_MAP_VIEWBOX,
  US_STATE_PATHS,
  schoolsByState,
  selectivityBreakdown,
  stateFillStrength,
} from "@/lib/dashboard";
import type { School, SelectivityTier } from "@/lib/types";

const TIER_CLASS: Record<SelectivityTier, string> = {
  "": "tier-unset",
  extremely_selective: "tier-extreme",
  very_selective: "tier-very",
  competitive: "tier-competitive",
  less_competitive: "tier-less",
};

export function DashboardTab({
  schools,
  checklist,
  dateline,
}: {
  schools: School[];
  checklist: Record<string, boolean>;
  dateline: string;
}) {
  const selectivity = useMemo(() => selectivityBreakdown(schools), [schools]);
  const withSchools = useMemo(() => selectivity.filter((slice) => slice.count > 0), [selectivity]);
  const byState = useMemo(() => schoolsByState(schools), [schools]);
  const maxState = Math.max(1, ...byState.map((item) => item.count));
  const countByState = useMemo(() => new Map(byState.map((item) => [item.state, item.count])), [byState]);
  const mappedStates = Object.keys(US_STATE_PATHS).sort();

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
        <ProcessRoadmap checklist={checklist} />
      </div>

      <div className="dash-block">
        <h3 className="dash-title">Phase 1 · Build the list</h3>
        <p className="section-sub">
          Selectivity mix and where the schools sit geographically. Counts come from the live college list.
        </p>

        <div className="dash-grid">
          <div className="dash-panel">
            <h4 className="dash-subtitle">Selectivity</h4>
            {schools.length ? (
              <div
                className="dash-stack"
                role="img"
                aria-label={withSchools
                  .map((slice) => `${slice.label} ${slice.percent}%`)
                  .join(", ")}
              >
                {withSchools.map((slice) => (
                  <span
                    key={slice.id || "unset"}
                    className={`dash-stack-seg ${TIER_CLASS[slice.id]}`}
                    style={{ flexGrow: Math.max(slice.percent, 0.5) }}
                    title={`${slice.label}: ${slice.count} (${slice.percent}%)`}
                  />
                ))}
              </div>
            ) : null}
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
                      className={`fill ${TIER_CLASS[slice.id]}`}
                      style={{ width: `${Math.max(slice.percent, slice.count ? 2 : 0)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="dash-panel">
            <h4 className="dash-subtitle">Schools by state</h4>
            <svg
              className="dash-map"
              viewBox={US_MAP_VIEWBOX}
              role="img"
              aria-label="School counts by state"
            >
              {mappedStates.map((state) => {
                const count = countByState.get(state) ?? 0;
                const strength = stateFillStrength(count, maxState);
                return (
                  <path
                    key={state}
                    className={`dash-map-state${count ? " has-schools" : ""}`}
                    d={US_STATE_PATHS[state]}
                    style={
                      count
                        ? { fillOpacity: strength }
                        : undefined
                    }
                  >
                    <title>
                      {count
                        ? `${state}: ${count} ${count === 1 ? "school" : "schools"}`
                        : `${state}: none on the list`}
                    </title>
                  </path>
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
