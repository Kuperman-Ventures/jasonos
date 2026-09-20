"use client";

import { useMemo } from "react";
import {
  ROADMAP_SEASONS,
  ROADMAP_TRACKS,
  barPlacement,
  herePlacement,
  milestonePlacement,
  trackProgress,
  type RoadmapTrack,
} from "@/lib/roadmap";

function BarRow({
  track,
  checklist,
}: {
  track: RoadmapTrack;
  checklist: Record<string, boolean>;
}) {
  const progress = trackProgress(track, checklist);
  const place = barPlacement(track.start, track.end);
  const done = progress.total > 0 && progress.done === progress.total;

  return (
    <li className="roadmap-row">
      <div
        className={`roadmap-bar${done ? " is-done" : ""}`}
        style={{ left: `${place.left}%`, width: `${place.width}%` }}
        role="img"
        aria-label={`${track.label}: ${progress.done} of ${progress.total} checklist items done`}
      >
        <span className="roadmap-bar-text">{track.label}</span>
      </div>
    </li>
  );
}

function Milestone({
  track,
  checklist,
}: {
  track: RoadmapTrack;
  checklist: Record<string, boolean>;
}) {
  const progress = trackProgress(track, checklist);
  const left = milestonePlacement(track.end);
  const done = progress.total > 0 && progress.done === progress.total;

  return (
    <div
      className={`roadmap-milestone${done ? " is-done" : ""}`}
      style={{ left: `${left}%` }}
      role="img"
      aria-label={`${track.label}: ${progress.done} of ${progress.total} checklist items done`}
    >
      <span>{track.label}</span>
    </div>
  );
}

export function ProcessRoadmap({
  checklist,
  title = "College Process Timeline",
  subtitle = "Junior year into senior winter. Bars follow the checklist; the dashed line is today.",
}: {
  checklist: Record<string, boolean>;
  title?: string;
  subtitle?: string;
}) {
  const here = useMemo(() => herePlacement(), []);
  const bars = ROADMAP_TRACKS.filter((track) => track.kind === "bar");
  const milestones = ROADMAP_TRACKS.filter((track) => track.kind === "milestone");

  return (
    <section className="roadmap" aria-label={title}>
      <header className="roadmap-head">
        <h3 className="dash-title">{title}</h3>
        <p className="section-sub">{subtitle}</p>
      </header>

      <div className="roadmap-chart">
        <div className="roadmap-here" style={{ left: `${here}%` }} aria-hidden="true">
          <span className="roadmap-here-tag">You are here</span>
        </div>

        <ul className="roadmap-tracks">
          {bars.map((track) => (
            <BarRow key={track.id} track={track} checklist={checklist} />
          ))}
        </ul>

        <div className="roadmap-milestone-row">
          {milestones.map((track) => (
            <Milestone key={track.id} track={track} checklist={checklist} />
          ))}
        </div>

        <div className="roadmap-axis">
          <div className="roadmap-axis-line" aria-hidden="true" />
          <ol className="roadmap-seasons">
            {ROADMAP_SEASONS.map((season) => (
              <li key={season.id}>
                <span className="roadmap-season-tick" aria-hidden="true" />
                <span className="roadmap-season-label mono">{season.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
