"use client";

import { useMemo, useState } from "react";
import { FamilyFinancesModal } from "@/components/FamilyFinancesModal";
import {
  cssNoteForProfile,
  formatEnteredDate,
  formatRangeK,
  incomeBandToScoirKey,
} from "@/lib/familyFinances";
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
import { withNpcOverride } from "@/lib/link-overrides";

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

const POLICY_EXPLAIN: Record<string, Record<string, string>> = {
  "Meets full need": {
    Yes: "Aid covers the whole gap between the cost and what the FAFSA or CSS Profile says the family can pay.",
    No: "Aid can fall short of demonstrated need. The family covers the gap or borrows.",
    "in-state only": "Full need is met for residents only. Out-of-state students can be left with a gap.",
    _: "The school does not say whether it covers full need. Plan for a possible gap.",
  },
  "Need-blind": {
    Yes: "Ability to pay is not considered when the school decides on admission.",
    No: "Financial need can factor into the admission decision.",
    _: "The school does not say whether ability to pay affects admission.",
  },
  "CSS Profile": {
    Required:
      "A second aid form from the College Board, filed alongside the FAFSA. The school uses it to award its own grants. It charges a fee per school, with waivers for lower-income families.",
    "Not required": "The FAFSA alone is enough to be considered for aid.",
    _: "The school does not say whether it needs the CSS Profile.",
  },
  "NJ state aid": {
    Yes: "New Jersey grants such as the Tuition Aid Grant can be used here.",
    No: "New Jersey grants such as the Tuition Aid Grant only apply at New Jersey colleges.",
  },
  "Tuition rate for Kyle": {
    "In-state": "As a New Jersey resident, Kyle pays the resident rate.",
    "Out-of-state":
      'A public school outside New Jersey. Kyle pays the non-resident rate for all four years. Switching to in-state after enrolling is usually denied for students whose parents support them; see "Changing To In-State Tuition After Enrolling" on the Finances tab.',
    "Same for all students": "Private schools charge everyone the same tuition, wherever they live.",
    _: "The school's residency rules for Kyle are not on file yet.",
  },
};

function policyExplanation(label: string, value: string): string {
  const map = POLICY_EXPLAIN[label];
  if (!map) return "";
  return map[value] ?? map._ ?? "";
}

function formatEstimateDate(iso: string | null | undefined): string {
  if (!iso) return "Date not set";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function yn(v: boolean | null | undefined): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "Not stated";
}

function netBandsHiddenForOos(note: string | null | undefined): boolean {
  if (!note) return false;
  return /in-state students only|out-of-state/i.test(note);
}

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
  const finance = withNpcOverride(financeRecordForSchoolName(school.name), school.id);
  const scoir = scoirRecordForSchool(school);
  const entry = schoolFinanceEntry(household, school.id);
  const rows = useMemo(() => (finance ? aidRows(finance) : []), [finance]);
  const short = shortSchoolName(school.name);
  const profile = household.familyProfile;
  const familyEst = profile?.schools[school.id] ?? null;
  const resolvedIncomeBand =
    incomeBand ?? (profile ? incomeBandToScoirKey(profile.incomeBand) : null);
  const [familyModalOpen, setFamilyModalOpen] = useState(false);

  const modalSchools = useMemo(
    () =>
      listSchools
        .filter((s) => !s.archived)
        .map((s) => ({
          id: s.id,
          name: s.name,
          finance: financeRecordForSchoolName(s.name),
        })),
    [listSchools],
  );

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
    () =>
      parsePriorityAidDeadlines(
        finance?.priorityAidDeadline ?? null,
        new Date(),
        finance?.cssProfileRequired ?? null,
      ),
    [finance?.priorityAidDeadline, finance?.cssProfileRequired],
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
            incomeBand={resolvedIncomeBand}
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
        <FamilyFinancesModal
          open={familyModalOpen}
          onClose={() => setFamilyModalOpen(false)}
          schools={modalSchools}
          onSave={(next) => {
            onHouseholdChange({ ...household, familyProfile: next });
            setFamilyModalOpen(false);
          }}
        />
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
    {
      label: "Tuition rate for Kyle",
      value:
        school.kyleResidency === "In-state"
          ? "In-state"
          : school.kyleResidency === "Out-of-state"
            ? "Out-of-state"
            : school.kyleResidency === "Not applicable"
              ? "Same for all students"
              : "Not stated",
    },
  ].map((fact) => ({
    ...fact,
    explanation: policyExplanation(fact.label, fact.value),
    muted: /not stated/i.test(fact.value),
  }));

  return (
    <section className="school-modal-section fin-school">
      <header className="fin-school-head">
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
          <span className="fin-section-kicker mono">{costBar.coverTitle}</span>
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
          {costBar.incompleteNote ? (
            <p className="fin-cost-gap">{costBar.incompleteNote}</p>
          ) : null}
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

      <FamilyEstimateBlock
        profile={profile}
        estimate={familyEst}
        finance={finance}
        schoolName={school.name}
        annualBudget={household.annualBudget}
        onOpenModal={() => setFamilyModalOpen(true)}
      />

      <NetPriceSection
        scoir={scoir}
        short={short}
        totalCost={finance.totalCost}
        estimate={entry.netPriceEstimate}
        estimateDate={entry.netPriceDate}
        estimateDraft={estimateDraft}
        dateDraft={dateDraft}
        estimateOpen={estimateOpen}
        incomeBand={resolvedIncomeBand}
        npcUrl={finance.netPriceCalculatorUrl}
        onEstimateDraft={setEstimateDraft}
        onDateDraft={setDateDraft}
        onEstimateOpen={setEstimateOpen}
        onSaveEstimate={patchEntry}
      />

      {scoir ? <AidAndDebtSection scoir={scoir} totalCost={finance.totalCost} /> : null}

      <section className="fin-policies" aria-label="Aid policies">
        <span className="fin-section-kicker mono">Aid policies</span>
        <div className="fin-policies-list">
          {policyFacts.map((fact) => (
            <div key={fact.label} className="fin-policy-row">
              <span className="fin-policy-label">{fact.label}</span>
              <span className={`fin-policy-value${fact.muted ? " is-muted" : ""}`}>
                {fact.value}
              </span>
              <span className="fin-policy-explain">{fact.explanation}</span>
            </div>
          ))}
        </div>
      </section>

      {(deadlines.items.length > 0 || deadlines.note) && (
        <section className="fin-deadlines" aria-label="Priority aid deadlines">
          <div className="fin-deadlines-head">
            <span className="fin-section-kicker mono">Priority aid deadlines</span>
            <p className="fin-deadlines-lede">
              Aid forms filed by the priority date get first claim on the school&apos;s grant money.
              Filing later can mean a smaller package, even if Kyle is admitted. The date that
              applies depends on the round he applies in.
            </p>
          </div>
          {deadlines.items.length > 0 ? (
            <div className="fin-deadlines-list">
              {deadlines.items.map((item) => (
                <div
                  key={`${item.round}-${item.isoDate ?? item.monthDay}`}
                  className={`fin-deadline-row${item.accentSoon ? " is-soon" : ""}`}
                >
                  <div className="fin-deadline-when">
                    <span className="fin-deadline-md">{item.monthDay}</span>
                    <span className="fin-deadline-year mono">{item.year}</span>
                  </div>
                  <div className="fin-deadline-mid">
                    <div className="fin-deadline-who-row">
                      <b className="fin-deadline-who">{item.who}</b>
                      {item.round ? (
                        <span className="fin-deadline-round mono">{item.round}</span>
                      ) : null}
                    </div>
                    <span className="fin-deadline-what">{item.submitLine}</span>
                    {item.note ? (
                      <span className="fin-deadline-note">{item.note}</span>
                    ) : null}
                  </div>
                  <span className="fin-deadline-rel">
                    {item.daysUntil != null
                      ? `In ${item.daysUntil} day${item.daysUntil === 1 ? "" : "s"}`
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          ) : deadlines.note ? (
            <p className="fin-deadline-note">{deadlines.note}</p>
          ) : null}
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

      <FamilyFinancesModal
        open={familyModalOpen}
        onClose={() => setFamilyModalOpen(false)}
        schools={modalSchools}
        onSave={(next) => {
          onHouseholdChange({ ...household, familyProfile: next });
          setFamilyModalOpen(false);
        }}
      />
    </section>
  );
}

function FamilyEstimateBlock({
  profile,
  estimate,
  finance,
  schoolName,
  annualBudget,
  onOpenModal,
}: {
  profile: NonNullable<HouseholdFinances["familyProfile"]> | null;
  estimate: NonNullable<NonNullable<HouseholdFinances["familyProfile"]>["schools"][string]> | null;
  finance: NonNullable<ReturnType<typeof financeRecordForSchoolName>>;
  schoolName: string;
  annualBudget: number | null;
  onOpenModal: () => void;
}) {
  const within =
    estimate != null && annualBudget != null && estimate.high <= annualBudget;

  const applyingPrograms: string[] = [];
  if (profile) {
    if (profile.pell > 0) applyingPrograms.push(`Pell up to ${money(profile.pell)}`);
    for (const p of profile.programs) {
      if (p.key === "pell") continue;
      if (p.status === "not-eligible" || p.status === "unlikely") continue;
      if (p.key.startsWith("school:")) {
        if (!estimate?.programTag || p.label !== estimate.programTag) continue;
      }
      if ((p.key === "tag" || p.key === "gsg" || p.key === "eof") && !isNjStateAidSchool(schoolName)) {
        continue;
      }
      applyingPrograms.push(p.label);
    }
    if (estimate?.programTag && !applyingPrograms.includes(estimate.programTag)) {
      applyingPrograms.push(estimate.programTag);
    }
  }

  const cssLine = finance.cssProfileRequired
    ? `Required.${profile ? ` ${cssNoteForProfile(profile, 1).replace(/^At the 1 CSS Profile schools, the estimate also counts /, " It counts ")}` : ""}`
    : "Not required. The estimate uses your Student Aid Index.";

  return (
    <section className="fin-family-est" aria-label="Your family's estimate">
      <span className="fin-section-kicker mono">Your family&apos;s estimate</span>
      {!profile ? (
        <div className="fin-family-est-empty">
          <p>Enter your family&apos;s finances once to see an estimate for every school.</p>
          <button type="button" className="fin-family-enter" onClick={onOpenModal}>
            Enter family finances
          </button>
        </div>
      ) : (
        <>
          <p className="fin-family-est-meta">
            From family finances · entered {formatEnteredDate(profile.enteredAt)} ·{" "}
            <button type="button" className="text-link" onClick={onOpenModal}>
              Update
            </button>
          </p>
          <div className="fin-family-est-grid">
            <div className="fin-family-est-figure">
              <div className={`fin-family-est-amount${within ? " is-within" : ""}`}>
                {estimate
                  ? estimate.low === estimate.high
                    ? money(estimate.low)
                    : formatRangeK(estimate.low, estimate.high)
                  : "Not published"}
              </div>
              <div className="fin-family-est-per">per year, after grants, before loans</div>
              <div className="fin-family-est-published mono">
                Published cost {money(finance.totalCost)}
              </div>
            </div>
            <p className="fin-family-est-basis">
              {estimate?.basis ?? "No published cost for this school."}
            </p>
          </div>
          <div className="fin-family-est-rows">
            <div className="fin-family-est-row">
              <span className="fin-family-est-label">Programs that apply</span>
              <span className="fin-family-est-value">
                {applyingPrograms.length ? applyingPrograms.join(" · ") : "None found for your figures"}
              </span>
            </div>
            <div className="fin-family-est-row">
              <span className="fin-family-est-label">CSS Profile</span>
              <span className="fin-family-est-value">{cssLine}</span>
            </div>
            <div className="fin-family-est-row">
              <span className="fin-family-est-label">Income band</span>
              <span className="fin-family-est-value">
                {profile.incomeBand}. This band is highlighted in Net price by family income below.
              </span>
            </div>
          </div>
          <div className="fin-family-est-npc">
            <p>
              For a firmer number, run the school&apos;s own calculator and add the result below.
            </p>
            {finance.netPriceCalculatorUrl ? (
              <a
                className="fin-outline-btn"
                href={finance.netPriceCalculatorUrl}
                target="_blank"
                rel="noreferrer"
              >
                Net Price Calculator ↗
              </a>
            ) : null}
          </div>
        </>
      )}
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
  const scale = Math.max(published, 1);
  const hasBands = Boolean(table && NET_BANDS.some((b) => table[b.key] != null));
  const hiddenOos = !hasBands && netBandsHiddenForOos(scoir?.netPriceByIncomeNote);
  const noNetText = hiddenOos
    ? `Federal figures for ${short} cover in-state students only. Kyle would pay the out-of-state rate, so they would understate his cost.`
    : `No income-band figures are on file for ${short}.`;
  const aidedLeft =
    table?.average != null
      ? `${Math.min(100, (table.average / scale) * 100)}%`
      : null;
  const highlight = incomeBand != null && hasBands;
  const hasEstimate = estimate != null && !estimateOpen;
  const showPrompt = estimate == null && !estimateOpen;
  const estPct =
    estimate != null && published > 0
      ? `${Math.round((estimate / published) * 100)}% of cost`
      : "";

  return (
    <section className="fin-net" aria-label="Net price by family income">
      <div className="fin-net-head">
        <span className="fin-section-kicker mono">Net price by family income</span>
        <p className="fin-net-lede">
          Net price is the published cost minus grants and scholarships: what a family pays
          before loans. Each bar is the average for {short} first-years who got grant aid, by
          family income, from federal data.
        </p>
      </div>

      <div className="fin-net-chart">
        <div className="fin-net-cols-head mono" aria-hidden="true">
          <span>Family income</span>
          <span className="fin-net-cols-mid">
            <span>Net price</span>
            <span>
              Published cost {totalCost != null ? moneyCompact(totalCost) : "—"}
            </span>
          </span>
          <span className="fin-net-cols-per">Per year</span>
        </div>

        {hasBands
          ? NET_BANDS.map((band) => {
              const value = table![band.key];
              if (value == null) return null;
              const isYours = highlight && incomeBand === band.key;
              const widthPct = Math.min(100, (value / scale) * 100);
              const pctOfCost =
                published > 0 ? `${Math.round((value / published) * 100)}% of cost` : "";
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
                    <span
                      className="fin-net-bar"
                      style={{ width: `${widthPct}%` }}
                    />
                    {aidedLeft ? (
                      <span className="fin-net-aided-line" style={{ left: aidedLeft }} />
                    ) : null}
                  </div>
                  <div className="fin-net-amt-col">
                    <span className="fin-net-amt mono">{formatScoirMoney(value)}</span>
                    {pctOfCost ? (
                      <span className="fin-net-pct">{pctOfCost}</span>
                    ) : null}
                  </div>
                </div>
              );
            })
          : (
            <div className="fin-net-row fin-net-hidden">
              <span className="fin-net-hidden-label">Not shown</span>
              <span className="fin-net-hidden-text">{noNetText}</span>
              <span />
            </div>
          )}

        {hasBands && aidedLeft && table?.average != null ? (
          <div className="fin-net-avg" aria-hidden="true">
            <span />
            <div className="fin-net-avg-track">
              <span className="fin-net-avg-label mono" style={{ left: aidedLeft }}>
                Average, all aided · {formatScoirMoney(table.average)}
              </span>
            </div>
            <span />
          </div>
        ) : null}

        <div className="fin-net-row fin-net-estimate">
          <div className="fin-net-band">
            <span className="fin-net-band-label is-estimate-title">Your estimate</span>
            <div className="fin-net-est-sub">
              <span className="fin-net-band-hint">
                {hasEstimate
                  ? estimateDate
                    ? `Run ${formatEstimateDate(estimateDate)}`
                    : "Date not set"
                  : "Not run yet"}
              </span>
              {hasEstimate ? (
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
              ) : null}
            </div>
          </div>

          {hasEstimate ? (
            <div className="fin-net-track">
              <span
                className="fin-net-bar is-you"
                style={{ width: `${Math.min(100, (estimate! / scale) * 100)}%` }}
              />
            </div>
          ) : showPrompt ? (
            <div className="fin-estimate-prompt-inline">
              <span className="fin-estimate-line">
                Enter your family&apos;s income and assets in {short}&apos;s calculator for a
                personal figure, then add the result here.
              </span>
              <div className="fin-estimate-actions">
                {npcUrl ? (
                  <a
                    className="fin-npc-outline"
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
          ) : (
            <span className="fin-estimate-entering">Entering result below</span>
          )}

          <div className="fin-net-amt-col">
            <span className={`fin-net-amt mono${hasEstimate ? "" : " is-empty"}`}>
              {hasEstimate ? moneyCompact(estimate!) : "—"}
            </span>
            {hasEstimate && estPct ? (
              <span className="fin-net-pct">{estPct}</span>
            ) : null}
          </div>
        </div>
      </div>

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
