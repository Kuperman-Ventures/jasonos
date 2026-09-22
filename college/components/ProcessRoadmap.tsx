"use client";

import { useMemo } from "react";
import {
  ROADMAP_TRACKS,
  accessibleTrackName,
  currentMonthIndex,
  dayProgressInMonth,
  formatNowDay,
  formatSpan,
  gridColumnStart,
  monthCells,
  monthIndex,
  spanLength,
  trackState,
  yearBands,
  type RoadmapTrack,
} from "@/lib/roadmap";

function TrackRow({
  track,
  row,
  checklist,
  now,
}: {
  track: RoadmapTrack;
  row: number;
  checklist: Record<string, boolean>;
  now: Date;
}) {
  const state = trackState(track, checklist, now);
  const start = monthIndex(track.start.year, track.start.month);
  const length = spanLength(track.start, track.end);
  const name = accessibleTrackName(track, state);
  const span = formatSpan(track);
  const detail = `${name} · ${span}`;

  return (
    <>
      <div className="rule" style={{ gridRow: row, gridColumn: "1 / -1" }} />
      <div
        className="name"
        style={
          track.kind === "milestone"
            ? { gridRow: row, color: "var(--milestone-ink)" }
            : { gridRow: row }
        }
        data-state={state === "future" ? "future" : undefined}
        title={detail}
      >
        {track.label}
      </div>
      {track.kind === "milestone" ? (
        <button
          type="button"
          className="pin"
          style={{ gridRow: row, gridColumn: gridColumnStart(start) }}
          title={detail}
          aria-label={detail}
        />
      ) : (
        <button
          type="button"
          className="bar"
          data-state={state === "future" ? "future" : undefined}
          style={{
            gridRow: row,
            gridColumn: `${gridColumnStart(start)} / span ${length}`,
          }}
          title={detail}
          aria-label={detail}
        />
      )}
    </>
  );
}

export function ProcessRoadmap({
  checklist,
  title = "Timeline",
  showTitle = true,
  dateline,
}: {
  checklist: Record<string, boolean>;
  title?: string;
  showTitle?: boolean;
  dateline?: string;
}) {
  const now = useMemo(() => new Date(), []);
  const cells = useMemo(() => monthCells(), []);
  const bands = useMemo(() => yearBands(cells), [cells]);
  const nowIndex = currentMonthIndex(now);
  const dayProgress = dayProgressInMonth(now);
  const nowDayLabel = formatNowDay(now);
  const nowMonthLabel = cells[nowIndex]
    ? `${cells[nowIndex].label} ${cells[nowIndex].year}`
    : "";
  const lineLeft = `${dayProgress * 100}%`;

  const bars = ROADMAP_TRACKS.filter((track) => track.kind === "bar");
  const milestones = ROADMAP_TRACKS.filter((track) => track.kind === "milestone");
  const ordered = ROADMAP_TRACKS;
  const lastTrackRow = 2 + ordered.length;

  return (
    <section className="roadmap" aria-label={title}>
      {showTitle ? (
        <header className="page-head roadmap-head">
          <div>
            {dateline ? <div className="dateline">{dateline}</div> : null}
            <h3 className="dash-title">{title}</h3>
          </div>
          <div className="mono roadmap-meta">
            {bars.length} tasks · {milestones.length} milestones · Sep 2026 – Jan 2028
          </div>
        </header>
      ) : null}

      <div className="gantt-scroll">
        <div
          className="gantt"
          role="table"
          aria-label="Application timeline by month"
        >
          {bands.map((band) => (
            <div
              key={band.year}
              className="yr"
              style={{
                gridRow: 1,
                gridColumn: `${gridColumnStart(band.start)} / span ${band.span}`,
              }}
            >
              {band.year}
            </div>
          ))}

          <div className="head-pad" style={{ gridRow: 2, gridColumn: 1 }} />
          {cells.map((cell) => (
            <div
              key={`${cell.year}-${cell.month}`}
              className={cell.index === nowIndex ? "mo mo-now" : "mo"}
              style={{ gridRow: 2, gridColumn: gridColumnStart(cell.index) }}
              {...(cell.quarter ? { "data-q": true } : {})}
              {...(cell.index === nowIndex ? { "aria-current": "date" as const } : {})}
            >
              {cell.label}
            </div>
          ))}

          <div className="gridlines" aria-hidden="true" />
          <div
            className="now"
            style={{
              gridColumn: gridColumnStart(nowIndex),
              gridRow: `1 / ${lastTrackRow + 1}`,
            }}
            aria-hidden="true"
          >
            <span className="now-line" style={{ left: lineLeft }} />
            <span className="now-badge" style={{ left: lineLeft }}>
              <span className="now-badge-label">You are here</span>
              <span className="now-badge-date">{nowDayLabel}</span>
            </span>
          </div>

          {ordered.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              row={3 + index}
              checklist={checklist}
              now={now}
            />
          ))}
        </div>
      </div>

      <div className="legend">
        <span className="legend-here">
          <i className="swatch now" />
          You are here · {nowDayLabel} · {nowMonthLabel}
        </span>
        <span>
          <i className="swatch bar" />
          In progress
        </span>
        <span>
          <i className="swatch future" />
          Not started
        </span>
        <span>
          <i className="swatch pin" />
          Milestone
        </span>
      </div>
    </section>
  );
}
