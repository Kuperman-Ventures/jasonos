"use client";

import {
  SELECTIVITY_SPECTRUM,
  US_MAP_VIEWBOX,
  US_STATE_PATHS,
  selectivitySpectrumPosition,
  stateCentroid,
  stateFromLocation,
} from "@/lib/dashboard";
import { tierLabel, type SelectivityTier } from "@/lib/types";

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  // 0° right, 90° down (SVG y grows down), 180° left, 270° up.
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Gauge arch from left → top → right.
 * Built from polar samples (not SVG sweep flags) so it cannot flip into a smile.
 */
function gaugeArchPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number, steps = 64) {
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const point = polar(cx, cy, r, startDeg + t * (endDeg - startDeg));
    parts.push(`${i === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`);
  }
  return parts.join(" ");
}

function SchoolLocationMap({ location }: { location: string }) {
  const state = stateFromLocation(location);
  const pin = state ? stateCentroid(state) : null;
  const states = Object.keys(US_STATE_PATHS).sort();
  const label = state
    ? pin
      ? `${location || state}`
      : `${state} (map pin unavailable)`
    : location.trim()
      ? "Location needs a U.S. state code (e.g. Cambridge, MA)"
      : "Location not set";

  return (
    <div className="snapshot-map-panel">
      <div className="label">Location</div>
      <svg className="snapshot-map" viewBox={US_MAP_VIEWBOX} role="img" aria-label={label}>
        {states.map((code) => (
          <path
            key={code}
            className={`snapshot-map-state${code === state ? " is-home" : ""}`}
            d={US_STATE_PATHS[code]}
          />
        ))}
        {pin ? (
          <g className="snapshot-map-pin" transform={`translate(${pin.x} ${pin.y})`}>
            <circle className="snapshot-map-pin-pulse" r="18" />
            <circle className="snapshot-map-pin-dot" r="9" />
            <circle className="snapshot-map-pin-core" r="3.5" />
          </g>
        ) : null}
      </svg>
      <p className="snapshot-viz-caption">{location.trim() || "Add a city and state in Settings"}</p>
    </div>
  );
}

function SelectivityMeter({ tier }: { tier: SelectivityTier }) {
  const position = selectivitySpectrumPosition(tier);
  const label = tierLabel(tier) || "Not set";
  // Hub low; arch (180°→360° through 270° up) sits above the title.
  const cx = 110;
  const cy = 120;
  const r = 88;
  const startDeg = 180;
  const endDeg = 360;
  const track = gaugeArchPath(cx, cy, r, startDeg, endDeg);
  const needleAngle = position == null ? null : startDeg + position * (endDeg - startDeg);
  const needleOuter = needleAngle == null ? null : polar(cx, cy, r, needleAngle);
  const needleInner = needleAngle == null ? null : polar(cx, cy, r - 18, needleAngle);
  const top = cy - r - 14;
  const bottom = cy + 10;
  const height = bottom - top;

  return (
    <div className="snapshot-meter-panel">
      <div className="label">Selectivity</div>
      <div
        className={`snapshot-meter${position == null ? " is-unset" : ""}`}
        role="img"
        aria-label={
          position == null
            ? "Selectivity not set"
            : `${label}: ${Math.round(position * 100)}% along the spectrum from extremely selective to less competitive`
        }
      >
        <svg className="snapshot-meter-svg" viewBox={`0 ${top} 220 ${height}`} aria-hidden="true">
          <defs>
            <linearGradient id="selectivity-arc-spectrum" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--accent-500)" />
              <stop offset="45%" stopColor="var(--color-accent-400)" />
              <stop offset="100%" stopColor="var(--done-500)" />
            </linearGradient>
          </defs>
          <path className="snapshot-meter-track" d={track} />
          <path className="snapshot-meter-spectrum" d={track} />
          {SELECTIVITY_SPECTRUM.map((item, index) => {
            const t = index / (SELECTIVITY_SPECTRUM.length - 1);
            const angle = startDeg + t * (endDeg - startDeg);
            const onArc = polar(cx, cy, r, angle);
            const tickOuter = polar(cx, cy, r + 8, angle);
            const tickInner = polar(cx, cy, r - 8, angle);
            const active = item.id === tier;
            return (
              <g key={item.id} className={`snapshot-meter-mark${active ? " is-active" : ""}`}>
                <line x1={tickInner.x} y1={tickInner.y} x2={tickOuter.x} y2={tickOuter.y} />
                <circle cx={onArc.x} cy={onArc.y} r={active ? 6 : 3} />
              </g>
            );
          })}
          {needleOuter && needleInner ? (
            <g className="snapshot-meter-needle">
              <line x1={cx} y1={cy} x2={needleInner.x} y2={needleInner.y} />
              <circle className="snapshot-meter-hub" cx={cx} cy={cy} r="6" />
              <circle className="snapshot-meter-head" cx={needleOuter.x} cy={needleOuter.y} r="8" />
            </g>
          ) : (
            <circle className="snapshot-meter-hub is-unset" cx={cx} cy={cy} r="6" />
          )}
        </svg>
        <div className="snapshot-meter-readout">
          <strong>{label}</strong>
          <span className="snapshot-meter-ends">
            <span>Extremely</span>
            <span>Less competitive</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function SchoolSnapshotViz({
  location,
  selectivityTier,
}: {
  location: string;
  selectivityTier: SelectivityTier;
}) {
  return (
    <div className="school-snapshot-viz">
      <SchoolLocationMap location={location} />
      <SelectivityMeter tier={selectivityTier} />
    </div>
  );
}
