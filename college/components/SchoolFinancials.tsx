"use client";

import { useMemo, useState } from "react";
import {
  HOME_HOUSING_INDEX,
  HOME_PRICE_INDEX,
  budgetStatus,
  costAfterTypicalMerit,
  fourYearEstimate,
  financeRecordForSchoolName,
  isNjStateAidSchool,
  meetsFullNeedBadge,
  money,
  moneyCompact,
  needProgramOpenToNj,
  residencyLabel,
  schoolFinanceEntry,
  type HouseholdFinances,
  type HouseholdSchoolFinance,
} from "@/lib/finances";
import type { School } from "@/lib/types";

type AidKind = "apply" | "admit" | "need" | "closed";

type AidRow = {
  id: string;
  kind: AidKind;
  name: string;
  amount: string;
  deadline: string;
  separateApplication: boolean;
  sourceUrl: string;
};

function parseMoneyInput(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function aidRows(finance: NonNullable<ReturnType<typeof financeRecordForSchoolName>>): AidRow[] {
  const rows: AidRow[] = [];
  for (const [index, item] of finance.meritScholarships.entries()) {
    rows.push({
      id: `merit-${index}`,
      kind: item.separateApplication ? "apply" : "admit",
      name: item.name,
      amount: item.amount,
      deadline: item.deadline,
      separateApplication: item.separateApplication,
      sourceUrl: item.sourceUrl,
    });
  }
  for (const [index, item] of finance.needPrograms.entries()) {
    const open = needProgramOpenToNj(item);
    rows.push({
      id: `need-${index}`,
      kind: open ? "need" : "closed",
      name: item.name,
      amount: item.covers,
      deadline: "—",
      separateApplication: false,
      sourceUrl: item.sourceUrl,
    });
  }
  return rows;
}

function ColMarker({
  index,
  home,
  label,
}: {
  index: number;
  home: number;
  label: string;
}) {
  const min = 80;
  const max = 220;
  const pct = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))}%`;
  return (
    <div className="fin-col-track-wrap">
      <div className="fin-col-track-label">{label}</div>
      <div className="fin-col-track" aria-hidden="true">
        <span className="fin-col-us" style={{ left: pct(100) }} title="US average 100" />
        <span className="fin-col-home" style={{ left: pct(home) }} title={`Home ${home}`} />
        <span className="fin-col-school" style={{ left: pct(index) }} title={`Campus ${index}`} />
      </div>
    </div>
  );
}

export function SchoolFinancials({
  school,
  household,
  onHouseholdChange,
  scholarshipTodoIds,
  onAddScholarshipTodo,
}: {
  school: School;
  household: HouseholdFinances;
  onHouseholdChange: (next: HouseholdFinances) => void;
  scholarshipTodoIds: Record<string, string>;
  onAddScholarshipTodo: (scholarshipKey: string, title: string) => void;
}) {
  const finance = financeRecordForSchoolName(school.name);
  const entry = schoolFinanceEntry(household, school.id);
  const rows = useMemo(() => (finance ? aidRows(finance) : []), [finance]);

  const [estimateDraft, setEstimateDraft] = useState(
    entry.netPriceEstimate != null ? String(entry.netPriceEstimate) : "",
  );
  const [dateDraft, setDateDraft] = useState(entry.netPriceDate ?? "");
  const [meritDraft, setMeritDraft] = useState(
    entry.meritAwardOffered != null ? String(entry.meritAwardOffered) : "",
  );

  if (!finance) {
    return (
      <section className="school-modal-section">
        <div className="school-overview-head">
          <h3>Financials</h3>
          <p className="section-sub">No published finance record for this school yet.</p>
        </div>
      </section>
    );
  }

  const afterMerit = costAfterTypicalMerit(finance);
  const compareCost =
    entry.netPriceEstimate != null ? entry.netPriceEstimate : finance.totalCost;
  const vs = budgetStatus(compareCost, household.annualBudget);
  const fourYear = fourYearEstimate(finance, entry, household.costIncreasePct);
  const typicalMerit = finance.awardsMerit ? finance.cdsAvgNonNeedMerit : null;

  function patchEntry(patch: Partial<HouseholdSchoolFinance>) {
    const current = schoolFinanceEntry(household, school.id);
    onHouseholdChange({
      ...household,
      schools: {
        ...household.schools,
        [school.id]: { ...current, ...patch },
      },
    });
  }

  const maxBar = 100_000;
  const parts = [
    { key: "tuition", label: "Tuition & fees", value: finance.tuitionFees, cls: "tuition" },
    { key: "housing", label: "Housing & food", value: finance.housingFood, cls: "housing" },
    { key: "books", label: "Books", value: finance.booksSupplies, cls: "books" },
    { key: "other", label: "Other", value: finance.otherCosts, cls: "other" },
  ];

  const applyTiles = finance.meritScholarships.filter((s) => s.separateApplication);
  const admitTiles = finance.meritScholarships.filter((s) => !s.separateApplication);
  const openNeed = finance.needPrograms.filter((p) => needProgramOpenToNj(p));
  const closedNeed = finance.needPrograms.filter((p) => !needProgramOpenToNj(p));

  const groups: { kind: AidKind; label: string; items: { name: string; amount: string }[] }[] = (
    [
      {
        kind: "apply" as const,
        label: "Merit · apply separately",
        items: applyTiles.map((s) => ({ name: s.name, amount: s.amount })),
      },
      {
        kind: "admit" as const,
        label: "Merit · with admission",
        items: admitTiles.map((s) => ({ name: s.name, amount: s.amount })),
      },
      {
        kind: "need" as const,
        label: "Need-based · open to you",
        items: openNeed.map((s) => ({ name: s.name, amount: s.covers })),
      },
      {
        kind: "closed" as const,
        label: "Not for NJ residents",
        items: closedNeed.map((s) => ({ name: s.name, amount: s.covers })),
      },
    ] as const
  ).filter((g) => g.items.length > 0);

  return (
    <section className="school-modal-section fin-school">
      <div className="school-overview-head">
        <h3>Financials</h3>
        <p className="section-sub mono">
          Financials · {finance.costYear} · {residencyLabel(finance.residencyRate)}
        </p>
      </div>

      <div className="school-reqs-stats fin-stats">
        <div className="school-reqs-stat">
          <div className="school-reqs-stat-value">{money(finance.totalCost)}</div>
          <div className="mono label">Published cost</div>
          <div className="school-reqs-stat-sub">1 year sticker</div>
        </div>
        <div className="school-reqs-stat">
          <div className="school-reqs-stat-value">
            {!finance.awardsMerit
              ? "None"
              : finance.meritSharePct == null
                ? "Not published"
                : `${Math.round(finance.meritSharePct)}%`}
          </div>
          <div className="mono label">Typical merit</div>
          <div className="school-reqs-stat-sub">
            {typicalMerit != null ? `avg ${moneyCompact(typicalMerit)}` : "—"}
          </div>
        </div>
        <div className="school-reqs-stat">
          <div className="school-reqs-stat-value">
            {entry.netPriceEstimate != null
              ? money(entry.netPriceEstimate)
              : afterMerit != null
                ? money(afterMerit)
                : "—"}
          </div>
          <div className="mono label">
            {entry.netPriceEstimate != null ? "Your estimate" : "After typical merit"}
          </div>
          <div className="school-reqs-stat-sub">
            {fourYear != null ? `4-year ${moneyCompact(fourYear)}` : "—"}
          </div>
        </div>
        <div className="school-reqs-stat">
          <div
            className={`school-reqs-stat-value${vs.kind === "over" ? " hot" : ""}`}
          >
            {vs.kind === "within" ? "Within" : vs.kind === "over" ? `+${moneyCompact(vs.overBy)}` : "—"}
          </div>
          <div className="mono label">Vs budget</div>
          <div className="school-reqs-stat-sub">
            {household.annualBudget != null ? moneyCompact(household.annualBudget) : "Set a budget"}
          </div>
        </div>
      </div>

      <div className="fin-cost-picture">
        <div className="fin-cost-bar" role="img" aria-label="Cost breakdown">
          {parts.map((part) => {
            if (part.value == null || part.value <= 0) return null;
            const width = Math.max(2, (part.value / maxBar) * 100);
            return (
              <span
                key={part.key}
                className={`fin-cost-seg fin-cost-${part.cls}`}
                style={{ width: `${width}%` }}
                title={`${part.label}: ${moneyCompact(part.value)}`}
              />
            );
          })}
          {household.annualBudget != null ? (
            <span
              className="fin-budget-mark"
              style={{ left: `${Math.min(100, (household.annualBudget / maxBar) * 100)}%` }}
            >
              <span className="fin-budget-cap">Budget {moneyCompact(household.annualBudget)}</span>
            </span>
          ) : null}
          {entry.netPriceEstimate != null ? (
            <span
              className="fin-estimate-mark"
              style={{ left: `${Math.min(100, (entry.netPriceEstimate / maxBar) * 100)}%` }}
            />
          ) : null}
        </div>
        {typicalMerit != null && finance.totalCost != null ? (
          <div
            className="fin-merit-band"
            style={{
              left: `${Math.max(0, ((finance.totalCost - typicalMerit) / maxBar) * 100)}%`,
              width: `${Math.min(100, (typicalMerit / maxBar) * 100)}%`,
            }}
          >
            typical merit −{moneyCompact(typicalMerit)}
          </div>
        ) : null}
        <div className="fin-cost-legend">
          {parts.map((part) => (
            <span key={part.key} className={`fin-leg fin-leg-${part.cls}`}>
              {part.label} {part.value != null ? moneyCompact(part.value) : "—"}
            </span>
          ))}
        </div>
      </div>

      {groups.length ? (
        <div className="fin-aid-profile">
          <div className="fin-aid-groups" style={{ gridTemplateColumns: groups.map((g) => `${g.items.length}fr`).join(" ") }}>
            {groups.map((group) => (
              <div key={group.kind} className={`fin-aid-group kind-${group.kind}`}>
                <div className="mono label">{group.label}</div>
                <div className="fin-aid-tiles">
                  {group.items.map((item) => (
                    <div key={item.name} className={`fin-aid-tile kind-${group.kind}`}>
                      <div className="fin-aid-tile-name">{item.name}</div>
                      <div className="fin-aid-tile-amt mono">{item.amount}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="fin-aid-policy mono">
            {meetsFullNeedBadge(finance) ? "Meets full need" : "Need met: not stated"}
            {" · "}
            {finance.needBlindUS === true
              ? "Need-blind"
              : finance.needBlindUS === false
                ? "Need-aware"
                : "Need-blind: not stated"}
            {" · "}
            {finance.cssProfileRequired ? "CSS Profile" : "No CSS Profile"}
            {isNjStateAidSchool(school.name) ? " · NJ state aid" : ""}
            {finance.priorityAidDeadline ? ` · Priority: ${finance.priorityAidDeadline}` : ""}
          </p>
        </div>
      ) : null}

      <div className="fin-aid-list" role="table" aria-label="Scholarships and programs">
        <div className="fin-aid-list-head" role="row">
          <span role="columnheader">How</span>
          <span role="columnheader">Scholarship or program</span>
          <span role="columnheader">Deadline</span>
          <span role="columnheader">Action</span>
        </div>
        {rows.length === 0 ? (
          <p className="section-sub">No named scholarships or need programs listed.</p>
        ) : (
          rows.map((row) => {
            const todoKey = `${school.id}::${row.id}`;
            const inTodo = Boolean(scholarshipTodoIds[todoKey]);
            return (
              <div
                key={row.id}
                className={`fin-aid-list-row${row.kind === "closed" ? " is-closed" : ""}`}
                role="row"
              >
                <span className={`fin-how kind-${row.kind}`} role="cell">
                  {row.kind === "apply"
                    ? "Apply separately"
                    : row.kind === "admit"
                      ? "With admission"
                      : row.kind === "need"
                        ? "Need-based"
                        : "Not for NJ"}
                </span>
                <span role="cell">
                  <strong>{row.name}</strong>
                  <span className="fin-aid-amt mono">{row.amount}</span>
                </span>
                <span
                  className={`mono${row.separateApplication ? " accent" : ""}`}
                  role="cell"
                >
                  {row.deadline}
                </span>
                <span role="cell">
                  {row.separateApplication ? (
                    <button
                      type="button"
                      className="ghost-btn"
                      disabled={inTodo}
                      onClick={() =>
                        onAddScholarshipTodo(todoKey, `${school.name}: ${row.name} application`)
                      }
                    >
                      {inTodo ? "In To-Do ✓" : "Add to To-Do"}
                    </button>
                  ) : row.sourceUrl ? (
                    <a className="text-link" href={row.sourceUrl} target="_blank" rel="noreferrer">
                      Source ↗
                    </a>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="fin-context">
        <div className="fin-context-col">
          <h4>Cost of living vs home</h4>
          <ColMarker index={finance.costOfLivingIndex} home={HOME_PRICE_INDEX} label="Prices" />
          <ColMarker index={finance.housingCostIndex} home={HOME_HOUSING_INDEX} label="Housing" />
          <p className="section-sub">
            Prices in {finance.costOfLivingArea} are {finance.costOfLivingIndex} and housing{" "}
            {finance.housingCostIndex} (U.S. average 100; home area {HOME_PRICE_INDEX} and{" "}
            {HOME_HOUSING_INDEX}).
          </p>
        </div>
        <div className="fin-context-col">
          <h4>Your numbers</h4>
          <label className="stack-field">
            <span className="label">Net price estimate</span>
            <input
              className="field mono"
              inputMode="numeric"
              value={estimateDraft}
              placeholder="From NPC"
              onChange={(e) => setEstimateDraft(e.target.value)}
              onBlur={() => patchEntry({ netPriceEstimate: parseMoneyInput(estimateDraft) })}
            />
          </label>
          <label className="stack-field">
            <span className="label">Date run</span>
            <input
              className="field mono"
              type="date"
              value={dateDraft}
              onChange={(e) => setDateDraft(e.target.value)}
              onBlur={() => patchEntry({ netPriceDate: dateDraft || null })}
            />
          </label>
          <label className="stack-field">
            <span className="label">Merit award offered</span>
            <input
              className="field mono"
              inputMode="numeric"
              value={meritDraft}
              placeholder="When offered"
              onChange={(e) => setMeritDraft(e.target.value)}
              onBlur={() => patchEntry({ meritAwardOffered: parseMoneyInput(meritDraft) })}
            />
          </label>
          {finance.netPriceCalculatorUrl ? (
            <a
              className="primary-btn fin-npc-btn"
              href={finance.netPriceCalculatorUrl}
              target="_blank"
              rel="noreferrer"
            >
              Run Net Price Calculator ↗
            </a>
          ) : null}
          <p className="section-sub">
            Only the result is saved. Income, assets and tax details stay in the school&apos;s
            calculator.
          </p>
        </div>
      </div>

      <footer className="fin-school-foot">
        <p className="section-sub">{finance.notes}</p>
        {finance.costSourceUrl ? (
          <a className="text-link" href={finance.costSourceUrl} target="_blank" rel="noreferrer">
            Cost source ↗
          </a>
        ) : null}
      </footer>
    </section>
  );
}