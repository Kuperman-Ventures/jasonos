"use client";

import type { School } from "@/lib/types";
import {
  SCOIR_DEADLINES_LABEL,
  SCOIR_PULLED_DATE,
  formatScoirDeadline,
  formatScoirMoney,
  formatScoirPct,
  formatScoirPlatforms,
  scoirNeedsOutOfStateNetPriceNote,
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

function moneyOrDash(n: number | null | undefined): string {
  return formatScoirMoney(n);
}

function req(value: string | null | undefined): string {
  return value?.trim() || "";
}

function GeographyBlock({ scoir }: { scoir: ScoirRecord }) {
  const geo = scoir.undergradGeography;
  if (!geo) return <p className="section-sub">Not published</p>;

  if (!geo.complete) {
    return (
      <p className="section-sub">Scoir&apos;s data for this school is incomplete</p>
    );
  }

  return (
    <>
      <dl className="facts scoir-geo-facts">
        <Fact label={`${geo.homeState} (home state)`} value={formatScoirPct(geo.homeStatePct)} />
        <Fact label="New Jersey" value={formatScoirPct(geo.newJerseyPct)} emphasize />
        <Fact label="Other U.S. states" value={formatScoirPct(geo.otherUsStatesPct)} />
        <Fact label="International" value={formatScoirPct(geo.internationalPct)} />
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

  const hasRates =
    g.fraternityParticipationPct != null || g.sororityParticipationPct != null;

  return (
    <dl className="facts">
      <Fact
        label="Chapters"
        value={[
          frat != null ? `${frat} fraternities` : null,
          sor != null ? `${sor} sororities` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      {hasRates ? (
        <>
          <Fact
            label="Men who join"
            value={formatScoirPct(g.fraternityParticipationPct)}
          />
          <Fact
            label="Women who join"
            value={formatScoirPct(g.sororityParticipationPct)}
          />
        </>
      ) : null}
    </dl>
  );
}

function NetPriceTable({ scoir }: { scoir: ScoirRecord }) {
  const np = scoir.netPriceByIncome;
  if (!np) return null;
  const rows: { label: string; value: number | null }[] = [
    { label: "Under $30k", value: np.under30k },
    { label: "$30k–$48k", value: np["30to48k"] },
    { label: "$48k–$75k", value: np["48to75k"] },
    { label: "$75k–$110k", value: np["75to110k"] },
    { label: "Over $110k", value: np.over110k },
    { label: "Average", value: np.average },
  ];
  return (
    <div className="scoir-net-price">
      <table>
        <thead>
          <tr>
            <th>Family income</th>
            <th>Net price</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td className="mono">{moneyOrDash(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SchoolScoirSections({ school }: { school: School }) {
  const scoir = scoirRecordForSchool(school);
  if (!scoir) return null;

  const oosNote = scoirNeedsOutOfStateNetPriceNote(school);

  return (
    <div className="scoir-sections">
      <div className="scoir-as-of mono">Scoir data as of {SCOIR_PULLED_DATE}</div>

      <section className="area scoir-area" aria-labelledby="scoir-apply-h">
        <span className="area-label" id="scoir-apply-h">
          Applying
        </span>
        <dl className="facts">
          <Fact label="Scoir list" value={scoir.scoirListStatus} />
          <Fact label="Platforms" value={formatScoirPlatforms(scoir.applicationPlatforms)} />
          <Fact label="Essay or statement" value={req(scoir.essayOrStatement)} />
          <Fact label="Resume" value={req(scoir.resume)} />
          <Fact label="Portfolio" value={req(scoir.portfolio)} />
          <Fact label="Interview" value={req(scoir.interview)} />
          <Fact
            label="Demonstrated interest"
            value={scoir.considersDemonstratedInterest ? "Considers" : "Does not consider"}
          />
          <Fact label="Application fee" value={moneyOrDash(scoir.applicationFee)} />
          {scoir.honorsCollege ? (
            <Fact label="Honors college" value={scoir.honorsCollege} />
          ) : null}
        </dl>
        {scoir.fall2027EntryDeadlines?.length ? (
          <div className="scoir-deadlines">
            <span className="scoir-sublabel">{SCOIR_DEADLINES_LABEL}</span>
            <ul>
              {scoir.fall2027EntryDeadlines.map((round) => (
                <li key={`${round.roundType}-${round.deadline}`}>
                  <strong>{round.roundType}</strong>
                  <span className="mono"> {formatScoirDeadline(round.deadline)}</span>
                  {round.binding ? <span className="scoir-binding"> · Binding</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="area scoir-area" aria-labelledby="scoir-admit-h">
        <span className="area-label" id="scoir-admit-h">
          Admission Statistics
        </span>
        <dl className="facts">
          <Fact label="Admit rate" value={formatScoirPct(scoir.admitRatePct)} />
          <Fact
            label="Applicants"
            value={scoir.applicants != null ? scoir.applicants.toLocaleString("en-US") : ""}
          />
          <Fact
            label="Admitted"
            value={scoir.admitted != null ? scoir.admitted.toLocaleString("en-US") : ""}
          />
          <Fact
            label="Enrolled"
            value={scoir.enrolled != null ? scoir.enrolled.toLocaleString("en-US") : ""}
          />
          <Fact label="SAT mid-50" value={scoir.satMid50?.replace(/-/g, "–") || ""} />
          <Fact label="SAT Math mid-50" value={scoir.satMathMid50?.replace(/-/g, "–") || ""} />
          <Fact
            label="SAT R/W mid-50"
            value={scoir.satReadingWritingMid50?.replace(/-/g, "–") || ""}
          />
          <Fact label="ACT mid-50" value={scoir.actMid50?.replace(/-/g, "–") || ""} />
          <Fact label="First-year retention" value={formatScoirPct(scoir.firstYearRetentionPct)} />
          <Fact
            label="Engineering share of degrees"
            value={formatScoirPct(scoir.engineeringShareOfDegreesPct)}
          />
        </dl>
      </section>

      <section className="area scoir-area" aria-labelledby="scoir-cost-h">
        <span className="area-label" id="scoir-cost-h">
          Cost And Aid
        </span>
        <dl className="facts">
          <Fact label="Sticker (in-state)" value={moneyOrDash(scoir.stickerPriceInState)} />
          <Fact label="Sticker (out-of-state)" value={moneyOrDash(scoir.stickerPriceOutOfState)} />
          <Fact label="Tuition (in-state)" value={moneyOrDash(scoir.tuitionInState)} />
          <Fact label="Tuition (out-of-state)" value={moneyOrDash(scoir.tuitionOutOfState)} />
          <Fact label="Room and board" value={moneyOrDash(scoir.roomAndBoard)} />
          <Fact label="Receiving any aid" value={formatScoirPct(scoir.pctReceivingAid, 0)} />
          <Fact label="Federal loans" value={formatScoirPct(scoir.pctFederalLoans, 0)} />
          <Fact label="Median debt at graduation" value={moneyOrDash(scoir.medianDebtAtGraduation)} />
        </dl>
        {scoir.netPriceByIncomeNote ? (
          <p className="section-sub scoir-note">{scoir.netPriceByIncomeNote}</p>
        ) : null}
        {oosNote ? (
          <p className="section-sub scoir-note">
            Kyle would pay out-of-state prices, so his cost will be higher than these figures.
          </p>
        ) : null}
        <NetPriceTable scoir={scoir} />
      </section>

      <section className="area scoir-area" aria-labelledby="scoir-body-h">
        <span className="area-label" id="scoir-body-h">
          Student Body
        </span>
        <span className="scoir-sublabel">% of undergraduates</span>
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
              <Fact label="Full-time" value={formatScoirPct(scoir.undergradFullTimePct)} />
            </dl>
          </div>
        ) : null}
        <div className="scoir-body-block">
          <h4>Greek life</h4>
          <GreekBlock scoir={scoir} />
        </div>
        {(scoir.nearestAirport || scoir.ncaaDivision || scoir.rotc?.length) ? (
          <div className="scoir-body-block">
            <h4>Campus extras</h4>
            <dl className="facts">
              {scoir.nearestAirport ? (
                <Fact
                  label="Nearest airport"
                  value={`${scoir.nearestAirport}${
                    scoir.nearestAirportMiles != null ? ` · ${scoir.nearestAirportMiles} mi` : ""
                  }`}
                />
              ) : null}
              {scoir.nearestTrainStation ? (
                <Fact
                  label="Nearest train"
                  value={`${scoir.nearestTrainStation}${
                    scoir.nearestTrainStationMiles != null
                      ? ` · ${scoir.nearestTrainStationMiles} mi`
                      : ""
                  }`}
                />
              ) : null}
              {scoir.ncaaDivision ? (
                <Fact
                  label="Athletics"
                  value={`NCAA D${scoir.ncaaDivision}${
                    scoir.conference ? ` · ${scoir.conference}` : ""
                  }`}
                />
              ) : null}
              {scoir.rotc?.length ? (
                <Fact label="ROTC" value={scoir.rotc.join(", ")} />
              ) : null}
            </dl>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function ScoirListBadge({ school }: { school: School }) {
  const scoir = scoirRecordForSchool(school);
  if (!scoir) return null;
  return <small className="scoir-list-badge">Scoir: {scoir.scoirListStatus}</small>;
}
