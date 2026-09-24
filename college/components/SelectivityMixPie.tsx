import type { SelectivityPieSlice } from "@/lib/list-phases";

const SIZE = 160;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 68;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** SVG path for a pie wedge from startAngle sweeping `sweep` degrees. */
function wedgePath(startAngle: number, sweep: number, r = R): string {
  if (sweep <= 0) return "";
  const clamped = Math.min(sweep, 359.999);
  const start = polar(CX, CY, r, startAngle);
  const end = polar(CX, CY, r, startAngle + clamped);
  const large = clamped > 180 ? 1 : 0;
  return [
    `M ${CX} ${CY}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

export function SelectivityMixPie({
  slices,
  setCount,
  unsetCount,
}: {
  slices: SelectivityPieSlice[];
  setCount: number;
  unsetCount: number;
}) {
  const note = setCount
    ? `${setCount} with tier set${unsetCount ? ` · ${unsetCount} unset` : ""}`
    : unsetCount
      ? `${unsetCount} school${unsetCount === 1 ? "" : "s"} · set a tier to fill the pie`
      : "no schools yet";

  return (
    <div className="selectivity-pie">
      <svg
        className="selectivity-pie-chart"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        role="img"
        aria-label="Selectivity mix versus ideal shares"
      >
        {slices.map((slice) => (
          <g key={slice.id}>
            <path
              className="selectivity-pie-ideal"
              d={wedgePath(slice.startAngle, slice.idealSweep)}
            />
            {slice.fillSweep > 0.2 ? (
              <path
                className={`selectivity-pie-fill tier-${slice.id}${slice.overIdeal ? " is-over" : ""}`}
                d={wedgePath(slice.startAngle, slice.fillSweep)}
              />
            ) : null}
          </g>
        ))}
        <circle className="selectivity-pie-hole" cx={CX} cy={CY} r={28} />
        <text className="selectivity-pie-center" x={CX} y={CY - 4} textAnchor="middle">
          ideal
        </text>
        <text className="selectivity-pie-center-sub" x={CX} y={CY + 12} textAnchor="middle">
          mix
        </text>
      </svg>

      <ul className="selectivity-pie-legend">
        {slices.map((slice) => (
          <li key={slice.id}>
            <span className={`selectivity-pie-swatch tier-${slice.id}`} aria-hidden="true" />
            <span className="selectivity-pie-legend-label">{slice.label}</span>
            <span className="selectivity-pie-legend-nums">
              {slice.count} · {slice.actualPercent}%
              <span className="selectivity-pie-ideal-tag"> / {slice.idealPercent}%</span>
              {slice.overIdeal ? <span className="selectivity-pie-over-tag"> over</span> : null}
            </span>
          </li>
        ))}
      </ul>

      <p className="selectivity-pie-note">{note}</p>
    </div>
  );
}
