"use client";

import type { School } from "@/lib/types";
import {
  SCOIR_PULLED_DATE,
  SCOIR_SOURCE_LABEL,
  formatScoirPct,
  scoirRecordForSchool,
  type ScoirRecord,
} from "@/lib/scoir";

const RACE_LABELS: { key: keyof NonNullable<ScoirRecord["undergradRaceEthnicityPct"]>; label: string }[] =
  [
    { key: "asian", label: "Asian" },
    { key: "black", label: "Black" },
    { key: "hispanic", label: "Hispanic" },
    { key: "white", label: "White" },
    { key: "americanIndian", label: "American Indian" },
    {
      key: "allOther",
      label: "Two or more races, international, other and not reported",
    },
  ];

function pctOrZero(n: number | null | undefined): number {
  return n != null && Number.isFinite(n) ? n : 0;
}

function GeographyBars({ scoir }: { scoir: ScoirRecord }) {
  const geo = scoir.undergradGeography;
  if (!geo) return <p className="section-sub">Not published</p>;
  if (!geo.complete) {
    return (
      <p className="section-sub">
        Scoir&apos;s origin breakdown for this school is incomplete.
        {geo.homeStatePct != null
          ? ` ${geo.homeState} (home state) is ${formatScoirPct(geo.homeStatePct)}.`
          : ""}
      </p>
    );
  }

  const homeIsNj = /^new jersey$/i.test(geo.homeState.trim());
  const home = pctOrZero(geo.homeStatePct);
  const other = pctOrZero(geo.otherUsStatesPct);
  const intl = pctOrZero(geo.internationalPct);
  // Carve NJ out of "other U.S." only when the school is outside NJ. For Rutgers /
  // NJIT the home-state slice already is New Jersey — a second NJ slice double-counts.
  const nj = homeIsNj ? 0 : Math.min(pctOrZero(geo.newJerseyPct), other);
  const otherRest = Math.max(0, other - nj);
  const total = home + other + intl || 1;

  const homeW = (home / total) * 100;
  const njW = (nj / total) * 100;
  const otherRestW = (otherRest / total) * 100;
  const intlW = (intl / total) * 100;

  const homeLeft = 0;
  const njLeft = homeLeft + homeW;
  const otherLeft = njLeft + njW;
  const intlLeft = otherLeft + otherRestW;

  type Callout = {
    key: string;
    label: string;
    xPct: number;
    shiftLeft: boolean;
    topPx: number;
  };
  const callouts: Callout[] = [];
  if (homeIsNj && home > 0 && homeW < 14) {
    callouts.push({
      key: "home-nj",
      label: `New Jersey · your state ${formatScoirPct(home, 1)}`,
      xPct: homeLeft + homeW / 2,
      shiftLeft: true,
      topPx: 0,
    });
  }
  if (nj > 0 && njW < 14) {
    callouts.push({
      key: "nj",
      label: `New Jersey · your state ${formatScoirPct(nj, 1)}`,
      // Leader stays centered on the orange NJ slice — never nudge this.
      xPct: njLeft + njW / 2,
      shiftLeft: true,
      topPx: 0,
    });
  }
  if (otherRest > 0 && otherRestW < 14) {
    callouts.push({
      key: "other",
      label: `Other U.S. states ${formatScoirPct(otherRest, 1)}`,
      xPct: otherLeft + otherRestW / 2,
      shiftLeft: true,
      topPx: 0,
    });
  }
  if (intl > 0 && intlW < 14) {
    callouts.push({
      key: "intl",
      label: `International ${formatScoirPct(intl, 1)}`,
      xPct: intlLeft + intlW / 2,
      shiftLeft: true,
      topPx: 0,
    });
  }
  // If labels would sit on top of each other, stack the second one higher —
  // keep leaders pinned to their slices.
  if (callouts.length >= 2) {
    for (let i = 1; i < callouts.length; i++) {
      const prev = callouts[i - 1]!;
      const cur = callouts[i]!;
      if (Math.abs(cur.xPct - prev.xPct) < 22) {
        cur.topPx = prev.topPx - 18;
      }
    }
  }

  const topOutside = (geo.topPlaces ?? [])
    .filter((p) => {
      const place = p.place.toLowerCase();
      return (
        place !== geo.homeState.toLowerCase() &&
        place !== "international" &&
        !place.includes("international")
      );
    })
    .slice(0, 5);
  const topMax = Math.max(...topOutside.map((p) => p.pct), 0.01);

  const segs: {
    key: string;
    left: number;
    width: number;
    className: string;
    title: string;
    name: string;
    pctText: string;
  }[] = [];
  if (home > 0) {
    segs.push({
      key: "home",
      left: homeLeft,
      width: homeW,
      className: homeIsNj ? "sb-seg sb-seg-nj" : "sb-seg sb-seg-home",
      title: homeIsNj
        ? `New Jersey · your state ${formatScoirPct(home)}`
        : `${geo.homeState} ${formatScoirPct(home)}`,
      name: homeIsNj ? "New Jersey · your state" : geo.homeState,
      pctText: formatScoirPct(home),
    });
  }
  if (nj > 0) {
    segs.push({
      key: "nj",
      left: njLeft,
      width: njW,
      className: "sb-seg sb-seg-nj",
      title: `New Jersey · your state ${formatScoirPct(nj)}`,
      name: "New Jersey · your state",
      pctText: formatScoirPct(nj),
    });
  }
  if (otherRest > 0) {
    segs.push({
      key: "other",
      left: otherLeft,
      width: otherRestW,
      className: "sb-seg sb-seg-other",
      title: `Other U.S. states ${formatScoirPct(otherRest)}`,
      name: "Other U.S. states",
      pctText: formatScoirPct(otherRest),
    });
  }
  if (intl > 0) {
    segs.push({
      key: "intl",
      left: intlLeft,
      width: intlW,
      className: "sb-seg sb-seg-intl",
      title: `International ${formatScoirPct(intl)}`,
      name: "International",
      pctText: formatScoirPct(intl),
    });
  }

  const calloutPad = callouts.some((c) => c.topPx < 0) ? 46 : callouts.length ? 28 : 0;

  return (
    <div className="sb-geo">
      <div className="sb-stack-wrap" style={{ paddingTop: calloutPad }}>
        {callouts.map((c) => (
          <div key={c.key} className="sb-callout-layer" aria-hidden="true">
            <div
              className="sb-leader"
              style={{
                left: `${c.xPct}%`,
                height: 20 - c.topPx,
                bottom: 0,
              }}
            />
            <div
              className="sb-callout"
              style={{
                left: `${c.xPct}%`,
                top: c.topPx,
                transform: c.shiftLeft
                  ? "translateX(calc(-100% - 8px))"
                  : "translateX(8px)",
              }}
            >
              {c.label}
            </div>
          </div>
        ))}
        <div className="sb-stack" role="img" aria-label="Where undergraduates come from">
          {segs.map((seg) => (
            <div
              key={seg.key}
              className={seg.className}
              title={seg.title}
              style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
            >
              {seg.width >= 14 ? (
                <span className="sb-seg-inner">
                  <span className="sb-seg-name">{seg.name}</span>
                  <span className="sb-seg-pct mono">{seg.pctText}</span>
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {geo.statesRepresented != null ? (
        <p className="sb-geo-note">
          Students come from <b>{geo.statesRepresented} states</b>. Top states outside{" "}
          {geo.homeState}:
        </p>
      ) : (
        <p className="sb-geo-note">Top states outside {geo.homeState}:</p>
      )}

      {topOutside.length ? (
        <div className="sb-rank">
          {topOutside.map((place) => {
            const isNj = /new jersey/i.test(place.place);
            return (
              <div
                key={place.place}
                className={`sb-rank-row${isNj ? " is-nj" : ""}`}
              >
                <span className="sb-rank-label">{place.place}</span>
                <div className="sb-rank-track">
                  <span
                    className="sb-rank-bar"
                    style={{ width: `${Math.max(2, (place.pct / topMax) * 100)}%` }}
                  />
                </div>
                <span className="sb-rank-pct mono">{formatScoirPct(place.pct)}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function RaceBars({ scoir }: { scoir: ScoirRecord }) {
  const race = scoir.undergradRaceEthnicityPct;
  if (!race) return null;
  const rows = RACE_LABELS.map((r) => ({
    ...r,
    pct: pctOrZero(race[r.key]),
  })).sort((a, b) => b.pct - a.pct);
  // Design scale: 40% fills the track. If any share is larger, expand the
  // scale so the longest bar fits instead of overflowing the row.
  const scale = Math.max(40, ...rows.map((r) => r.pct), 1);

  return (
    <div className="sb-race">
      {rows.map((row) => (
        <div key={row.key} className="sb-race-row">
          <span className="sb-race-label">{row.label}</span>
          <div className="sb-race-track">
            <span
              className="sb-race-bar"
              style={{
                width: `${Math.min(100, Math.max(0.8, (row.pct / scale) * 100))}%`,
              }}
            />
          </div>
          <span className="sb-race-pct mono">{formatScoirPct(row.pct)}</span>
        </div>
      ))}
    </div>
  );
}

function GenderGreek({ scoir }: { scoir: ScoirRecord }) {
  const gender = scoir.undergradGenderPct;
  const greek = scoir.greekLife;
  const female = pctOrZero(gender?.female);
  const male = pctOrZero(gender?.male);
  const genderTotal = female + male || 1;
  const femaleW = (female / genderTotal) * 100;
  const fullTime = scoir.undergradFullTimePct;

  const hasGreek =
    greek &&
    (greek.fraternities != null ||
      greek.sororities != null ||
      greek.fraternityParticipationPct != null ||
      greek.sororityParticipationPct != null);

  if (!gender && !hasGreek) return null;

  return (
    <div className="sb-side">
      {gender ? (
        <div className="sb-gender">
          <h4>Gender</h4>
          <div className="sb-stack sb-stack-gender" role="img" aria-label="Gender split">
            <div
              className="sb-seg sb-seg-home"
              style={{ width: `${femaleW}%` }}
              title={`Female ${formatScoirPct(female)}`}
            >
              <span className="sb-seg-inner">
                <span className="sb-seg-name">Female</span>
                <span className="sb-seg-pct mono">{formatScoirPct(female)}</span>
              </span>
            </div>
            <div
              className="sb-seg sb-seg-other sb-seg-male"
              title={`Male ${formatScoirPct(male)}`}
            >
              <span className="sb-seg-inner sb-seg-inner-end">
                <span className="sb-seg-name">Male</span>
                <span className="sb-seg-pct mono">{formatScoirPct(male)}</span>
              </span>
            </div>
          </div>
          {fullTime != null ? (
            <div className="sb-ft">
              <span className="sb-ft-label">Full time</span>
              <div className="sb-ft-track">
                <span
                  className="sb-ft-bar"
                  style={{ width: `${Math.min(100, fullTime)}%` }}
                />
              </div>
              <span className="sb-ft-pct mono">{formatScoirPct(fullTime)}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {hasGreek && greek ? (
        <div className="sb-greek">
          <h4>Greek life</h4>
          <div className="sb-greek-counts">
            {greek.fraternities != null ? (
              <div>
                <span className="sb-greek-n">{greek.fraternities}</span>
                <span className="sb-greek-l">fraternities</span>
              </div>
            ) : null}
            {greek.sororities != null ? (
              <div>
                <span className="sb-greek-n">{greek.sororities}</span>
                <span className="sb-greek-l">sororities</span>
              </div>
            ) : null}
          </div>
          {greek.fraternityParticipationPct != null ? (
            <div className="sb-ft">
              <span className="sb-ft-label">Men who join</span>
              <div className="sb-ft-track">
                <span
                  className="sb-ft-bar"
                  style={{
                    width: `${Math.min(100, greek.fraternityParticipationPct)}%`,
                  }}
                />
              </div>
              <span className="sb-ft-pct mono">
                {formatScoirPct(greek.fraternityParticipationPct)}
              </span>
            </div>
          ) : null}
          {greek.sororityParticipationPct != null ? (
            <div className="sb-ft">
              <span className="sb-ft-label">Women who join</span>
              <div className="sb-ft-track">
                <span
                  className="sb-ft-bar"
                  style={{
                    width: `${Math.min(100, greek.sororityParticipationPct)}%`,
                  }}
                />
              </div>
              <span className="sb-ft-pct mono">
                {formatScoirPct(greek.sororityParticipationPct)}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Snapshot Student Body block from Scoir (% of undergraduates). */
export function SchoolScoirStudentBody({ school }: { school: School }) {
  const scoir = scoirRecordForSchool(school);
  if (!scoir) return null;

  return (
    <section className="area scoir-area sb-area" aria-labelledby="snap-body-h">
      <h3 className="sb-title" id="snap-body-h">
        Student body
      </h3>
      <p className="sb-subhead">Share of undergraduates</p>

      <div className="sb-block">
        <h4>Where students come from</h4>
        <GeographyBars scoir={scoir} />
      </div>

      {scoir.undergradRaceEthnicityPct ? (
        <div className="sb-block">
          <h4>Race and ethnicity</h4>
          <RaceBars scoir={scoir} />
        </div>
      ) : null}

      {scoir.undergradGenderPct || scoir.greekLife ? (
        <div className="sb-block">
          <GenderGreek scoir={scoir} />
        </div>
      ) : null}

      <p className="sb-source">
        Source: {SCOIR_SOURCE_LABEL}, {SCOIR_PULLED_DATE}
      </p>
    </section>
  );
}
