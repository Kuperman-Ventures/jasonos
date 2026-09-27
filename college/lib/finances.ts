/**
 * College-list finances: published costs, merit, need programs, NJ state aid.
 * Source: data/finances.json (matched to schools by exact name).
 */

import financesFile from "@/data/finances.json";
import type { InterestLevel, School } from "@/lib/types";

export type MeritScholarship = {
  name: string;
  amount: string;
  years: string;
  automatic: boolean;
  separateApplication: boolean;
  deadline: string;
  eligibility: string;
  sourceUrl: string;
};

export type NeedProgram = {
  name: string;
  incomeRange: string;
  covers: string;
  residency: string;
  sourceUrl: string;
};

export type FinanceRecord = {
  school: string;
  costYear: string;
  residencyRate: "private" | "in-state" | "out-of-state" | string;
  tuitionFees: number | null;
  housingFood: number | null;
  booksSupplies: number | null;
  otherCosts: number | null;
  totalCost: number | null;
  costSourceUrl: string;
  cdsYear: string | null;
  cdsFirstYears: number | null;
  cdsNonNeedMeritRecipients: number | null;
  cdsAvgNonNeedMerit: number | null;
  cdsSourceUrl: string | null;
  awardsMerit: boolean;
  meritScholarships: MeritScholarship[];
  needPrograms: NeedProgram[];
  meetsFullNeed: string | null;
  needBlindUS: boolean | null;
  cssProfileRequired: boolean | null;
  priorityAidDeadline: string | null;
  netPriceCalculatorUrl: string | null;
  notes: string;
  meritSharePct: number | null;
  costOfLivingArea: string;
  costOfLivingIndex: number;
  housingCostIndex: number;
};

export type NjStateProgram = {
  name: string;
  eligibility: string;
  award: string;
  appliesTo: string[];
  application: string;
  deadline: string;
  sourceUrl: string;
};

export type FinancesFile = {
  newJerseyStatePrograms: NjStateProgram[];
  newJerseyGrantsPortable: string;
  schools: FinanceRecord[];
};

export type HouseholdSchoolFinance = {
  netPriceEstimate: number | null;
  netPriceDate: string | null;
  meritAwardOffered: number | null;
};

export type HouseholdFinances = {
  annualBudget: number | null;
  costIncreasePct: number;
  schools: Record<string, HouseholdSchoolFinance>;
};

export const DEFAULT_COST_INCREASE_PCT = 4;
export const HOME_PRICE_INDEX = 112.6;
export const HOME_HOUSING_INDEX = 148.6;

const file = financesFile as unknown as FinancesFile;

const byName = new Map<string, FinanceRecord>();
for (const row of file.schools) {
  byName.set(row.school, row);
}

export function financesSchoolCount(): number {
  return file.schools.length;
}

export function listFinanceRecords(): FinanceRecord[] {
  return file.schools;
}

export function financeRecordForSchoolName(name: string): FinanceRecord | null {
  return byName.get(name) ?? null;
}

export function newJerseyStatePrograms(): NjStateProgram[] {
  return file.newJerseyStatePrograms;
}

export function newJerseyGrantsPortable(): string {
  return file.newJerseyGrantsPortable;
}

/** Schools in the app with no finance row, and finance rows with no app school. */
export function unmatchedFinanceNames(schools: { name: string }[]): {
  missingFinance: string[];
  missingSchool: string[];
} {
  const appNames = new Set(schools.map((s) => s.name));
  const finNames = new Set(file.schools.map((s) => s.school));
  return {
    missingFinance: schools.map((s) => s.name).filter((n) => !finNames.has(n)),
    missingSchool: file.schools.map((s) => s.school).filter((n) => !appNames.has(n)),
  };
}

export function emptyHouseholdFinances(): HouseholdFinances {
  return {
    annualBudget: null,
    costIncreasePct: DEFAULT_COST_INCREASE_PCT,
    schools: {},
  };
}

export function normalizeHouseholdFinances(raw: unknown): HouseholdFinances {
  const out = emptyHouseholdFinances();
  if (!raw || typeof raw !== "object") return out;
  const row = raw as Record<string, unknown>;
  if (typeof row.annualBudget === "number" && Number.isFinite(row.annualBudget) && row.annualBudget >= 0) {
    out.annualBudget = Math.round(row.annualBudget);
  } else if (row.annualBudget === null) {
    out.annualBudget = null;
  }
  if (typeof row.costIncreasePct === "number" && Number.isFinite(row.costIncreasePct)) {
    out.costIncreasePct = row.costIncreasePct;
  }
  if (row.schools && typeof row.schools === "object" && !Array.isArray(row.schools)) {
    for (const [id, value] of Object.entries(row.schools as Record<string, unknown>)) {
      if (!id || !value || typeof value !== "object") continue;
      const entry = value as Record<string, unknown>;
      out.schools[id] = {
        netPriceEstimate:
          typeof entry.netPriceEstimate === "number" && Number.isFinite(entry.netPriceEstimate)
            ? Math.round(entry.netPriceEstimate)
            : null,
        netPriceDate:
          typeof entry.netPriceDate === "string" && entry.netPriceDate.trim()
            ? entry.netPriceDate.trim()
            : null,
        meritAwardOffered:
          typeof entry.meritAwardOffered === "number" && Number.isFinite(entry.meritAwardOffered)
            ? Math.round(entry.meritAwardOffered)
            : null,
      };
    }
  }
  return out;
}

export function schoolFinanceEntry(
  finances: HouseholdFinances,
  schoolId: string,
): HouseholdSchoolFinance {
  return (
    finances.schools[schoolId] ?? {
      netPriceEstimate: null,
      netPriceDate: null,
      meritAwardOffered: null,
    }
  );
}

export function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "Not published";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function moneyCompact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function residencyLabel(rate: string): string {
  if (rate === "in-state") return "In-state rate";
  if (rate === "out-of-state") return "Out-of-state rate";
  if (rate === "private") return "Private";
  return rate;
}

/**
 * Cost after typical merit. Schools that do not award merit (awardsMerit false)
 * never subtract a CDS figure — show as unavailable ("-").
 */
export function costAfterTypicalMerit(rec: FinanceRecord): number | null {
  if (!rec.awardsMerit) return null;
  if (rec.totalCost == null || rec.cdsAvgNonNeedMerit == null) return null;
  return rec.totalCost - rec.cdsAvgNonNeedMerit;
}

export function meritShareLabel(rec: FinanceRecord): string {
  if (!rec.awardsMerit) return "No merit aid";
  if (rec.meritSharePct == null) return "Not published";
  return `${Math.round(rec.meritSharePct)}%`;
}

/** Compare-to-budget figure: family NPC estimate if set, else published sticker. */
export function budgetCompareCost(
  rec: FinanceRecord,
  entry: HouseholdSchoolFinance,
): number | null {
  if (entry.netPriceEstimate != null) return entry.netPriceEstimate;
  return rec.totalCost;
}

/** Chart / scatter cost: estimate → after typical merit → sticker. */
export function chartCost(rec: FinanceRecord, entry: HouseholdSchoolFinance): number | null {
  if (entry.netPriceEstimate != null) return entry.netPriceEstimate;
  const after = costAfterTypicalMerit(rec);
  if (after != null) return after;
  return rec.totalCost;
}

export function fourYearTotal(base: number, costIncreasePct: number): number {
  let sum = 0;
  let year = base;
  const growth = 1 + costIncreasePct / 100;
  for (let i = 0; i < 4; i += 1) {
    sum += year;
    year *= growth;
  }
  return Math.round(sum);
}

export function fourYearEstimate(
  rec: FinanceRecord,
  entry: HouseholdSchoolFinance,
  costIncreasePct: number,
): number | null {
  const base = entry.netPriceEstimate ?? rec.totalCost;
  if (base == null) return null;
  return fourYearTotal(base, costIncreasePct);
}

export function budgetStatus(
  cost: number | null,
  annualBudget: number | null,
): { kind: "within" | "over" | "unknown"; overBy: number } {
  if (cost == null || annualBudget == null) return { kind: "unknown", overBy: 0 };
  if (cost <= annualBudget) return { kind: "within", overBy: 0 };
  return { kind: "over", overBy: cost - annualBudget };
}

export type BudgetSummary = {
  withinBudget: number;
  withinWithMerit: number;
  total: number;
};

/**
 * Summary line counts. "Within with merit" only counts schools that award merit
 * and whose cost-after-typical-merit falls in budget while sticker does not.
 */
export function budgetSummary(
  records: FinanceRecord[],
  annualBudget: number | null,
  entries: Record<string, HouseholdSchoolFinance>,
  schoolIdByName: Map<string, string>,
): BudgetSummary {
  const total = records.length;
  if (annualBudget == null) {
    return { withinBudget: 0, withinWithMerit: 0, total };
  }
  let withinBudget = 0;
  let withinWithMerit = 0;
  for (const rec of records) {
    const id = schoolIdByName.get(rec.school) ?? "";
    const entry = entries[id] ?? {
      netPriceEstimate: null,
      netPriceDate: null,
      meritAwardOffered: null,
    };
    const compare = budgetCompareCost(rec, entry);
    if (compare != null && compare <= annualBudget) {
      withinBudget += 1;
      continue;
    }
    const after = costAfterTypicalMerit(rec);
    if (after != null && after <= annualBudget) {
      withinWithMerit += 1;
    }
  }
  return { withinBudget, withinWithMerit, total };
}

export function isNjStateAidSchool(name: string): boolean {
  return (
    name.includes("Rutgers") ||
    name.includes("NJIT") ||
    name.includes("New Jersey Institute") ||
    name.includes("Stevens")
  );
}

export function meetsFullNeedBadge(rec: FinanceRecord): boolean {
  return rec.meetsFullNeed === "all students";
}

export function needProgramOpenToNj(program: NeedProgram): boolean {
  const r = program.residency.toLowerCase();
  if (r.includes("new jersey")) return true;
  if (r.includes("not restricted") || r.includes("no residency limit")) return true;
  if (r.includes("regardless of state")) return true;
  if (r.includes("including out-of-state") || r.includes("incoming non-resident")) return true;
  if (r.includes("non-wisconsin residents")) return true;
  // Another state's residents-only program (Michigan, California, Texas, …).
  if (/\bresidents?\s+only\b/.test(r) || /\bstudents\s+only\b/.test(r)) return false;
  if (r.includes("high school graduates who have lived in")) return false;
  if (r.includes("city of philadelphia")) return false;
  return true;
}

export function interestLevelRank(level: InterestLevel | ""): number {
  if (level === "top") return 4;
  if (level === "high") return 3;
  if (level === "moderate") return 2;
  if (level === "safety") return 1;
  return 0;
}

export function interestCssVar(level: InterestLevel | ""): string {
  const rank = interestLevelRank(level);
  if (rank >= 1 && rank <= 4) return `var(--lvl-${rank})`;
  return "var(--color-dash)";
}

export function shortSchoolName(name: string): string {
  const paren = name.match(/\(([^)]+)\)\s*$/);
  if (paren?.[1]) return paren[1];
  return name
    .replace(/^University of /, "U. ")
    .replace(/University$/, "U.")
    .replace(/Institute of Technology/, "Tech");
}

export function admitRateForChart(school: School): number | null {
  if (school.rateThatAppliesToKyle != null) return school.rateThatAppliesToKyle;
  if (school.overallAdmitRate != null) return school.overallAdmitRate;
  return null;
}

export type FinanceRow = {
  school: School;
  finance: FinanceRecord;
  entry: HouseholdSchoolFinance;
};

export function buildFinanceRows(
  schools: School[],
  finances: HouseholdFinances,
): { rows: FinanceRow[]; unmatched: ReturnType<typeof unmatchedFinanceNames> } {
  const unmatched = unmatchedFinanceNames(schools);
  const rows: FinanceRow[] = [];
  for (const school of schools) {
    if (school.archived) continue;
    const finance = financeRecordForSchoolName(school.name);
    if (!finance) continue;
    rows.push({
      school,
      finance,
      entry: schoolFinanceEntry(finances, school.id),
    });
  }
  return { rows, unmatched };
}

export function ordinalRank(n: number): string {
  const a = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${a[(v - 20) % 10] || a[v] || a[0]}`;
}

export function formatMeritSharePct(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  return `${String(rounded).replace(/\.0$/, "")}%`;
}

export type FinanceCompareTick = { leftPct: number; label: string };

export type FinanceCompareRow = {
  id: string;
  label: string;
  valueText: string;
  kind: "strip" | "none";
  noneText?: string;
  rankText?: string;
  posPct?: number;
  ticks?: FinanceCompareTick[];
  minLabel?: string;
  maxLabel?: string;
  budgetLeftPct?: number | null;
  budgetLabel?: string | null;
};

type CompareMetric = {
  id: string;
  label: string;
  get: (rec: FinanceRecord) => number | null;
  fmt: (v: number) => string;
  showBudget?: boolean;
  /** When this school's value is null: hide the row entirely. */
  hideWhenNull?: boolean;
  /** When this school's value is null: show a none message instead of a strip. */
  noneMessage?: (rec: FinanceRecord) => string;
};

function compareMetrics(): CompareMetric[] {
  return [
    {
      id: "published",
      label: "Published cost",
      get: (r) => r.totalCost,
      fmt: (v) => moneyCompact(v),
      showBudget: true,
    },
    {
      id: "meritShare",
      label: "First-years getting merit",
      get: (r) => (r.awardsMerit ? r.meritSharePct : null),
      fmt: formatMeritSharePct,
      noneMessage: (r) =>
        !r.awardsMerit
          ? `No merit aid. ${shortSchoolName(r.school)} gives need-based aid only.`
          : "Not published in the Common Data Set",
    },
    {
      id: "avgMerit",
      label: "Average merit award",
      get: (r) => (r.awardsMerit ? r.cdsAvgNonNeedMerit : null),
      fmt: (v) => moneyCompact(v),
      hideWhenNull: true,
    },
    {
      id: "afterMerit",
      label: "After typical merit",
      get: (r) => costAfterTypicalMerit(r),
      fmt: (v) => moneyCompact(v),
      showBudget: true,
      hideWhenNull: true,
    },
    {
      id: "col",
      label: "Cost of living · U.S. = 100",
      get: (r) => r.costOfLivingIndex,
      fmt: (v) => String(v),
    },
  ];
}

/** Peer comparison strips for one school against the family's list. */
export function buildFinanceCompareRows(
  focus: FinanceRecord,
  peers: FinanceRecord[],
  annualBudget: number | null,
): FinanceCompareRow[] {
  const list = peers.length ? peers : [focus];
  const rows: FinanceCompareRow[] = [];

  for (const metric of compareMetrics()) {
    const mine = metric.get(focus);
    if (mine == null && metric.hideWhenNull) continue;

    if (mine == null) {
      rows.push({
        id: metric.id,
        label: metric.label,
        valueText: "—",
        kind: "none",
        noneText: metric.noneMessage?.(focus) ?? "Not published",
      });
      continue;
    }

    const vals = list
      .map((rec) => {
        const v = metric.get(rec);
        if (v == null) return null;
        return { short: shortSchoolName(rec.school), v };
      })
      .filter((o): o is { short: string; v: number } => o != null);

    if (vals.length === 0) {
      rows.push({
        id: metric.id,
        label: metric.label,
        valueText: metric.fmt(mine),
        kind: "none",
        noneText: "Not published",
      });
      continue;
    }

    const lo = Math.min(...vals.map((o) => o.v));
    const hi = Math.max(...vals.map((o) => o.v));
    const span = hi - lo || 1;
    const pct = (v: number) => ((v - lo) / span) * 100;
    const minO = vals.find((o) => o.v === lo)!;
    const maxO = vals.find((o) => o.v === hi)!;
    const n = vals.length;
    const lowerRank = vals.filter((o) => o.v < mine).length + 1;
    const higherRank = vals.filter((o) => o.v > mine).length + 1;
    const rankText =
      lowerRank <= higherRank
        ? `${ordinalRank(lowerRank)} lowest of ${n}`
        : `${ordinalRank(higherRank)} highest of ${n}`;

    let budgetLeftPct: number | null = null;
    let budgetLabel: string | null = null;
    if (
      metric.showBudget &&
      annualBudget != null &&
      annualBudget > lo &&
      annualBudget < hi
    ) {
      budgetLeftPct = pct(annualBudget);
      budgetLabel = `budget ${moneyCompact(annualBudget)}`;
    }

    rows.push({
      id: metric.id,
      label: metric.label,
      valueText: metric.fmt(mine),
      kind: "strip",
      rankText,
      posPct: pct(mine),
      ticks: vals
        .filter((o) => o.short !== shortSchoolName(focus.school))
        .map((o) => ({
          leftPct: pct(o.v),
          label: `${o.short} ${metric.fmt(o.v)}`,
        })),
      minLabel: `${metric.fmt(lo)} · ${minO.short}`,
      maxLabel: `${maxO.short} · ${metric.fmt(hi)}`,
      budgetLeftPct,
      budgetLabel,
    });
  }

  return rows;
}

export type CostBarSegment = {
  key: string;
  label: string;
  value: number;
  leftPct: number;
  widthPct: number;
  inside: boolean;
  bg: string;
  fg: string;
};

export type CostBarCallout = {
  key: string;
  label: string;
  valueText: string;
  xPct: number;
  leaderPx: number;
  topPx: number;
  shiftLeft: boolean;
};

export function buildCostBar(
  rec: FinanceRecord,
): {
  segments: CostBarSegment[];
  callouts: CostBarCallout[];
  partsSum: number;
  gapNote: string | null;
  barExtraPx: number;
} {
  const raw: { key: string; label: string; value: number | null; bg: string; fg: string }[] = [
    {
      key: "tuition",
      label: "Tuition and fees",
      value: rec.tuitionFees,
      bg: "var(--color-text)",
      fg: "var(--color-bg)",
    },
    {
      key: "housing",
      label: "Housing and food",
      value: rec.housingFood,
      bg: "var(--text-subtle)",
      fg: "var(--color-bg)",
    },
    {
      key: "books",
      label: "Books",
      value: rec.booksSupplies,
      bg: "var(--text-placeholder)",
      fg: "var(--color-text)",
    },
    {
      key: "other",
      label: "Other",
      value: rec.otherCosts,
      bg: "var(--color-dash)",
      fg: "var(--color-text)",
    },
  ];
  const parts = raw.filter((p): p is typeof p & { value: number } => p.value != null && p.value > 0);
  const partsSum = parts.reduce((t, p) => t + p.value, 0);
  const segments: CostBarSegment[] = [];
  const callouts: CostBarCallout[] = [];
  let acc = 0;
  for (const part of parts) {
    const widthPct = partsSum > 0 ? (part.value / partsSum) * 100 : 0;
    const inside = widthPct >= 16;
    segments.push({
      key: part.key,
      label: part.label,
      value: part.value,
      leftPct: partsSum > 0 ? (acc / partsSum) * 100 : 0,
      widthPct,
      inside,
      bg: part.bg,
      fg: part.fg,
    });
    if (!inside) {
      const i = callouts.length;
      const xPct = partsSum > 0 ? ((acc + part.value / 2) / partsSum) * 100 : 0;
      callouts.push({
        key: part.key,
        label: part.label,
        valueText: moneyCompact(part.value),
        xPct,
        leaderPx: 16 + i * 26,
        topPx: 64 + i * 26,
        shiftLeft: xPct > 60,
      });
    }
    acc += part.value;
  }
  const gap =
    rec.totalCost != null && partsSum > 0 && rec.totalCost - partsSum > 0
      ? rec.totalCost - partsSum
      : 0;
  return {
    segments,
    callouts,
    partsSum,
    gapNote: gap > 0 ? `+ ${moneyCompact(gap)} other fees in the published total` : null,
    barExtraPx: callouts.length ? 16 + callouts.length * 26 : 0,
  };
}
