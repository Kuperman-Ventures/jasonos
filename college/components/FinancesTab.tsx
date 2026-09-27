"use client";

import { useMemo, useState } from "react";
import {
  admitRateForChart,
  budgetCompareCost,
  budgetStatus,
  budgetSummary,
  buildFinanceRows,
  chartCost,
  costAfterTypicalMerit,
  financesSchoolCount,
  fourYearEstimate,
  interestCssVar,
  interestLevelRank,
  isNjStateAidSchool,
  meetsFullNeedBadge,
  meritShareLabel,
  money,
  moneyCompact,
  newJerseyGrantsPortable,
  newJerseyStatePrograms,
  residencyReclassification,
  shortSchoolName,
  type FinanceRow,
  type HouseholdFinances,
} from "@/lib/finances";
import type { InterestLevel, School } from "@/lib/types";

type SortKey =
  | "school"
  | "cost"
  | "meritShare"
  | "avgMerit"
  | "afterMerit"
  | "estimate"
  | "fourYear"
  | "col"
  | "budget";

type FilterState = {
  awardsMerit: boolean;
  withinBudget: boolean;
  meetsFullNeed: boolean;
  noCss: boolean;
  interest: InterestLevel | "";
};

function parseMoneyInput(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function sortValue(row: FinanceRow, key: SortKey, household: HouseholdFinances): number | string {
  const { finance, entry, school } = row;
  switch (key) {
    case "school":
      return school.name.toLowerCase();
    case "cost":
      return finance.totalCost ?? -1;
    case "meritShare":
      return finance.awardsMerit ? (finance.meritSharePct ?? -1) : -2;
    case "avgMerit":
      return finance.awardsMerit ? (finance.cdsAvgNonNeedMerit ?? -1) : -2;
    case "afterMerit":
      return costAfterTypicalMerit(finance) ?? -1;
    case "estimate":
      return entry.netPriceEstimate ?? -1;
    case "fourYear":
      return fourYearEstimate(finance, entry, household.costIncreasePct) ?? -1;
    case "col":
      return finance.costOfLivingIndex;
    case "budget": {
      const status = budgetStatus(budgetCompareCost(finance, entry), household.annualBudget);
      if (status.kind === "within") return 0;
      if (status.kind === "over") return status.overBy;
      return Number.POSITIVE_INFINITY;
    }
    default:
      return 0;
  }
}

export function FinancesTab({
  schools,
  household,
  onHouseholdChange,
  dateline,
  onOpenSchool,
}: {
  schools: School[];
  household: HouseholdFinances;
  onHouseholdChange: (next: HouseholdFinances) => void;
  dateline: string;
  onOpenSchool: (schoolId: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("meritShare");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<FilterState>({
    awardsMerit: false,
    withinBudget: false,
    meetsFullNeed: false,
    noCss: false,
    interest: "",
  });
  const [budgetDraft, setBudgetDraft] = useState(
    household.annualBudget != null ? String(household.annualBudget) : "",
  );
  const [increaseDraft, setIncreaseDraft] = useState(String(household.costIncreasePct));
  const [openNj, setOpenNj] = useState<string | null>(null);

  const { rows } = useMemo(() => buildFinanceRows(schools, household), [schools, household]);
  const schoolIdByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const school of schools) map.set(school.name, school.id);
    return map;
  }, [schools]);

  const summary = useMemo(
    () =>
      budgetSummary(
        rows.map((r) => r.finance),
        household.annualBudget,
        household.schools,
        schoolIdByName,
      ),
    [rows, household, schoolIdByName],
  );

  const filtered = useMemo(() => {
    return rows.filter(({ finance, entry, school }) => {
      if (filters.awardsMerit && !finance.awardsMerit) return false;
      if (filters.meetsFullNeed && !meetsFullNeedBadge(finance)) return false;
      if (filters.noCss && finance.cssProfileRequired) return false;
      if (filters.interest && school.interestLevel !== filters.interest) return false;
      if (filters.withinBudget) {
        const status = budgetStatus(budgetCompareCost(finance, entry), household.annualBudget);
        if (status.kind !== "within") return false;
      }
      return true;
    });
  }, [rows, filters, household.annualBudget]);

  const sorted = useMemo(() => {
    const next = [...filtered];
    next.sort((a, b) => {
      const av = sortValue(a, sortKey, household);
      const bv = sortValue(b, sortKey, household);
      let cmp = 0;
      if (typeof av === "string" && typeof bv === "string") cmp = av.localeCompare(bv);
      else cmp = Number(av) - Number(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return next;
  }, [filtered, sortKey, sortDir, household]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "school" ? "asc" : "desc");
  }

  function commitBudget() {
    onHouseholdChange({
      ...household,
      annualBudget: parseMoneyInput(budgetDraft),
    });
  }

  function commitIncrease() {
    const n = Number(increaseDraft);
    onHouseholdChange({
      ...household,
      costIncreasePct: Number.isFinite(n) ? n : 4,
    });
  }

  const njPrograms = newJerseyStatePrograms();
  const count = financesSchoolCount();

  return (
    <section className="finances-page">
      <header className="fin-page-head">
        <div className="dateline accent mono">{dateline}</div>
        <h1 className="fin-page-title">Finances</h1>
      </header>

      <div className="fin-list-block">
      <div className="fin-family-inputs">
        <label className="stack-field">
          <span className="label">Budget per year</span>
          <div className="fin-affix-field">
            <span aria-hidden="true">$</span>
            <input
              className="field mono"
              inputMode="numeric"
              value={budgetDraft}
              placeholder="60000"
              onChange={(e) => setBudgetDraft(e.target.value)}
              onBlur={commitBudget}
            />
          </div>
        </label>
        <label className="stack-field">
          <span className="label">Yearly cost increase</span>
          <div className="fin-affix-field suffix">
            <input
              className="field mono"
              inputMode="decimal"
              value={increaseDraft}
              onChange={(e) => setIncreaseDraft(e.target.value)}
              onBlur={commitIncrease}
            />
            <span aria-hidden="true">%</span>
          </div>
        </label>
      </div>

      <p className="fin-summary">
        {household.annualBudget == null ? (
          <>Set a yearly budget to see how many of the {count} schools fit.</>
        ) : (
          <>
            <strong className="accent">{summary.withinBudget} of {count} schools</strong> have a
            published cost within your budget.{" "}
            <strong>{summary.withinWithMerit} more</strong> could be within budget with a typical
            merit award.
          </>
        )}
      </p>

      <div className="fin-filters">
        {(
          [
            ["awardsMerit", "Awards merit"],
            ["withinBudget", "Within budget"],
            ["meetsFullNeed", "Meets full need"],
            ["noCss", "CSS Profile not required"],
          ] as const
        ).map(([key, label]) => {
          const on = filters[key];
          return (
            <button
              key={key}
              type="button"
              className={`fin-chip${on ? " on" : ""}`}
              aria-pressed={on}
              onClick={() => setFilters((f) => ({ ...f, [key]: !f[key] }))}
            >
              {label}
            </button>
          );
        })}
        <label className="fin-interest-filter">
          <span className="sr-only">Interest level</span>
          <select
            className="field"
            value={filters.interest}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                interest: e.target.value as InterestLevel | "",
              }))
            }
          >
            <option value="">All interest levels</option>
            <option value="top">Top choice</option>
            <option value="high">High</option>
            <option value="moderate">Moderate</option>
            <option value="safety">Safety</option>
          </select>
        </label>
        <span className="fin-shown mono">
          {sorted.length} of {count} shown
        </span>
      </div>

      <div className="fin-table-wrap">
        <table className="fin-table">
          <thead>
            <tr>
              {(
                [
                  ["school", "School"],
                  ["cost", "Published cost"],
                  ["meritShare", "Merit share"],
                  ["avgMerit", "Average merit"],
                  ["afterMerit", "After typical merit"],
                  ["estimate", "Your estimate"],
                  ["fourYear", "4-year estimate"],
                  ["col", "Cost of living"],
                  ["budget", "Budget"],
                ] as const
              ).map(([key, label]) => (
                <th
                  key={key}
                  className={key === "school" ? undefined : "num"}
                  aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button type="button" onClick={() => toggleSort(key)}>
                    {label}
                    {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ school, finance, entry }) => {
              const after = costAfterTypicalMerit(finance);
              const status = budgetStatus(budgetCompareCost(finance, entry), household.annualBudget);
              const four = fourYearEstimate(finance, entry, household.costIncreasePct);
              return (
                <tr
                  key={school.id}
                  className={interestLevelRank(school.interestLevel) === 4 ? "top-choice" : undefined}
                  onClick={() => onOpenSchool(school.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenSchool(school.id);
                    }
                  }}
                  tabIndex={0}
                  role="link"
                >
                  <td>
                    <div className="fin-school-cell">
                      <span
                        className="fin-interest-swatch"
                        style={{ background: interestCssVar(school.interestLevel) }}
                        aria-hidden="true"
                      />
                      <div>
                        <div className="fin-school-name">{school.name}</div>
                        <div className="fin-badges">
                          {meetsFullNeedBadge(finance) ? (
                            <span className="fin-badge">Meets full need</span>
                          ) : null}
                          {finance.needBlindUS ? <span className="fin-badge">Need-blind</span> : null}
                          {finance.cssProfileRequired ? (
                            <span className="fin-badge">CSS Profile</span>
                          ) : null}
                          {!finance.awardsMerit ? (
                            <span className="fin-badge dashed">No merit aid</span>
                          ) : null}
                          {isNjStateAidSchool(school.name) ? (
                            <span className="fin-badge accent">NJ state aid</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="num mono">{money(finance.totalCost)}</td>
                  <td className="num">
                    <div className="fin-merit-cell mono">{meritShareLabel(finance)}</div>
                    {finance.awardsMerit && finance.meritSharePct != null ? (
                      <div className="fin-merit-meter" aria-hidden="true">
                        <span style={{ width: `${Math.min(100, (finance.meritSharePct / 55) * 100)}%` }} />
                      </div>
                    ) : null}
                  </td>
                  <td className="num mono">
                    {!finance.awardsMerit
                      ? "—"
                      : finance.cdsAvgNonNeedMerit == null
                        ? "Not published"
                        : money(finance.cdsAvgNonNeedMerit)}
                  </td>
                  <td className="num mono">{after == null ? "—" : money(after)}</td>
                  <td className="num mono">
                    {entry.netPriceEstimate != null ? (
                      <>
                        {money(entry.netPriceEstimate)}
                        {entry.netPriceDate ? (
                          <div className="fin-sub">run {entry.netPriceDate}</div>
                        ) : null}
                      </>
                    ) : finance.netPriceCalculatorUrl ? (
                      <a
                        className="text-link"
                        href={finance.netPriceCalculatorUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Run calculator ↗
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="num mono">{four == null ? "Not published" : money(four)}</td>
                  <td className="num mono">{finance.costOfLivingIndex} (US avg 100)</td>
                  <td className="num">
                    {status.kind === "within" ? (
                      <span className="fin-within">Within budget</span>
                    ) : status.kind === "over" ? (
                      <span className="accent">Over by {moneyCompact(status.overBy)}</span>
                    ) : (
                      <span className="subtle">Not published</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>

      <AdmitCostChart rows={sorted} household={household} onOpenSchool={onOpenSchool} />

      <section className="fin-nj">
        <h3>New Jersey state aid</h3>
        <p className="section-sub">{newJerseyGrantsPortable()}</p>
        <div className="fin-nj-list">
          {njPrograms.map((program) => {
            const open = openNj === program.name;
            return (
              <div key={program.name} className="fin-nj-row">
                <div>
                  <div className="fin-nj-name">{program.name}</div>
                  <div className="fin-badges">
                    {program.appliesTo.map((c) => (
                      <span key={c} className="fin-badge">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="fin-nj-meta">
                  <div>
                    <span className="label">Award</span>
                    <div>{program.award}</div>
                  </div>
                  <div>
                    <span className="label">Application</span>
                    <div>{program.application}</div>
                  </div>
                  <div>
                    <span className="label">Deadline</span>
                    <div className="mono">{program.deadline}</div>
                  </div>
                  <button
                    type="button"
                    className="ghost-btn"
                    aria-expanded={open}
                    onClick={() => setOpenNj(open ? null : program.name)}
                  >
                    Eligibility
                  </button>
                  {open ? <p className="section-sub">{program.eligibility}</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <ResidencyReclassificationSection />
    </section>
  );
}

function ResidencyReclassificationSection() {
  const residency = residencyReclassification();
  return (
    <section className="fin-nj fin-residency">
      <h3>Changing To In-State Tuition After Enrolling</h3>
      <p className="section-sub">{residency.summary}</p>
      <p className="fin-residency-label">What States Usually Require</p>
      <div className="fin-nj-list">
        {residency.requirements.map((item) => (
          <div key={item.label} className="fin-nj-row">
            <div className="fin-nj-name">{item.label}</div>
            <div>{item.detail}</div>
          </div>
        ))}
      </div>
      <p className="section-sub">{residency.tradeOff}</p>
      <p className="fin-residency-label">Other Ways To Lower Out-Of-State Cost</p>
      <div className="fin-nj-list">
        {residency.alternatives.map((item) => (
          <div key={item.label} className="fin-nj-row">
            <div className="fin-nj-name">{item.label}</div>
            <div>{item.detail}</div>
          </div>
        ))}
      </div>
      <p className="section-sub">{residency.whereToCheck}</p>
    </section>
  );
}

function AdmitCostChart({
  rows,
  household,
  onOpenSchool,
}: {
  rows: FinanceRow[];
  household: HouseholdFinances;
  onOpenSchool: (id: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const width = 640;
  const height = 440;
  const pad = { top: 24, right: 72, bottom: 40, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const points = rows
    .map((row) => {
      const admit = admitRateForChart(row.school);
      const cost = chartCost(row.finance, row.entry);
      if (admit == null || cost == null) return null;
      return {
        id: row.school.id,
        name: shortSchoolName(row.school.name),
        admit,
        cost,
        color: interestCssVar(row.school.interestLevel),
        x: pad.left + (admit / 100) * plotW,
        y: pad.top + (1 - Math.min(cost, 100_000) / 100_000) * plotH,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p != null);

  const budgetY =
    household.annualBudget != null
      ? pad.top + (1 - Math.min(household.annualBudget, 100_000) / 100_000) * plotH
      : null;

  return (
    <section className="fin-chart">
      <div className="fin-chart-head">
        <h3>Admit Rate And Cost</h3>
        <p className="fin-chart-sub">
          Each point uses your estimate if entered, otherwise the cost after a typical merit award,
          otherwise the published cost. Schools below the budget line and toward the right are
          likely admits within budget.
        </p>
      </div>
      <div className="fin-chart-legend">
        <span>
          <i style={{ background: "var(--lvl-4)" }} /> Top choice
        </span>
        <span>
          <i style={{ background: "var(--lvl-3)" }} /> High interest
        </span>
        <span>
          <i style={{ background: "var(--lvl-2)" }} /> Moderate interest
        </span>
        <span>
          <i style={{ background: "var(--lvl-1)" }} /> Safety / backup
        </span>
      </div>
      <div className="fin-chart-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Admit rate versus cost">
          {budgetY != null ? (
            <rect
              x={pad.left + plotW * 0.5}
              y={budgetY}
              width={plotW * 0.5}
              height={pad.top + plotH - budgetY}
              fill="var(--color-accent-tint)"
              opacity={0.55}
            />
          ) : null}
          {[0, 25, 50, 75, 100].map((v) => {
            const x = pad.left + (v / 100) * plotW;
            return (
              <g key={`vx-${v}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={pad.top}
                  y2={pad.top + plotH}
                  stroke="var(--color-rule)"
                />
                <text x={x} y={height - 12} textAnchor="middle" className="fin-axis">
                  {v}%
                </text>
              </g>
            );
          })}
          {[0, 25_000, 50_000, 75_000, 100_000].map((v) => {
            const y = pad.top + (1 - v / 100_000) * plotH;
            return (
              <g key={`hy-${v}`}>
                <line
                  x1={pad.left}
                  x2={pad.left + plotW}
                  y1={y}
                  y2={y}
                  stroke="var(--color-rule)"
                />
                <text x={pad.left - 8} y={y + 4} textAnchor="end" className="fin-axis">
                  ${v / 1000}k
                </text>
              </g>
            );
          })}
          <line
            x1={pad.left}
            x2={pad.left}
            y1={pad.top}
            y2={pad.top + plotH}
            stroke="var(--color-divider)"
          />
          <line
            x1={pad.left}
            x2={pad.left + plotW}
            y1={pad.top + plotH}
            y2={pad.top + plotH}
            stroke="var(--color-divider)"
          />
          {budgetY != null && household.annualBudget != null ? (
            <g>
              <line
                x1={pad.left}
                x2={pad.left + plotW}
                y1={budgetY}
                y2={budgetY}
                stroke="var(--color-accent)"
                strokeWidth={2}
              />
              <rect
                x={pad.left + plotW - 2}
                y={budgetY - 10}
                width={70}
                height={20}
                fill="var(--color-bg)"
              />
              <text x={pad.left + plotW + 4} y={budgetY + 4} className="fin-axis accent">
                Budget {moneyCompact(household.annualBudget)}
              </text>
            </g>
          ) : null}
          {budgetY != null ? (
            <text
              x={pad.left + plotW * 0.75}
              y={budgetY + 18}
              textAnchor="middle"
              className="fin-axis"
            >
              Likely admit · within budget
            </text>
          ) : null}
          {points.map((p) => (
            <g key={p.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={7}
                fill={p.color}
                stroke="var(--color-bg)"
                strokeWidth={2}
                tabIndex={0}
                role="button"
                aria-label={`${p.name}, ${p.admit}% admit, ${moneyCompact(p.cost)}`}
                onMouseEnter={() => setHover(p.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(p.id)}
                onBlur={() => setHover(null)}
                onClick={() => onOpenSchool(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenSchool(p.id);
                  }
                }}
                style={{ cursor: "pointer" }}
              />
              {hover === p.id ? (
                <g>
                  <rect
                    x={p.x + 10}
                    y={p.y - 28}
                    width={140}
                    height={36}
                    rx={2}
                    fill="var(--color-raised)"
                    stroke="var(--color-border)"
                  />
                  <text x={p.x + 18} y={p.y - 12} className="fin-axis">
                    {p.name}
                  </text>
                  <text x={p.x + 18} y={p.y + 2} className="fin-axis">
                    {Math.round(p.admit)}% · {moneyCompact(p.cost)}
                  </text>
                </g>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
