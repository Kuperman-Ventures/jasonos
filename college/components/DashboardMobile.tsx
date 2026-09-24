"use client";

import { useMemo } from "react";
import {
  ROADMAP_TRACKS,
  formatNowDay,
  formatSpan,
  formatTodayLong,
  trackProgress,
  trackState,
} from "@/lib/roadmap";
import type { School } from "@/lib/types";
import {
  DashboardSelectivityPanel,
  DashboardStateMap,
  useDashboardStats,
} from "./DashboardDesktop";

export function DashboardMobile({
  schools,
  checklist,
  dateline,
}: {
  schools: School[];
  checklist: Record<string, boolean>;
  dateline: string;
}) {
  const stats = useDashboardStats(schools);
  const now = stats.today;
  const todayLong = formatTodayLong(now);
  const todayShort = formatNowDay(now);

  const runway = useMemo(() => {
    return ROADMAP_TRACKS.map((track) => {
      const state = trackState(track, checklist, now);
      const progress = trackProgress(track, checklist);
      return { track, state, progress, span: formatSpan(track) };
    });
  }, [checklist, now]);

  const focusTracks = useMemo(
    () => runway.filter((item) => item.state === "active" || item.state === "done"),
    [runway],
  );
  const upcoming = useMemo(() => runway.filter((item) => item.state === "future").slice(0, 2), [runway]);

  return (
    <section className="dashboard dashboard-mobile" data-viewport="mobile">
      <header className="mobile-dash-hero">
        <div className="dateline">{dateline}</div>
        <h2>Dashboard</h2>
        <p className="mobile-dash-lede">{todayLong}</p>
        <div className="mobile-dash-tiles" aria-label="At a glance">
          <div className="mobile-dash-tile">
            <span className="label">Today</span>
            <span className="figure">{todayShort}</span>
            <span className="unit">{now.toLocaleDateString("en-US", { weekday: "long" })}</span>
          </div>
          <div className="mobile-dash-tile">
            <span className="label">Schools</span>
            <span className="figure">{schools.length}</span>
            <span className="unit">on the list</span>
          </div>
        </div>
      </header>

      <div className="dash-block mobile-dash-runway">
        <h3 className="dash-title">Where you are</h3>
        <p className="section-sub">Active work on the college process runway. Open Timeline for the full month ledger.</p>
        <ol className="mobile-runway-list">
          {focusTracks.map(({ track, state, progress, span }) => (
            <li key={track.id} data-state={state}>
              <div className="mobile-runway-top">
                <span className="mobile-runway-label">{track.label}</span>
                <span className="mono mobile-runway-span">{span}</span>
              </div>
              <div className="mobile-runway-meta">
                <span className="mobile-runway-state">
                  {state === "done" ? "Done" : track.kind === "milestone" ? "Milestone" : "In progress"}
                </span>
                {progress.total ? (
                  <span className="mono">
                    {progress.done}/{progress.total}
                  </span>
                ) : null}
              </div>
              {progress.total ? (
                <div className="mobile-runway-track" aria-hidden="true">
                  <span style={{ width: `${Math.max(progress.percent, progress.done ? 4 : 0)}%` }} />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
        {upcoming.length ? (
          <div className="mobile-runway-next">
            <div className="dash-subtitle">Coming up</div>
            <ul>
              {upcoming.map(({ track, span }) => (
                <li key={track.id}>
                  <span>{track.label}</span>
                  <span className="mono">{span}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="dash-block">
        <h3 className="dash-title">List mix</h3>
        <p className="section-sub">Selectivity and geography for schools already on the list.</p>
        <DashboardSelectivityPanel
          schools={schools}
          selectivity={stats.selectivity}
          withSchools={stats.withSchools}
        />
      </div>

      <div className="dash-block mobile-dash-map">
        <DashboardStateMap
          mappedStates={stats.mappedStates}
          countByState={stats.countByState}
          maxState={stats.maxState}
          byState={stats.byState}
        />
      </div>
    </section>
  );
}
