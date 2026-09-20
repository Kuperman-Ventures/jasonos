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
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const delta = ((endDeg - startDeg) % 360 + 360) % 360;
  const large = delta > 180 ? 1 : 0;
  // Angles increase through the top of the SVG (y-down), which is counterclockwise.
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
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
  const cx = 100;
  const cy = 108;
  const r = 78;
  const startDeg = 180;
  const endDeg = 360;
  const track = arcPath(cx, cy, r, startDeg, endDeg);
  const needleAngle = position == null ? null : startDeg + position * (endDeg - startDeg);
  const needle = needleAngle == null ? null : polar(cx, cy, r, needleAngle);
  const fillEnd = needleAngle == null ? startDeg : needleAngle;
  const fill = position == null || position <= 0 ? null : arcPath(cx, cy, r, startDeg, fillEnd);

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
        <svg className="snapshot-meter-svg" viewBox="0 0 200 130" aria-hidden="true">
          <defs>
            <linearGradient id="selectivity-arc-fill" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--accent-500)" />
              <stop offset="55%" stopColor="var(--color-accent-400)" />
              <stop offset="100%" stopColor="var(--done-500)" />
            </linearGradient>
          </defs>
          <path className="snapshot-meter-track" d={track} />
          {fill ? <path className="snapshot-meter-fill" d={fill} /> : null}
          {SELECTIVITY_SPECTRUM.map((item, index) => {
            const t = index / (SELECTIVITY_SPECTRUM.length - 1);
            const angle = startDeg + t * (endDeg - startDeg);
            const tick = polar(cx, cy, r, angle);
            const active = item.id === tier;
            return (
              <circle
                key={item.id}
                className={`snapshot-meter-tick${active ? " is-active" : ""}`}
                cx={tick.x}
                cy={tick.y}
                r={active ? 4.5 : 2.5}
              />
            );
          })}
          {needle ? (
            <g className="snapshot-meter-needle">
              <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} />
              <circle className="snapshot-meter-hub" cx={cx} cy={cy} r="5" />
              <circle className="snapshot-meter-head" cx={needle.x} cy={needle.y} r="7" />
            </g>
          ) : (
            <circle className="snapshot-meter-hub is-unset" cx={cx} cy={cy} r="5" />
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
