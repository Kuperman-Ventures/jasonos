"use client";

import {
  CLIMATE_DISPLAY_MONTHS,
  MONTH_LABELS,
  climateCompareOptions,
  climateCompareSummaryBody,
  climateSchoolSummaryBody,
  isOffSeasonMonth,
  type ClimateNormals,
} from "@/lib/trip-planning";

/** Chart plot height; labels sit in the pad above/below. */
const T0 = 15;
const T1 = 95;
const TH = 236;
const PAD = 28;
const TEMP_H = PAD + TH + PAD;
const RAIN_H = 44;
const RAIN_MAX = 6;

function ty(t: number): number {
  return PAD + TH - ((t - T0) / (T1 - T0)) * TH;
}

function fmtSnow(inches: number): string {
  if (inches === 0) return "";
  if (inches < 1) return `${inches.toFixed(1)}″`;
  const n = Number.isInteger(inches) ? String(inches) : String(Math.round(inches * 10) / 10);
  return `${n}″`;
}

function rainHeight(inches: number): number {
  return (Math.min(Math.max(inches, 0), RAIN_MAX) / RAIN_MAX) * RAIN_H;
}

function fmtDelta(d: number): string {
  if (d === 0) return "0°";
  return d > 0 ? `+${d}°` : `\u2212${Math.abs(d)}°`;
}

function placeShort(c: ClimateNormals): string {
  const city = c.city?.split(",")[0]?.trim();
  return city || c.name;
}

export function TripClimatePanel({
  campus,
  compareId,
  compare,
  onCompare,
}: {
  campus: ClimateNormals;
  compareId: string;
  compare: ClimateNormals | null;
  onCompare: (id: string) => void;
}) {
  const options = climateCompareOptions();
  const schoolBody = climateSchoolSummaryBody(campus);
  const compareBody = compare
    ? climateCompareSummaryBody(compare, campus, placeShort(campus))
    : null;
  const compareShort = compare
    ? compare.name.includes("·")
      ? compare.name.split("·")[1]?.trim() || compare.name
      : compare.name
    : "";

  return (
    <div className="trip-panel trip-clim-panel" role="tabpanel">
      <div className="trip-clim-top">
        <div className="trip-clim-lead">
          <h2 className="trip-clim-title">Climate</h2>
          <div className="trip-clim-sum">
            <p>
              <span className="trip-swatch trip-swatch-fill" aria-hidden="true" />
              <span>
                <b>{campus.name}:</b> {schoolBody}
              </span>
            </p>
            {compare && compareBody ? (
              <p className="cmp">
                <span className="trip-swatch trip-swatch-outline" aria-hidden="true" />
                <span>
                  <b>{compare.name}:</b> {compareBody}
                </span>
              </p>
            ) : null}
          </div>
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

      <div className={`trip-clim${compare ? " has-cmp" : ""}`}>
        <div className="trip-temp trip-ylab-col" style={{ height: TEMP_H }}>
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
          const off = isOffSeasonMonth(monthIndex);
          const topHi = Math.max(hi, compare ? (cmpHi ?? hi) : hi);
          const botLo = Math.min(lo, compare ? (cmpLo ?? lo) : lo);
          const titleParts = [
            `${campus.name} ${MONTH_LABELS[monthIndex]}: ${hi}° / ${lo}°, rain ${campus.precip[monthIndex]} in., snow ${campus.snow[monthIndex]} in.`,
          ];
          if (compare && cmpHi != null && cmpLo != null) {
            titleParts.push(
              `${compare.name}: ${cmpHi}° / ${cmpLo}°, rain ${compare.precip[monthIndex]} in., snow ${compare.snow[monthIndex]} in.`,
            );
          }
          return (
            <div
              key={monthIndex}
              className={`trip-temp${off ? " is-off" : ""}`}
              style={{ height: TEMP_H }}
              title={titleParts.join(" · ")}
            >
              {[30, 50, 70, 90].map((t) => (
                <div key={t} className="trip-grid" style={{ top: ty(t) }} />
              ))}
              <div
                className={`trip-bar main${compare ? "" : " solo"}`}
                style={{ top: ty(hi), height: Math.max(2, ty(lo) - ty(hi)) }}
              />
              {compare && cmpHi != null && cmpLo != null ? (
                <div
                  className="trip-bar cmp"
                  style={{ top: ty(cmpHi), height: Math.max(2, ty(cmpLo) - ty(cmpHi)) }}
                />
              ) : null}
              <span className="trip-tnum hi" style={{ top: ty(topHi) - 22 }}>
                {hi}°
              </span>
              <span className="trip-tnum lo" style={{ top: ty(botLo) + 6 }}>
                {lo}°
              </span>
            </div>
          );
        })}

        {compare ? (
          <>
            <span className="trip-rl trip-rl-row">Highs vs. {compareShort}</span>
            {CLIMATE_DISPLAY_MONTHS.map((monthIndex) => {
              const d = campus.hi[monthIndex]! - compare.hi[monthIndex]!;
              const off = isOffSeasonMonth(monthIndex);
              const tone = d > 0 ? "pos" : d < 0 ? "neg" : "zero";
              return (
                <div
                  key={`d-${monthIndex}`}
                  className={`trip-delta trip-row-cell${off ? " is-off" : ""} tone-${tone}`}
                >
                  {fmtDelta(d)}
                </div>
              );
            })}
          </>
        ) : null}

        <span className="trip-rl trip-rl-row">Rain, in.</span>
        {CLIMATE_DISPLAY_MONTHS.map((monthIndex) => {
          const off = isOffSeasonMonth(monthIndex);
          const inches = campus.precip[monthIndex]!;
          return (
            <div
              key={`r-${monthIndex}`}
              className={`trip-rain trip-row-cell${off ? " is-off" : ""}`}
            >
              <div className="trip-rain-bars">
                <i style={{ height: rainHeight(inches) }} />
                {compare ? (
                  <i
                    className="cmp"
                    style={{ height: rainHeight(compare.precip[monthIndex]!) }}
                  />
                ) : null}
              </div>
              <span className="trip-rain-n mono">
                {Number.isInteger(inches) ? inches : inches.toFixed(1)}
              </span>
            </div>
          );
        })}

        <span className="trip-rl trip-rl-row">Snow, in.</span>
        {CLIMATE_DISPLAY_MONTHS.map((monthIndex) => {
          const off = isOffSeasonMonth(monthIndex);
          const schoolSnow = campus.snow[monthIndex]!;
          const cmpSnow = compare?.snow[monthIndex];
          return (
            <div
              key={`s-${monthIndex}`}
              className={`trip-snow trip-row-cell${off ? " is-off" : ""}`}
            >
              <span>{fmtSnow(schoolSnow)}</span>
              {compare && cmpSnow != null && cmpSnow > 0 ? (
                <span className="cmp">{fmtSnow(cmpSnow)}</span>
              ) : null}
            </div>
          );
        })}

        <span className="trip-mon-rule" />
        {CLIMATE_DISPLAY_MONTHS.map((monthIndex) => (
          <div
            key={`m-${monthIndex}`}
            className={`trip-mon${isOffSeasonMonth(monthIndex) ? " is-off" : ""}`}
          >
            {MONTH_LABELS[monthIndex]}
          </div>
        ))}

        <span />
        <span />
        <div className="trip-sy" aria-hidden="true">
          <span>School year · Sep–May</span>
        </div>
      </div>

      <p className="trip-foot">
        30-year monthly normals. Hover a month for exact figures.
      </p>
    </div>
  );
}
