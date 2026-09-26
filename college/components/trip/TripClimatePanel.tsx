"use client";

import {
  CLIMATE_DISPLAY_MONTHS,
  MONTH_LABELS,
  type ClimateNormals,
} from "@/lib/trip-planning";

const T0 = 15;
const T1 = 95;
const TH = 220;

function ty(t: number): number {
  return TH - ((t - T0) / (T1 - T0)) * TH;
}

export function TripClimatePanel({
  campus,
  compareId,
  compare,
  home,
  boston,
  onCompare,
}: {
  campus: ClimateNormals;
  compareId: string;
  compare: ClimateNormals | null;
  home: ClimateNormals;
  boston: ClimateNormals;
  onCompare: (id: string) => void;
}) {
  const options = [
    { id: "none", label: "None" },
    { id: "home", label: home.label },
    { id: "boston", label: boston.label },
  ];

  return (
    <div className="trip-panel" role="tabpanel">
      <div className="trip-head-row">
        <div className="trip-clim-sum">
          <h2>Climate</h2>
          <p>
            <b>{campus.name}:</b> {campus.summary}
          </p>
          {compare ? (
            <p className="cmp">
              <b>{compare.name}:</b> {compare.summary}
            </p>
          ) : null}
        </div>
        <div className="trip-cmp-wrap">
          <span className="trip-label trip-label-sm">Compare with</span>
          <div className="trip-seg" role="group" aria-label="Compare with">
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                data-cmp={opt.id}
                aria-pressed={opt.id === compareId}
                onClick={() => onCompare(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="trip-clim">
        <div className="trip-temp">
          {[30, 50, 70, 90].map((t) => (
            <span key={t} className="trip-ylab" style={{ top: ty(t) }}>
              {t}°
            </span>
          ))}
        </div>
        {CLIMATE_DISPLAY_MONTHS.map((monthIndex) => {
          const hi = campus.hi[monthIndex]!;
          const lo = campus.lo[monthIndex]!;
          const cmpHi = compare?.hi[monthIndex];
          const cmpLo = compare?.lo[monthIndex];
          return (
            <div key={monthIndex} className="trip-temp">
              {[30, 50, 70, 90].map((t) => (
                <div key={t} className="trip-grid" style={{ top: ty(t) }} />
              ))}
              <div
                className={`trip-bar main${compare ? "" : " solo"}`}
                style={{ top: ty(hi), height: ty(lo) - ty(hi) }}
                title={`${campus.name} ${MONTH_LABELS[monthIndex]}: ${hi}° / ${lo}°`}
              />
              {compare && cmpHi != null && cmpLo != null ? (
                <div
                  className="trip-bar cmp"
                  style={{ top: ty(cmpHi), height: ty(cmpLo) - ty(cmpHi) }}
                  title={`${compare.name} ${MONTH_LABELS[monthIndex]}: ${cmpHi}° / ${cmpLo}°`}
                />
              ) : null}
              <span
                className="trip-tnum hi"
                style={{
                  top:
                    ty(Math.max(hi, compare ? (cmpHi ?? hi) : hi)) - 18,
                }}
              >
                {hi}°
              </span>
              <span
                className="trip-tnum lo"
                style={{
                  top:
                    ty(Math.min(lo, compare ? (cmpLo ?? lo) : lo)) + 4,
                }}
              >
                {lo}°
              </span>
            </div>
          );
        })}

        <span className="trip-rl">Rain</span>
        {CLIMATE_DISPLAY_MONTHS.map((monthIndex) => (
          <div key={`r-${monthIndex}`} className="trip-rain">
            <i style={{ height: (campus.precip[monthIndex]! / 5) * 48 }} />
            {compare ? (
              <i
                className="cmp"
                style={{ height: (compare.precip[monthIndex]! / 5) * 48 }}
              />
            ) : null}
          </div>
        ))}

        <span className="trip-rl">Snow</span>
        {CLIMATE_DISPLAY_MONTHS.map((monthIndex) => {
          const v = compare ? compare.snow[monthIndex]! : campus.snow[monthIndex]!;
          return (
            <div key={`s-${monthIndex}`} className="trip-snow">
              {v >= 1 ? `${v}″` : ""}
            </div>
          );
        })}

        <span />
        {CLIMATE_DISPLAY_MONTHS.map((monthIndex) => (
          <div key={`m-${monthIndex}`} className="trip-mon">
            {MONTH_LABELS[monthIndex]}
          </div>
        ))}
        <span />
        <div className="trip-sy">School year · Sep–May</div>
      </div>

      <div className="trip-legend">
        <span>
          <span className="trip-sw" style={{ background: "var(--color-accent)" }} />
          {campus.name} high–low
        </span>
        {compare ? (
          <>
            <span>
              <span
                className="trip-sw"
                style={{ border: "1.5px solid var(--color-text)", background: "transparent" }}
              />
              {compare.city} high–low
            </span>
            <span>Snow row shows {compare.name.toLowerCase()} snowfall</span>
          </>
        ) : null}
        <span>
          <span className="trip-sw" style={{ background: "var(--lvl-3)" }} />
          Rain, {campus.name}
        </span>
      </div>
      <p className="trip-foot">Approximate monthly averages, °F and inches.</p>
    </div>
  );
}
