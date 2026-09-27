"use client";

import { useMemo, useState } from "react";
import {
  buildCostBar,
  buildFinanceCompareRows,
  financeRecordForSchoolName,
  isNjStateAidSchool,
  listFinanceRecords,
  money,
  moneyCompact,
  needProgramOpenToNj,
  residencyLabel,
  schoolFinanceEntry,
  shortSchoolName,
  type HouseholdFinances,
  type HouseholdSchoolFinance,
} from "@/lib/finances";
import {
  formatScoirMoney,
  formatScoirPct,
  scoirRecordForSchool,
  type ScoirRecord,
} from "@/lib/scoir";
import type { School } from "@/lib/types";
import { SchoolMark } from "./SchoolMark";

const NET_PRICE_ROWS: { key: keyof NonNullable<ScoirRecord["netPriceByIncome"]>; label: string }[] =
  [
    { key: "under30k", label: "Under $30,000" },
    { key: "30to48k", label: "$30,000-$48,000" },
    { key: "48to75k", label: "$48,000-$75,000" },
    { key: "75to110k", label: "$75,000-$110,000" },
    { key: "over110k", label: "Over $110,000" },
    { key: "average", label: "All aided students" },
  ];

type AidKind = "apply" | "admit" | "need" | "closed";

type AidRow = {
  id: string;
  kind: AidKind;
  name: string;
  amount: string;
  detail: string;
  how: string;
  deadline: string;
  separateApplication: boolean;
  closed: boolean;
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
      detail: item.eligibility,
      how: item.separateApplication ? "Merit · apply separately" : "Merit · with admission",
      deadline: item.deadline,
      separateApplication: item.separateApplication,
      closed: false,
    });
  }
  for (const [index, item] of finance.needPrograms.entries()) {
    const open = needProgramOpenToNj(item);
    rows.push({
      id: `need-${index}`,
      kind: open ? "need" : "closed",
      name: item.name,
      amount: item.covers,
      detail: `${item.incomeRange} · ${item.residency}`,
      how: open ? "Need-based" : "Not for NJ residents",
      deadline: "",
      separateApplication: false,
      closed: !open,
    });
  }
  return rows;
}

function yn(v: boolean | null): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "Not stated";
}

export function SchoolFinancials({
  school,
  listSchools,
  household,
  onHouseholdChange,
  scholarshipTodoIds,
  onAddScholarshipTodo,
}: {
  school: School;
  listSchools: School[];
  household: HouseholdFinances;
  onHouseholdChange: (next: HouseholdFinances) => void;
  scholarshipTodoIds: Record<string, string>;
  onAddScholarshipTodo: (scholarshipKey: string, title: string) => void;
}) {
  const finance = financeRecordForSchoolName(school.name);
  const scoir = scoirRecordForSchool(school);
  const entry = schoolFinanceEntry(household, school.id);
  const rows = useMemo(() => (finance ? aidRows(finance) : []), [finance]);

  const [estimateDraft, setEstimateDraft] = useState(
    entry.netPriceEstimate != null ? String(entry.netPriceEstimate) : "",
  );
  const [dateDraft, setDateDraft] = useState(entry.netPriceDate ?? "");
  const [meritDraft, setMeritDraft] = useState(
    entry.meritAwardOffered != null ? String(entry.meritAwardOffered) : "",
  );

  const peerRecords = useMemo(() => {
    const fromList = listSchools
      .filter((s) => !s.archived)
      .map((s) => financeRecordForSchoolName(s.name))
      .filter((r): r is NonNullable<typeof r> => r != null);
    return fromList.length ? fromList : listFinanceRecords();
  }, [listSchools]);

  const compareRows = useMemo(
    () => (finance ? buildFinanceCompareRows(finance, peerRecords, household.annualBudget) : []),
    [finance, peerRecords, household.annualBudget],
  );

  const costBar = useMemo(() => (finance ? buildCostBar(finance) : null), [finance]);

  if (!finance) {
    return (
      <section className="school-modal-section fin-school">
        <div className="school-overview-head">
          <h3>Financials</h3>
          <p className="section-sub">No published finance record for this school yet.</p>
        </div>
        {scoir ? <ScoirNetPriceBlock scoir={scoir} /> : null}
      </section>
    );
  }

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

  const listCount = peerRecords.length;
  const totalLabel = money(finance.totalCost);

  const facts: { label: string; value: string; accent?: boolean }[] = [
    {
      label: "Meets full need",
      value:
        finance.meetsFullNeed === "all students"
          ? "Yes"
          : finance.meetsFullNeed === "no"
            ? "No"
            : finance.meetsFullNeed || "Not stated",
    },
    { label: "Need-blind", value: yn(finance.needBlindUS) },
    {
      label: "CSS Profile",
      value:
        finance.cssProfileRequired === true
          ? "Required"
          : finance.cssProfileRequired === false
            ? "Not required"
            : "Not stated",
    },
    {
      label: "NJ state aid",
      value: isNjStateAidSchool(school.name) ? "Eligible schools" : "No",
    },
    {
      label: "Priority aid deadline",
      value: finance.priorityAidDeadline || "Not stated",
      accent: Boolean(finance.priorityAidDeadline),
    },
  ];

  return (
    <section className="school-modal-section fin-school">
      <header className="fin-school-head">
        <div className="fin-school-title-row">
          <span className="fin-school-mark" title={school.name}>
            <SchoolMark name={school.name} website={school.website} />
          </span>
          <h1 className="fin-detail-name">{school.name}</h1>
        </div>
        <span className="fin-school-meta mono">
          {finance.costYear} · {residencyLabel(finance.residencyRate)} · per year
        </span>
      </header>

      <section className="fin-lands" aria-label="Where it lands on your list">
        <span className="fin-section-kicker mono">
          Where it lands among the {listCount} schools on your list
        </span>
        {compareRows.map((row) => (
          <div key={row.id} className="fin-lands-row">
            <div className="fin-lands-label">
              <span className="fin-lands-caption">{row.label}</span>
              <span className="fin-lands-value">{row.valueText}</span>
            </div>
            {row.kind === "none" ? (
              <span className="fin-lands-none">{row.noneText}</span>
            ) : (
              <div className="fin-lands-strip" aria-hidden="true">
                <div className="fin-lands-track" />
                {row.budgetLeftPct != null ? (
                  <>
                    <div
                      className="fin-lands-budget"
                      style={{ left: `${row.budgetLeftPct}%` }}
                    />
                    <div
                      className="fin-lands-budget-label mono"
                      style={{ left: `${row.budgetLeftPct}%` }}
                    >
                      {row.budgetLabel}
                    </div>
                  </>
                ) : null}
                {row.ticks?.map((tick) => (
                  <span
                    key={`${row.id}-${tick.label}`}
                    className="fin-lands-tick"
                    style={{ left: `${tick.leftPct}%` }}
                    title={tick.label}
                  />
                ))}
                <span
                  className="fin-lands-dot"
                  style={{ left: `${row.posPct}%` }}
                  title={`${shortSchoolName(school.name)} ${row.valueText}`}
                />
                <div className="fin-lands-end fin-lands-end-min mono">{row.minLabel}</div>
                <div className="fin-lands-end fin-lands-end-max mono">{row.maxLabel}</div>
              </div>
            )}
            <span className="fin-lands-rank">{row.kind === "strip" ? row.rankText : ""}</span>
          </div>
        ))}
      </section>

      {costBar && costBar.partsSum > 0 ? (
        <section className="fin-cost-cover" aria-label="Cost breakdown">
          <span className="fin-section-kicker mono">What {totalLabel} covers</span>
          <div
            className="fin-cost-bar-wrap"
            style={{ height: 56 + costBar.barExtraPx }}
          >
            {costBar.segments.map((seg) => (
              <div
                key={seg.key}
                className="fin-cost-seg"
                title={`${seg.label} ${moneyCompact(seg.value)}`}
                style={{
                  left: `${seg.leftPct}%`,
                  width: `${seg.widthPct}%`,
                  background: seg.bg,
                  color: seg.fg,
                }}
              >
                {seg.inside ? (
                  <div className="fin-cost-seg-inner">
                    <span className="fin-cost-seg-label">{seg.label}</span>
                    <span className="fin-cost-seg-val mono">{moneyCompact(seg.value)}</span>
                  </div>
                ) : null}
              </div>
            ))}
            {costBar.callouts.map((c) => (
              <div key={c.key}>
                <div
                  className="fin-cost-leader"
                  style={{ left: `${c.xPct}%`, height: c.leaderPx }}
                />
                <div
                  className="fin-cost-callout"
                  style={{
                    top: c.topPx,
                    left: `${c.xPct}%`,
                    transform: c.shiftLeft ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
                  }}
                >
                  {c.label}{" "}
                  <span className="mono">{c.valueText}</span>
                </div>
              </div>
            ))}
          </div>
          {costBar.gapNote ? <p className="fin-cost-gap">{costBar.gapNote}</p> : null}
        </section>
      ) : null}

      <section className="fin-aid" aria-label="Scholarships and aid">
        <span className="fin-section-kicker mono">Scholarships and aid</span>
        {rows.length === 0 ? (
          <p className="section-sub">No named scholarships or need programs listed.</p>
        ) : (
          rows.map((row) => {
            const todoKey = `${school.id}::${row.id}`;
            const inTodo = Boolean(scholarshipTodoIds[todoKey]);
            return (
              <div
                key={row.id}
                className={`fin-aid-row${row.closed ? " is-closed" : ""}`}
              >
                <div className="fin-aid-main">
                  <b className="fin-aid-name">{row.name}</b>
                  <span className="fin-aid-amount">{row.amount}</span>
                  {row.detail ? <span className="fin-aid-detail">{row.detail}</span> : null}
                </div>
                <div className="fin-aid-how">
                  <span className={row.kind === "apply" ? "accent" : undefined}>{row.how}</span>
                  {row.deadline ? <span className="mono fin-aid-deadline">{row.deadline}</span> : null}
                </div>
                <div className="fin-aid-action">
                  {row.separateApplication ? (
                    <button
                      type="button"
                      className="fin-todo-btn"
                      disabled={inTodo}
                      onClick={() =>
                        onAddScholarshipTodo(todoKey, `${school.name}: ${row.name} application`)
                      }
                    >
                      {inTodo ? "In To-Do ✓" : "Add to To-Do"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
        <div className="fin-aid-facts">
          {facts.map((fact) => (
            <span key={fact.label} className="fin-aid-fact">
              <span className="mono fin-aid-fact-label">{fact.label}</span>
              <span className={fact.accent ? "accent" : undefined}>{fact.value}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="fin-yours" aria-label="Your numbers">
        <span className="fin-section-kicker mono">Your numbers</span>
        <div className="fin-yours-grid">
          <label className="fin-yours-field">
            <span>Net price estimate / yr</span>
            <input
              className="field mono"
              inputMode="numeric"
              placeholder="$0"
              value={estimateDraft}
              onChange={(e) => setEstimateDraft(e.target.value)}
              onBlur={() => patchEntry({ netPriceEstimate: parseMoneyInput(estimateDraft) })}
            />
          </label>
          <label className="fin-yours-field">
            <span>Date run</span>
            <input
              className="field mono"
              type="date"
              value={dateDraft}
              onChange={(e) => setDateDraft(e.target.value)}
              onBlur={() => patchEntry({ netPriceDate: dateDraft || null })}
            />
          </label>
          <label className="fin-yours-field">
            <span>Merit award offered / yr</span>
            <input
              className="field mono"
              inputMode="numeric"
              placeholder="$0"
              value={meritDraft}
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
              Net Price Calculator ↗
            </a>
          ) : (
            <span />
          )}
        </div>
        <p className="fin-privacy">
          Only the result is saved. Income, assets and tax details stay in the school&apos;s
          calculator.
        </p>
      </section>

      {scoir ? <ScoirNetPriceBlock scoir={scoir} /> : null}

      <footer className="fin-school-foot">
        <p className="fin-notes">{finance.notes}</p>
        {finance.costSourceUrl ? (
          <a className="text-link" href={finance.costSourceUrl} target="_blank" rel="noreferrer">
            Cost source ↗
          </a>
        ) : null}
      </footer>
    </section>
  );
}

function ScoirNetPriceBlock({ scoir }: { scoir: ScoirRecord }) {
  const table = scoir.netPriceByIncome;
  return (
    <section className="fin-scoir-net" aria-label="Net price by family income">
      <span className="fin-section-kicker mono">Net Price By Family Income</span>
      {table ? (
        <div className="scoir-net-price">
          <table>
            <thead>
              <tr>
                <th>Family income</th>
                <th>Net price</th>
              </tr>
            </thead>
            <tbody>
              {NET_PRICE_ROWS.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td className="mono">{formatScoirMoney(table[row.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {scoir.netPriceByIncomeNote ? (
        <p className="section-sub scoir-note">{scoir.netPriceByIncomeNote}</p>
      ) : null}
      <dl className="fin-scoir-aid-facts">
        <div>
          <dt>Students receiving aid</dt>
          <dd>{formatScoirPct(scoir.pctReceivingAid, 0)}</dd>
        </div>
        <div>
          <dt>Students with federal loans</dt>
          <dd>{formatScoirPct(scoir.pctFederalLoans, 0)}</dd>
        </div>
        <div>
          <dt>Median debt at graduation</dt>
          <dd>{formatScoirMoney(scoir.medianDebtAtGraduation)}</dd>
        </div>
      </dl>
    </section>
  );
}
