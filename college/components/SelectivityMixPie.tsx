import type { SelectivityPieSlice } from "@/lib/list-phases";

const CX = 130;
const CY = 130;
const R_IN = 58;
const R_OUT = 118;
const VIEW = "-80 -60 420 380";

function polar(r: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

/** Donut sector from inner radius r0 to outer r1 between angles a0→a1 (degrees). */
function sector(r0: number, r1: number, a0: number, a1: number): string {
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x1, y1] = polar(r1, a0);
  const [x2, y2] = polar(r1, a1);
  const [x3, y3] = polar(r0, a1);
  const [x4, y4] = polar(r0, a0);
  return `M${x1} ${y1}A${r1} ${r1} 0 ${large} 1 ${x2} ${y2}L${x3} ${y3}A${r0} ${r0} 0 ${large} 0 ${x4} ${y4}Z`;
}

function tierTone(index: number): { solid: string; tint: string } {
  const n = index + 1;
  return {
    solid: `var(--tier-${n})`,
    tint: `var(--tier-${n}-tint)`,
  };
}

export function SelectivityMixPie({
  slices,
  unsetCount,
}: {
  slices: SelectivityPieSlice[];
  setCount: number;
  unsetCount: number;
}) {
  return (
    <div className="mix">
      <svg
        className="pie"
        viewBox={VIEW}
        role="img"
        aria-label="Selectivity mix against ideal"
      >
        {slices.map((slice, index) => {
          const { solid, tint } = tierTone(index);
          const fill = Math.min(Math.max(slice.fillRatio, 0), 1);
          const mid = (slice.startAngle + slice.endAngle) / 2;
          const [lx, ly] = polar(R_OUT + 34, mid);
          const anchor = lx > CX + 8 ? "start" : lx < CX - 8 ? "end" : "middle";
          return (
            <g key={slice.id}>
              <path d={sector(R_IN, R_OUT, slice.startAngle, slice.endAngle)} fill={tint} />
              {fill > 0 ? (
                <path
                  d={sector(R_IN, R_IN + (R_OUT - R_IN) * fill, slice.startAngle, slice.endAngle)}
                  fill={solid}
                />
              ) : null}
              {slice.status === "over" ? (
                <path
                  d={sector(R_OUT + 5, R_OUT + 15, slice.startAngle, slice.endAngle)}
                  fill="var(--color-accent-500)"
                />
              ) : null}
              <text
                x={lx}
                y={ly}
                dominantBaseline="middle"
                textAnchor={anchor}
                className={slice.status === "over" ? "is-over" : undefined}
              >
                {slice.count}/{slice.idealCount}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="legend">
        <div className="legend-row is-head">
          <span>Tier</span>
          <span>Have</span>
          <span>Ideal</span>
          <span>Status</span>
        </div>
        {slices.map((slice, index) => {
          const { solid, tint } = tierTone(index);
          return (
            <div key={slice.id} className="legend-row">
              <span className="tier">
                <span
                  className="swatch"
                  style={{ background: solid, boxShadow: `4px 4px 0 ${tint}` }}
                  aria-hidden="true"
                />
                {slice.label}
              </span>
              <span className="num">{slice.count}</span>
              <span className="num ideal">{slice.idealCount}</span>
              <span className={`status ${slice.status}`}>{slice.statusLabel}</span>
            </div>
          );
        })}
        <span className="legend-foot">
          Tint = ideal share · solid = have · orange band = over
          <br />
          {unsetCount > 0
            ? `${unsetCount} school${unsetCount === 1 ? "" : "s"} have no tier yet and aren't counted`
            : "Every school on this list has a tier"}
        </span>
      </div>
    </div>
  );
}
