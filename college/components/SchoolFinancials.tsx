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
  parsePriorityAidDeadlines,
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

const NET_BANDS: {
  key: Exclude<keyof NonNullable<ScoirRecord["netPriceByIncome"]>, "average">;
  label: string;
}[] = [
  { key: "under30k", label: "Under $30,000" },
  { key: "30to48k", label: "$30,000–$48,000" },
  { key: "48to75k", label: "$48,000–$75,000" },
  { key: "75to110k", label: "$75,000–$110,000" },
  { key: "over110k", label: "Over $110,000" },
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

const AID_KIND_ORDER: Record<AidKind, number> = {
  apply: 0,
  admit: 1,
  need: 2,
  closed: 3,
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
  return rows.sort((a, b) => AID_KIND_ORDER[a.kind] - AID_KIND_ORDER[b.kind]);
}

function yn(v: boolean | null): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "Not stated";
}

function formatEstimateDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function SchoolFinancials({
  school,
  listSchools,
  household,
  onHouseholdChange,
  scholarshipTodoIds,
  onAddScholarshipTodo,
  incomeBand = null,
}: {
  school: School;
  listSchools: School[];
  household: HouseholdFinances;
  onHouseholdChange: (next: HouseholdFinances) => void;
  scholarshipTodoIds: Record<string, string>;
  onAddScholarshipTodo: (scholarshipKey: string, title: string) => void;
  /** Optional profile income band for net-price highlight. */
  incomeBand?: (typeof NET_BANDS)[number]["key"] | null;
}) {
  const finance = financeRecordForSchoolName(school.name);
  const scoir = scoirRecordForSchool(school);
  const entry = schoolFinanceEntry(household, school.id);
  const rows = useMemo(() => (finance ? aidRows(finance) : []), [finance]);
  const short = shortSchoolName(school.name);

  const [estimateDraft, setEstimateDraft] = useState(
    entry.netPriceEstimate != null ? String(entry.netPriceEstimate) : "",
  );
  const [dateDraft, setDateDraft] = useState(entry.netPriceDate ?? "");
  const [estimateOpen, setEstimateOpen] = useState(false);

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

  const deadlines = useMemo(
    () => parsePriorityAidDeadlines(finance?.priorityAidDeadline ?? null),
    [finance?.priorityAidDeadline],
  );

  if (!finance) {
    return (
      <section className="school-modal-section fin-school">
        <div className="school-overview-head">
          <h3>Financials</h3>
          <p className="section-sub">No published finance record for this school yet.</p>
        </div>
        {scoir ? (
          <NetPriceSection
            scoir={scoir}
            short={short}
            totalCost={null}
            estimate={entry.netPriceEstimate}
            estimateDate={entry.netPriceDate}
            estimateDraft={estimateDraft}
            dateDraft={dateDraft}
            estimateOpen={estimateOpen}
            incomeBand={incomeBand}
            npcUrl={null}
            onEstimateDraft={setEstimateDraft}
            onDateDraft={setDateDraft}
            onEstimateOpen={setEstimateOpen}
            onSaveEstimate={(patch) => {
              const current = schoolFinanceEntry(household, school.id);
              onHouseholdChange({
                ...household,
                schools: {
                  ...household.schools,
                  [school.id]: { ...current, ...patch },
                },
              });
            }}
          />
        ) : null}
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

  const policyFacts = [
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
      value: isNjStateAidSchool(school.name) ? "Yes" : "No",
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
              {row.subLines?.map((line) => (
                <span key={line} className="fin-lands-sub">
                  {line}
                </span>
              ))}
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
                  title={`${short} ${row.valueText}`}
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
      </section>

      <NetPriceSection
        scoir={scoir}
        short={short}
        totalCost={finance.totalCost}
        estimate={entry.netPriceEstimate}
        estimateDate={entry.netPriceDate}
        estimateDraft={estimateDraft}
        dateDraft={dateDraft}
        estimateOpen={estimateOpen}
        incomeBand={incomeBand}
        npcUrl={finance.netPriceCalculatorUrl}
        onEstimateDraft={setEstimateDraft}
        onDateDraft={setDateDraft}
        onEstimateOpen={setEstimateOpen}
        onSaveEstimate={patchEntry}
      />

      {scoir ? <AidAndDebtSection scoir={scoir} totalCost={finance.totalCost} /> : null}

      <section className="fin-policies" aria-label="Aid policies">
        <span className="fin-section-kicker mono">Aid policies</span>
        <div className="fin-policies-grid">
          {policyFacts.map((fact) => (
            <div key={fact.label} className="fin-policy">
              <span className="fin-policy-label">{fact.label}</span>
              <span className="fin-policy-value">{fact.value}</span>
            </div>
          ))}
        </div>
      </section>

      {(deadlines.items.length > 0 || deadlines.note) && (
        <section className="fin-deadlines" aria-label="Priority aid deadlines">
          <span className="fin-section-kicker mono">Priority aid deadlines</span>
          {deadlines.items.length > 0 ? (
            <div className="fin-deadlines-row">
              {deadlines.items.map((item) => (
                <div key={`${item.round}-${item.dateLabel}`} className="fin-deadline">
                  <span className="fin-deadline-round mono">{item.round}</span>
                  <span
                    className={`fin-deadline-date${item.accentSoon ? " is-soon" : ""}`}
                  >
                    {item.dateLabel}
                  </span>
                  {item.accentSoon && item.daysUntil != null ? (
                    <span className="fin-deadline-soon">
                      In {item.daysUntil} day{item.daysUntil === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {deadlines.note ? <p className="fin-deadline-note">{deadlines.note}</p> : null}
        </section>
      )}

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

function NetPriceSection({
  scoir,
  short,
  totalCost,
  estimate,
  estimateDate,
  estimateDraft,
  dateDraft,
  estimateOpen,
  incomeBand,
  npcUrl,
  onEstimateDraft,
  onDateDraft,
  onEstimateOpen,
  onSaveEstimate,
}: {
  scoir: ScoirRecord | null;
  short: string;
  totalCost: number | null;
  estimate: number | null;
  estimateDate: string | null;
  estimateDraft: string;
  dateDraft: string;
  estimateOpen: boolean;
  incomeBand: (typeof NET_BANDS)[number]["key"] | null;
  npcUrl: string | null;
  onEstimateDraft: (v: string) => void;
  onDateDraft: (v: string) => void;
  onEstimateOpen: (v: boolean) => void;
  onSaveEstimate: (patch: Partial<HouseholdSchoolFinance>) => void;
}) {
  const table = scoir?.netPriceByIncome ?? null;
  const published = totalCost ?? 0;
  const scale = Math.max(published, table?.average ?? 0, estimate ?? 0, 1);
  const hasBands = Boolean(table && NET_BANDS.some((b) => table[b.key] != null));
  const hasChart = hasBands || estimate != null;
  const aidedLeft =
    table?.average != null ? `${Math.min(100, (table.average / scale) * 100)}%` : null;
  const highlight = incomeBand != null && hasBands;

  return (
    <section className="fin-net" aria-label="Net price by family income">
      <div className="fin-net-head">
        <span className="fin-section-kicker mono">Net price by family income</span>
        <p className="fin-net-lede">
          What first-year students getting grant aid paid on average, from federal data.
        </p>
      </div>

      {hasChart ? (
        <div className="fin-net-chart">
          {hasBands && aidedLeft ? (
            <div className="fin-net-axis" aria-hidden="true">
              <span />
              <div className="fin-net-axis-track">
                <span className="fin-net-axis-aided mono" style={{ left: aidedLeft }}>
                  All aided students · {formatScoirMoney(table!.average)}
                </span>
                {totalCost != null ? (
                  <span className="fin-net-axis-pub mono">
                    Published cost {moneyCompact(totalCost)}
                  </span>
                ) : null}
              </div>
              <span />
            </div>
          ) : null}

          {hasBands
            ? NET_BANDS.map((band) => {
                const value = table![band.key];
                if (value == null) return null;
                const isYours = highlight && incomeBand === band.key;
                const widthPct = Math.min(100, (value / scale) * 100);
                return (
                  <div
                    key={band.key}
                    className={`fin-net-row${highlight && !isYours ? " is-faded" : ""}${isYours ? " is-yours" : ""}`}
                  >
                    <div className="fin-net-band">
                      <span className="fin-net-band-label">{band.label}</span>
                      {isYours ? (
                        <span className="fin-net-band-hint">Your income band</span>
                      ) : null}
                    </div>
                    <div className="fin-net-track">
                      {aidedLeft ? (
                        <span className="fin-net-aided-line" style={{ left: aidedLeft }} />
                      ) : null}
                      <span
                        className="fin-net-bar"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className="fin-net-amt mono">{formatScoirMoney(value)}</span>
                  </div>
                );
              })
            : null}

          {estimate != null ? (
            <div className="fin-net-row is-estimate">
              <div className="fin-net-band">
                <span className="fin-net-band-label">You</span>
                <span className="fin-net-band-hint">
                  Run {formatEstimateDate(estimateDate)}
                  {" · "}
                  <button
                    type="button"
                    className="fin-text-btn"
                    onClick={() => {
                      onEstimateDraft(String(estimate));
                      onDateDraft(estimateDate ?? "");
                      onEstimateOpen(true);
                    }}
                  >
                    Edit
                  </button>
                </span>
              </div>
              <div className="fin-net-track">
                {aidedLeft ? (
                  <span className="fin-net-aided-line" style={{ left: aidedLeft }} />
                ) : null}
                <span
                  className="fin-net-bar is-you"
                  style={{ width: `${Math.min(100, (estimate / scale) * 100)}%` }}
                />
              </div>
              <span className="fin-net-amt mono">{moneyCompact(estimate)}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="fin-net-empty">
          No income-band figures on file for {short}.
          {scoir?.netPriceByIncomeNote ? ` ${scoir.netPriceByIncomeNote}` : ""}
        </p>
      )}

      {estimate == null && !estimateOpen ? (
        <div className="fin-estimate-prompt">
          <p className="fin-estimate-line">
            Run {short}&apos;s calculator for your own number.
          </p>
          <div className="fin-estimate-actions">
            {npcUrl ? (
              <a
                className="fin-npc-secondary"
                href={npcUrl}
                target="_blank"
                rel="noreferrer"
              >
                Net Price Calculator ↗
              </a>
            ) : null}
            <button
              type="button"
              className="fin-text-btn"
              onClick={() => onEstimateOpen(true)}
            >
              Add my result
            </button>
          </div>
        </div>
      ) : null}

      {estimateOpen ? (
        <div className="fin-estimate-form">
          <div className="fin-estimate-fields">
            <label className="fin-yours-field">
              <span>Net price estimate / yr</span>
              <input
                className="field mono"
                inputMode="numeric"
                placeholder="$0"
                value={estimateDraft}
                onChange={(e) => onEstimateDraft(e.target.value)}
              />
            </label>
            <label className="fin-yours-field">
              <span>Date run</span>
              <input
                className="field mono"
                type="date"
                value={dateDraft}
                onChange={(e) => onDateDraft(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="primary-btn fin-estimate-done"
              onClick={() => {
                onSaveEstimate({
                  netPriceEstimate: parseMoneyInput(estimateDraft),
                  netPriceDate: dateDraft || null,
                });
                onEstimateOpen(false);
              }}
            >
              Done
            </button>
            {npcUrl ? (
              <a
                className="fin-npc-secondary"
                href={npcUrl}
                target="_blank"
                rel="noreferrer"
              >
                Net Price Calculator ↗
              </a>
            ) : null}
          </div>
          <p className="fin-privacy">
            Only the result is saved. Income, assets and tax details stay in the school&apos;s
            calculator.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function AidAndDebtSection({
  scoir,
  totalCost,
}: {
  scoir: ScoirRecord;
  totalCost: number | null;
}) {
  const items: {
    value: string;
    label: string;
    against: string;
    widthPct: number;
  }[] = [];

  if (scoir.pctReceivingAid != null) {
    items.push({
      value: formatScoirPct(scoir.pctReceivingAid, 0) ?? "—",
      label: "Share of students getting grant aid",
      against: "Against all students",
      widthPct: Math.min(100, scoir.pctReceivingAid),
    });
  }
  if (scoir.pctFederalLoans != null) {
    items.push({
      value: formatScoirPct(scoir.pctFederalLoans, 0) ?? "—",
      label: "Share borrowing federal loans",
      against: "Against all students",
      widthPct: Math.min(100, scoir.pctFederalLoans),
    });
  }
  if (scoir.medianDebtAtGraduation != null) {
    const againstCost = totalCost && totalCost > 0 ? totalCost : scoir.medianDebtAtGraduation;
    items.push({
      value: formatScoirMoney(scoir.medianDebtAtGraduation) ?? "—",
      label: "Median debt at graduation",
      against: "Against one year at the published cost",
      widthPct: Math.min(100, (scoir.medianDebtAtGraduation / againstCost) * 100),
    });
  }

  if (items.length === 0) return null;

  return (
    <section className="fin-aid-debt" aria-label="Aid and debt">
      <span className="fin-section-kicker mono">Aid and debt</span>
      <div className="fin-aid-debt-grid">
        {items.map((item) => (
          <div key={item.label} className="fin-aid-debt-col">
            <span className="fin-aid-debt-figure">{item.value}</span>
            <div className="fin-aid-debt-meter" aria-hidden="true">
              <span style={{ width: `${item.widthPct}%` }} />
            </div>
            <span className="fin-aid-debt-label">{item.label}</span>
            <span className="fin-aid-debt-against">{item.against}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
