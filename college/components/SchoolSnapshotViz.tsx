"use client";

import {
  SELECTIVITY_SPECTRUM,
  US_MAP_VIEWBOX,
  US_STATE_PATHS,
  stateCentroid,
  stateFromLocation,
} from "@/lib/dashboard";
import { tierLabel, type SelectivityTier } from "@/lib/types";

/** Low → high; CSS `--tier-N` matches college list pie (Less=1 … Extremely=4). */
const GAUGE_TIERS = [...SELECTIVITY_SPECTRUM].reverse();

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function SchoolLocationMap({ location }: { location: string }) {
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
    <div className="snapshot-map-wrap">
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
            <circle className="snapshot-map-pin-pulse" r="14" />
            <circle className="snapshot-map-pin-dot" r="7" />
            <circle className="snapshot-map-pin-core" r="2.75" />
          </g>
        ) : null}
      </svg>
    </div>
  );
}

export function SelectivityGauge({ tier }: { tier: SelectivityTier }) {
  const activeIndex = GAUGE_TIERS.findIndex((item) => item.id === tier);
  const label = tierLabel(tier) || "Not set";
  const cx = 150;
  const cy = 150;
  const r = 110;
  const stroke = 34;
  const gap = 3;
  const needleLen = 78;

  const aria =
    activeIndex < 0
      ? "Selectivity not set"
      : `Selectivity: ${label}, tier ${activeIndex + 1} of ${GAUGE_TIERS.length}`;

  return (
    <div className="gauge">
      <svg viewBox="0 0 300 170" role="img" aria-label={aria}>
        {GAUGE_TIERS.map((item, i) => {
          const a0 = 180 + i * 45 + gap / 2;
          const a1 = 180 + (i + 1) * 45 - gap / 2;
          const start = polar(cx, cy, r, a0);
          const end = polar(cx, cy, r, a1);
          const cssN = i + 1;
          const active = i === activeIndex;
          return (
            <path
              key={item.id}
              d={`M${start.x} ${start.y}A${r} ${r} 0 0 1 ${end.x} ${end.y}`}
              fill="none"
              strokeWidth={stroke}
              stroke={active ? `var(--tier-${cssN})` : `var(--tier-${cssN}-tint)`}
            />
          );
        })}
        {activeIndex >= 0 ? (
          <>
            {(() => {
              const tip = polar(cx, cy, needleLen, 180 + activeIndex * 45 + 22.5);
              return (
                <line
                  x1={cx}
                  y1={cy}
                  x2={tip.x}
                  y2={tip.y}
                  stroke="var(--color-text)"
                  strokeWidth={8}
                  strokeLinecap="round"
                />
              );
            })()}
            <circle cx={cx} cy={cy} r={14} fill="var(--color-text)" />
            <circle cx={cx} cy={cy} r={5} fill="var(--color-bg)" />
          </>
        ) : (
          <>
            <circle cx={cx} cy={cy} r={14} fill="var(--color-neutral-400)" />
            <circle cx={cx} cy={cy} r={5} fill="var(--color-bg)" />
          </>
        )}
      </svg>
      <span className="gauge-label">{label}</span>
      <span className="gauge-sub">
        {activeIndex < 0
          ? "Set a tier in Settings"
          : `${activeIndex + 1} of ${GAUGE_TIERS.length}${
              activeIndex === GAUGE_TIERS.length - 1 ? " · top tier" : ""
            }`}
      </span>
    </div>
  );
}

/** @deprecated Prefer composing SchoolLocationMap + SelectivityGauge inside the snapshot areas. */
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
      <SelectivityGauge tier={selectivityTier} />
    </div>
  );
}
