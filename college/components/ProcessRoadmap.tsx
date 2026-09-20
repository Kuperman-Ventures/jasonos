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
    <div className="roadmap-row">
      <div className="roadmap-lane" aria-hidden="true">
        <div
          className={`roadmap-bar${done ? " is-done" : ""}`}
          style={{ left: `${place.left}%`, width: `${place.width}%` }}
          title={`${track.label}: ${progress.done}/${progress.total}`}
        >
          <span className="roadmap-bar-label">{track.label}</span>
          {progress.total ? (
            <span className="roadmap-bar-pct mono">{progress.percent}%</span>
          ) : null}
        </div>
      </div>
    </div>
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
      title={`${track.label}: ${progress.done}/${progress.total}`}
    >
      <span>{track.label}</span>
      {progress.total ? <em className="mono">{progress.percent}%</em> : null}
    </div>
  );
}

export function ProcessRoadmap({
  checklist,
  title = "College Process Timeline",
  subtitle = "Workstreams across junior year into senior winter. Bars pull from the checklist; the dashed line is where we are now.",
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

      <div className="roadmap-frame">
        <div className="roadmap-here" style={{ left: `${here}%` }}>
          <span className="roadmap-here-tag">You are here</span>
        </div>

        <div className="roadmap-tracks">
          {bars.map((track) => (
            <BarRow key={track.id} track={track} checklist={checklist} />
          ))}
        </div>

        <div className="roadmap-milestone-row" aria-hidden={milestones.length === 0}>
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
