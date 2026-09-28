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

/**
 * Port of example.html Climate section.
 * Scale: 15–95°F over 236px, with 28px pad above/below for labels (300px total).
 */
const T0 = 15;
const T1 = 95;
const H = 236;
const PAD = 28;
const TEMP_H = 300;
const RAIN_H = 44;
const RAIN_MAX = 6;

function ty(t: number): number {
  return PAD + ((T1 - t) / (T1 - T0)) * H;
}

function px(n: number): string {
  return `${Math.round(n)}px`;
}

function fmtSnow(inches: number): string {
  if (inches === 0) return "";
  if (inches < 1) return `${inches.toFixed(1)}″`;
  return `${Math.round(inches)}″`;
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
      ? (compare.name.split("·")[1]?.trim() || compare.name)
      : compare.name
    : "";

  const yTicks = [90, 70, 50, 30].map((t) => ({ t, top: ty(t) }));

  return (
    <div className="clim" role="tabpanel">
      <div className="clim-top">
        <div className="clim-lead">
          <h2 className="clim-title">Climate</h2>
          <div className="clim-sums">
            <div className="clim-sum">
              <span className="clim-swatch clim-swatch-fill" aria-hidden="true" />
              <p>
                <b>{campus.name}:</b> {schoolBody}
              </p>
            </div>
            {compare && compareBody ? (
              <div className="clim-sum">
                <span className="clim-swatch clim-swatch-outline" aria-hidden="true" />
                <p>
                  <b>{compare.name}:</b> {compareBody}
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="clim-cmp">
          <span className="clim-cmp-label">Compare with</span>
          <div className="clim-seg" role="group" aria-label="Compare with">
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={opt.id === compareId}
                onClick={() => onCompare(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="clim-grid">
        <div className="clim-temp clim-ylab" style={{ height: TEMP_H }}>
          {yTicks.map((tick) => (
            <span key={tick.t} style={{ top: px(tick.top) }}>
              {tick.t}°
            </span>
          ))}
        </div>

        {CLIMATE_DISPLAY_MONTHS.map((monthIndex) => {
          const hi = campus.hi[monthIndex]!;
          const lo = campus.lo[monthIndex]!;
          const cmpHi = compare?.hi[monthIndex];
          const cmpLo = compare?.lo[monthIndex];
          const off = isOffSeasonMonth(monthIndex);
          const op = off ? 0.45 : 1;
          const top = Math.min(ty(hi), compare && cmpHi != null ? ty(cmpHi) : 9999);
          const bot = Math.max(ty(lo), compare && cmpLo != null ? ty(cmpLo) : 0);
          const aLeft = compare ? "calc(50% - 16px)" : "calc(50% - 7px)";
          const title =
            `${MONTH_LABELS[monthIndex]} · ${placeShort(campus)} ${hi}°/${lo}°, rain ${campus.precip[monthIndex]} in., snow ${campus.snow[monthIndex]} in.` +
            (compare && cmpHi != null && cmpLo != null
              ? ` · ${compareShort} ${cmpHi}°/${cmpLo}°, rain ${compare.precip[monthIndex]} in., snow ${compare.snow[monthIndex]} in.`
              : "");

          return (
            <div key={monthIndex} className="clim-temp" style={{ height: TEMP_H }} title={title}>
              {yTicks.map((tick) => (
                <div key={tick.t} className="clim-gridline" style={{ top: px(tick.top) }} />
              ))}
              <div className="clim-hi" style={{ top: px(top - 22), opacity: op }}>
                {hi}°
              </div>
              <div
                className="clim-bar clim-bar-main"
                style={{
                  left: aLeft,
                  top: px(ty(hi)),
                  height: px(Math.max(2, ty(lo) - ty(hi))),
                  opacity: op,
                }}
              />
              {compare && cmpHi != null && cmpLo != null ? (
                <div
                  className="clim-bar clim-bar-cmp"
                  style={{
                    left: "calc(50% + 2px)",
                    top: px(ty(cmpHi)),
                    height: px(Math.max(2, ty(cmpLo) - ty(cmpHi))),
                    opacity: op,
                  }}
                />
              ) : null}
              <div className="clim-lo" style={{ top: px(bot + 6), opacity: op }}>
                {lo}°
              </div>
            </div>
          );
        })}

        {compare ? (
          <>
            <span className="clim-rl clim-rl-delta">Highs vs. {compareShort}</span>
            {CLIMATE_DISPLAY_MONTHS.map((monthIndex) => {
              const d = campus.hi[monthIndex]! - compare.hi[monthIndex]!;
              const off = isOffSeasonMonth(monthIndex);
              const tone = d > 0 ? "pos" : d < 0 ? "neg" : "zero";
              return (
                <span
                  key={`d-${monthIndex}`}
                  className={`clim-delta tone-${tone}`}
                  style={{ opacity: off ? 0.45 : 1 }}
                >
                  {fmtDelta(d)}
                </span>
              );
            })}
          </>
        ) : null}

        <span className="clim-rl clim-rl-rain">Rain, in.</span>
        {CLIMATE_DISPLAY_MONTHS.map((monthIndex) => {
          const off = isOffSeasonMonth(monthIndex);
          const inches = campus.precip[monthIndex]!;
          const pA = Math.min(inches, RAIN_MAX) / RAIN_MAX * RAIN_H;
          const pB = compare
            ? Math.min(compare.precip[monthIndex]!, RAIN_MAX) / RAIN_MAX * RAIN_H
            : 0;
          return (
            <div
              key={`r-${monthIndex}`}
              className="clim-rain"
              style={{ opacity: off ? 0.45 : 1 }}
            >
              <div className="clim-rain-bars">
                <div className="clim-rain-main" style={{ height: px(pA) }} />
                {compare ? (
                  <div className="clim-rain-cmp" style={{ height: px(pB) }} />
                ) : null}
              </div>
              <span className="clim-rain-n">{inches.toFixed(1)}</span>
            </div>
          );
        })}

        <span className="clim-rl clim-rl-snow">Snow, in.</span>
        {CLIMATE_DISPLAY_MONTHS.map((monthIndex) => {
          const off = isOffSeasonMonth(monthIndex);
          const schoolSnow = campus.snow[monthIndex]!;
          const cmpSnow = compare?.snow[monthIndex] ?? 0;
          return (
            <div
              key={`s-${monthIndex}`}
              className="clim-snow"
              style={{ opacity: off ? 0.45 : 1 }}
            >
              <span className="clim-snow-main">{fmtSnow(schoolSnow)}</span>
              <span className="clim-snow-cmp">
                {compare && cmpSnow > 0 ? fmtSnow(cmpSnow) : ""}
              </span>
            </div>
          );
        })}

        <span className="clim-mon-gutter" />
        {CLIMATE_DISPLAY_MONTHS.map((monthIndex) => {
          const off = isOffSeasonMonth(monthIndex);
          return (
            <span
              key={`m-${monthIndex}`}
              className={`clim-mon${off ? " is-off" : ""}`}
            >
              {MONTH_LABELS[monthIndex]}
            </span>
          );
        })}

        <span />
        <span />
        <div className="clim-sy" aria-hidden="true">
          <i />
          <span>School year · Sep–May</span>
          <i />
        </div>
      </div>

      <p className="clim-foot">30-year monthly normals. Hover a month for exact figures.</p>
    </div>
  );
}
