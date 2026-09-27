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
