"use client";

import type { School } from "@/lib/types";
import {
  SCOIR_PULLED_DATE,
  SCOIR_SOURCE_LABEL,
  formatScoirPct,
  scoirRecordForSchool,
  type ScoirRecord,
} from "@/lib/scoir";

function Fact({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  if (!value || value === "—") return null;
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd className={emphasize ? "scoir-em" : undefined}>{value}</dd>
    </div>
  );
}

function GeographyBlock({ scoir }: { scoir: ScoirRecord }) {
  const geo = scoir.undergradGeography;
  if (!geo) return <p className="section-sub">Not published</p>;

  return (
    <>
      <dl className="facts scoir-geo-facts">
        <Fact
          label={`${geo.homeState} (home state)`}
          value={formatScoirPct(geo.homeStatePct)}
        />
        {geo.complete ? (
          <>
            <Fact label="New Jersey" value={formatScoirPct(geo.newJerseyPct)} emphasize />
            <Fact label="Other U.S. states" value={formatScoirPct(geo.otherUsStatesPct)} />
            <Fact label="International" value={formatScoirPct(geo.internationalPct)} />
          </>
        ) : (
          <div className="fact">
            <dt>Other origins</dt>
            <dd>Scoir&apos;s data for this school is incomplete</dd>
          </div>
        )}
        {geo.statesRepresented != null ? (
          <Fact label="States represented" value={String(geo.statesRepresented)} />
        ) : null}
      </dl>
      {geo.topPlaces?.length ? (
        <div className="scoir-top-places">
          <span className="scoir-sublabel">Top places</span>
          <ul>
            {geo.topPlaces.map((place) => (
              <li key={place.place}>
                {place.place} · {formatScoirPct(place.pct)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function GreekBlock({ scoir }: { scoir: ScoirRecord }) {
  const g = scoir.greekLife;
  if (!g) return null;
  const frat = g.fraternities;
  const sor = g.sororities;
  if (frat == null && sor == null) return null;

  const chapterLine = [
    frat != null ? `${frat} fraternities` : null,
    sor != null ? `${sor} sororities` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const hasRates =
    g.fraternityParticipationPct != null || g.sororityParticipationPct != null;

  return (
    <dl className="facts">
      <Fact label="Chapters" value={chapterLine} />
      {hasRates ? (
        <>
          <Fact label="Men who join" value={formatScoirPct(g.fraternityParticipationPct)} />
          <Fact label="Women who join" value={formatScoirPct(g.sororityParticipationPct)} />
        </>
      ) : null}
    </dl>
  );
}

/** Snapshot Student Body block from Scoir (% of undergraduates). */
export function SchoolScoirStudentBody({ school }: { school: School }) {
  const scoir = scoirRecordForSchool(school);
  if (!scoir) return null;

  return (
    <section className="area scoir-area" aria-labelledby="snap-body-h">
      <span className="area-label" id="snap-body-h">
        Student Body
      </span>
      <span className="area-head">% of undergraduates</span>

      <div className="scoir-body-block">
        <h4>Where students come from</h4>
        <GeographyBlock scoir={scoir} />
      </div>

      {scoir.undergradRaceEthnicityPct ? (
        <div className="scoir-body-block">
          <h4>Race and ethnicity</h4>
          <dl className="facts">
            <Fact label="Asian" value={formatScoirPct(scoir.undergradRaceEthnicityPct.asian)} />
            <Fact label="Black" value={formatScoirPct(scoir.undergradRaceEthnicityPct.black)} />
            <Fact
              label="Hispanic"
              value={formatScoirPct(scoir.undergradRaceEthnicityPct.hispanic)}
            />
            <Fact label="White" value={formatScoirPct(scoir.undergradRaceEthnicityPct.white)} />
            <Fact
              label="American Indian"
              value={formatScoirPct(scoir.undergradRaceEthnicityPct.americanIndian)}
            />
            <Fact
              label="Two or more races, international, other and not reported"
              value={formatScoirPct(scoir.undergradRaceEthnicityPct.allOther)}
            />
          </dl>
        </div>
      ) : null}

      {scoir.undergradGenderPct ? (
        <div className="scoir-body-block">
          <h4>Gender</h4>
          <dl className="facts">
            <Fact label="Female" value={formatScoirPct(scoir.undergradGenderPct.female)} />
            <Fact label="Male" value={formatScoirPct(scoir.undergradGenderPct.male)} />
            <Fact
              label="Full time"
              value={
                scoir.undergradFullTimePct != null
                  ? formatScoirPct(scoir.undergradFullTimePct)
                  : "—"
              }
            />
          </dl>
        </div>
      ) : null}

      <div className="scoir-body-block">
        <h4>Greek life</h4>
        <GreekBlock scoir={scoir} />
      </div>

      <p className="section-sub scoir-note">
        Source: {SCOIR_SOURCE_LABEL}, {SCOIR_PULLED_DATE}
      </p>
    </section>
  );
}
