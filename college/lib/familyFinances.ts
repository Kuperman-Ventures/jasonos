/**
 * Family finances estimates (simplified SAI / CSS Profile-style figures).
 * Raw income and balances are never persisted — only derived bands/ranges/flags.
 */

import type { FinanceRecord, NeedProgram } from "@/lib/finances";

export const MAX_PELL = 7395;

function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function moneyCompact(n: number): string {
  if (n <= 0) return "$0";
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)}k`;
  return money(n);
}

function isNjSchoolName(name: string): boolean {
  return /rutgers|njit|new jersey institute|stevens/i.test(name);
}

export type ParentSituation =
  | "married"
  | "together"
  | "divorced"
  | "single"
  | "widowed"
  | "nop"
  | "unavail";

export type IncomeBand =
  | "Under $30,000"
  | "$30,000–$48,000"
  | "$48,000–$75,000"
  | "$75,000–$110,000"
  | "Over $110,000";

export type ProgramStatus =
  | "qualifies"
  | "likely"
  | "possible"
  | "unlikely"
  | "not-eligible";

export type FamilyProgramResult = {
  key: string;
  status: ProgramStatus;
  label: string;
  detail: string;
};

export type FamilySchoolEstimate = {
  low: number;
  high: number;
  basis: string;
  programTag: string | null;
};

export type FamilyProfile = {
  enteredAt: string;
  incomeBand: IncomeBand;
  saiLow: number;
  saiHigh: number;
  imLow: number;
  imHigh: number;
  pell: number;
  residency: "NJ" | "other";
  flags: {
    homeEquity: boolean;
    divorcedOtherParent: boolean;
    otherParentWaiver: boolean;
    business: boolean;
    multipleInCollege: boolean;
    circumstancesChanged: boolean;
    parentInfo: "both" | "one" | "none" | "unavailable";
  };
  programs: FamilyProgramResult[];
  agiThresholds: {
    under65k: boolean;
    under80k: boolean;
    under100k: boolean;
    under200k: boolean;
  };
  /** Keyed by school id. */
  schools: Record<string, FamilySchoolEstimate>;
};

/** Raw modal state — kept in component memory only, never saved. */
export type FamilyFinanceDraft = {
  sit: ParentSituation | null;
  remarried: boolean;
  hh: number;
  nic: number;
  state: "NJ" | "other";
  agi: number;
  p1: number;
  p2: number;
  tax: number;
  untaxed: number;
  cs: number;
  self: boolean;
  chgJob: boolean;
  chgMed: boolean;
  chgOther: boolean;
  cash: number;
  inv: number;
  re: number;
  biz: number;
  home: number;
  ret: number;
  opInc: number;
  opAst: number;
  opNone: boolean;
  kInc: number;
  kAst: number;
};

export const EMPTY_FAMILY_DRAFT: FamilyFinanceDraft = {
  sit: null,
  remarried: false,
  hh: 4,
  nic: 1,
  state: "NJ",
  agi: 0,
  p1: 0,
  p2: 0,
  tax: 0,
  untaxed: 0,
  cs: 0,
  self: false,
  chgJob: false,
  chgMed: false,
  chgOther: false,
  cash: 0,
  inv: 0,
  re: 0,
  biz: 0,
  home: 0,
  ret: 0,
  opInc: 0,
  opAst: 0,
  opNone: false,
  kInc: 0,
  kAst: 0,
};

/** Sample family from example.html (married, HH of 4, NJ, AGI $145k). */
export const SAMPLE_FAMILY_DRAFT: FamilyFinanceDraft = {
  ...EMPTY_FAMILY_DRAFT,
  sit: "married",
  hh: 4,
  nic: 1,
  state: "NJ",
  agi: 145000,
  p1: 90000,
  p2: 55000,
  tax: 16000,
  cash: 30000,
  inv: 60000,
  home: 250000,
  ret: 400000,
  kInc: 4000,
  kAst: 3000,
};

export type FamilyStepId =
  | "household"
  | "income"
  | "assets"
  | "other-parent"
  | "kyle"
  | "review";

export const PARENT_SITUATIONS: {
  id: ParentSituation;
  label: string;
}[] = [
  { id: "married", label: "Married or remarried" },
  { id: "together", label: "Unmarried, living together" },
  { id: "divorced", label: "Divorced or separated" },
  { id: "single", label: "Single, never married" },
  { id: "widowed", label: "Widowed" },
  {
    id: "nop",
    label:
      "No parent information (foster care, ward of the court, orphaned, legal guardianship, emancipated or homeless)",
  },
  {
    id: "unavail",
    label: "Parents can't be contacted (dependency override)",
  },
];

export function hasParentInfo(sit: ParentSituation | null): boolean {
  return Boolean(sit && sit !== "nop" && sit !== "unavail");
}

export function isTwoParentEarners(d: FamilyFinanceDraft): boolean {
  if (!hasParentInfo(d.sit)) return false;
  return (
    d.sit === "married" ||
    d.sit === "together" ||
    (d.sit === "divorced" && d.remarried)
  );
}

export function stepsForDraft(d: FamilyFinanceDraft): { id: FamilyStepId; title: string }[] {
  const hasP = hasParentInfo(d.sit);
  const div = d.sit === "divorced";
  const steps: { id: FamilyStepId; title: string }[] = [
    { id: "household", title: "Household" },
  ];
  if (hasP) {
    steps.push({ id: "income", title: "Income" });
    steps.push({ id: "assets", title: "Assets" });
  }
  if (div) steps.push({ id: "other-parent", title: "Other parent" });
  steps.push({ id: "kyle", title: "Kyle" });
  steps.push({ id: "review", title: "Review" });
  return steps;
}

/** Progressive contribution scale from the federal formula (example.html). */
export function contributionScale(availableIncome: number): number {
  const a = availableIncome;
  if (a < -6820) return -1500;
  if (a <= 20200) return 0.22 * a;
  if (a <= 25400) return 4444 + 0.25 * (a - 20200);
  if (a <= 30500) return 5744 + 0.29 * (a - 25400);
  if (a <= 35700) return 7223 + 0.34 * (a - 30500);
  if (a <= 40800) return 8991 + 0.4 * (a - 35700);
  return 11031 + 0.47 * (a - 40800);
}

export function incomeProtectionAllowance(householdSize: number): number {
  const n = Math.max(1, householdSize);
  const base = [0, 0, 27600, 34360, 42440, 50070, 58560][Math.min(n, 6)] ?? 58560;
  return base + Math.max(0, n - 6) * 6610;
}

export function incomeBandForAgi(agi: number): IncomeBand {
  if (agi < 30000) return "Under $30,000";
  if (agi < 48000) return "$30,000–$48,000";
  if (agi < 75000) return "$48,000–$75,000";
  if (agi < 110000) return "$75,000–$110,000";
  return "Over $110,000";
}

export function rangeAround(
  value: number,
  pct: number,
): { low: number; high: number } {
  if (value <= 0) return { low: 0, high: 0 };
  const low = Math.floor((value * (1 - pct)) / 1000) * 1000;
  const high = Math.ceil((value * (1 + pct)) / 1000) * 1000;
  return { low: Math.max(0, low), high: Math.max(low, high) };
}

export function formatRangeK(low: number, high: number): string {
  if (low <= 0 && high <= 0) return "$0";
  if (low === high) return moneyCompact(low);
  return `${moneyCompact(low)}–${moneyCompact(high)}`;
}

function statusFromLabel(label: string): ProgramStatus {
  const t = label.toLowerCase();
  if (t.includes("not eligible")) return "not-eligible";
  if (t.includes("unlikely")) return "unlikely";
  if (t.includes("possible") || t.includes("near")) return "possible";
  if (t.includes("likely")) return "likely";
  return "qualifies";
}

export type CalcCore = {
  sai: number | null;
  im: number | null;
  pell: number;
  band: IncomeBand;
  agi: number;
  autoLow: boolean;
  nj: boolean;
  hasP: boolean;
  cssExtras: string[];
  circumstancesChanged: boolean;
  nInCollege: number;
};

export function calcCore(d: FamilyFinanceDraft): CalcCore {
  const hasP = hasParentInfo(d.sit);
  const two = isTwoParentEarners(d);
  const solo = hasP && !two;
  const n = Math.max(1, d.hh || 1);
  const pov = 15650 + 5500 * (n - 1);
  const nj = d.state === "NJ";
  const ti = hasP ? d.agi + d.untaxed : d.kInc;

  let pc = 0;
  let imP = 0;
  let op = 0;

  if (hasP) {
    const earned = d.p1 + (two ? d.p2 : 0);
    const ipa = incomeProtectionAllowance(n);
    const eea = Math.min(4730, 0.35 * (two ? Math.min(d.p1, d.p2) : d.p1));
    const ai =
      ti -
      (d.tax + 0.0765 * Math.min(earned, 176100) + 0.03 * ti + ipa + eea);
    const nw = d.cash + d.inv + d.re + (d.self ? d.biz : 0) + d.cs;
    pc = contributionScale(ai + 0.12 * Math.max(0, nw));
    const home = Math.min(d.home, 2.4 * Math.max(ti, 1));
    imP =
      Math.max(0, contributionScale(ai + 0.12 * Math.max(0, nw + home))) /
      Math.max(1, d.nic || 1);
    if (d.sit === "divorced" && !d.opNone) {
      op = Math.max(
        0,
        contributionScale(0.6 * d.opInc - ipa * 0.6 + 0.12 * d.opAst),
      );
    }
  }

  const sc = Math.max(0, 0.5 * (d.kInc - 11510)) + 0.2 * d.kAst;
  const autoLow = hasP && d.agi <= (solo ? 2.25 : 1.75) * pov;
  const sai = !d.sit
    ? null
    : autoLow
      ? -1500
      : Math.max(-1500, Math.round(pc + sc));
  const im = !d.sit ? null : autoLow ? 0 : Math.round(imP + sc + op);
  const pell =
    sai == null
      ? 0
      : sai <= 0
        ? MAX_PELL
        : MAX_PELL - sai >= 740
          ? MAX_PELL - sai
          : 0;
  const agi = hasP ? d.agi : d.kInc;

  const cssExtras: string[] = [];
  if (hasP && d.home > 0) cssExtras.push("home equity");
  if (d.sit === "divorced") {
    cssExtras.push(
      d.opNone
        ? "the other parent's finances unless they grant a waiver"
        : "the other parent's income and assets",
    );
  }
  if (hasP && d.self && d.biz > 0) cssExtras.push("business value");
  if (hasP && (d.nic || 1) > 1) {
    cssExtras.push(`splitting the parent share across ${d.nic} students in college`);
  }

  return {
    sai,
    im,
    pell: Math.max(0, Math.round(pell)),
    band: incomeBandForAgi(agi),
    agi,
    autoLow,
    nj,
    hasP,
    cssExtras,
    circumstancesChanged: d.chgJob || d.chgMed || d.chgOther,
    nInCollege: Math.max(1, d.nic || 1),
  };
}

function njPrograms(
  core: CalcCore,
  d: FamilyFinanceDraft,
): FamilyProgramResult[] {
  const { nj, sai, agi } = core;
  const n = Math.max(1, d.hh || 1);
  const pov = 15650 + 5500 * (n - 1);
  const ti = core.hasP ? d.agi + d.untaxed : d.kInc;

  const tag = !nj
    ? {
        label: "Not eligible",
        detail: "New Jersey residents only",
      }
    : (sai ?? 999999) <= 15000
      ? {
          label: "Likely",
          detail:
            "At Rutgers, NJIT and Stevens. HESAA sets the cutoff each year from the FAFSA",
        }
      : (sai ?? 999999) <= 25000
        ? {
            label: "Possible",
            detail:
              "Near the usual cutoff. HESAA sets it each year from the FAFSA",
          }
        : {
            label: "Unlikely",
            detail: "The aid index is above the usual cutoff",
          };

  const gsg = !nj
    ? { label: "Not eligible", detail: "New Jersey residents only" }
    : agi <= 100000
      ? { label: "Eligible", detail: "Years 3 and 4 at Rutgers and NJIT" }
      : { label: "Not eligible", detail: "AGI over $100,000" };

  const eof = !nj
    ? { label: "Not eligible", detail: "New Jersey residents only" }
    : ti <= 2 * pov
      ? {
          label: "Possible",
          detail: `Income under ${money(2 * pov)} for a household of ${n}. Also needs academic eligibility`,
        }
      : {
          label: "Not eligible",
          detail: `Income above ${money(2 * pov)} for a household of ${n}`,
        };

  return [
    {
      key: "tag",
      status: statusFromLabel(tag.label),
      label: "NJ Tuition Aid Grant (TAG)",
      detail: `${tag.label}. ${tag.detail}`,
    },
    {
      key: "gsg",
      status: statusFromLabel(gsg.label),
      label: "Garden State Guarantee",
      detail: `${gsg.label}. ${gsg.detail}`,
    },
    {
      key: "eof",
      status: statusFromLabel(eof.label),
      label: "Educational Opportunity Fund",
      detail: `${eof.label}. ${eof.detail}`,
    },
  ];
}

export function programCapForSchool(
  rec: FinanceRecord,
  agi: number,
  residencyNj: boolean,
): { cap: number; tag: string; why: string } | null {
  const matches: { cap: number; tag: string; why: string }[] = [];
  for (const p of rec.needPrograms) {
    if (p.agiMax == null || agi > p.agiMax) continue;
    if (p.residencyState === "NJ" && !residencyNj) continue;
    if (p.residencyState && p.residencyState !== "NJ") continue;
    const effect = p.effect;
    if (!effect) continue;
    const cost = rec.totalCost ?? Infinity;
    if (effect === "full-cost") {
      matches.push({
        cap: 0,
        tag: p.name,
        why: `${p.name} covers the full cost for your income.`,
      });
      continue;
    }
    if (effect === "tuition-free") {
      const tuition = rec.tuitionFees ?? 0;
      matches.push({
        cap: Math.max(0, cost - tuition),
        tag: p.name,
        why: `${p.name} covers full tuition for your income, so the family pays at most housing, food and other costs.`,
      });
      continue;
    }
    if (typeof effect === "object" && effect && "tuitionCap" in effect) {
      const tuition = rec.tuitionFees ?? 0;
      const other = Math.max(0, cost - tuition);
      matches.push({
        cap: other + effect.tuitionCap,
        tag: p.name,
        why: `${p.name} caps tuition and fees for your income.`,
      });
    }
  }
  if (!matches.length) return null;
  matches.sort((a, b) => a.cap - b.cap);
  return matches[0]!;
}

export function estimateForSchool(
  rec: FinanceRecord,
  core: CalcCore,
  d: FamilyFinanceDraft,
  tagLikely: boolean,
): FamilySchoolEstimate | null {
  const cost = rec.totalCost;
  if (cost == null) return null;

  const cssReq = rec.cssProfileRequired === true;
  const fam = Math.max(0, cssReq ? (core.im ?? 0) : (core.sai ?? 0));
  const program = programCapForSchool(rec, core.agi, core.nj);
  const cap = program?.cap ?? Infinity;
  const tagT = program?.tag ?? null;
  const why = program?.why ?? "";

  const njSchool = isNjSchoolName(rec.school);
  const grants = core.pell + (njSchool && tagLikely ? 5000 : 0);

  const full = rec.meetsFullNeed;
  const meetsAll = full === "all students";
  const meetsInOnly = full === "in-state only";

  let lo: number;
  let hi: number;
  let basis: string;

  if (meetsAll) {
    lo = hi = Math.min(cost, fam, cap);
    basis = `Meets full need · ${cssReq ? "CSS Profile figure" : "FAFSA figure"}`;
  } else {
    lo = Math.min(cost, fam, cap);
    hi = Math.min(cost - grants, cap);
    if (lo > hi) lo = hi;
    basis = meetsInOnly
      ? "Meets full need for in-state only"
      : full === "no"
        ? "Does not meet full need"
        : "Need policy not stated";
  }

  if (why) {
    basis = `${tagT} · ${basis}`;
  }

  let long = "";
  if (meetsAll) {
    long = `${rec.school} meets full demonstrated need, so the family pays about its ${
      cssReq
        ? "CSS Profile contribution, which counts home equity and other assets the FAFSA ignores."
        : "Student Aid Index."
    }`;
  } else {
    long =
      `${rec.school}` +
      (meetsInOnly
        ? " meets full need only for in-state students, so Kyle could be left with a gap."
        : full === "no"
          ? " does not commit to meeting full need."
          : " does not say whether it meets full need.") +
      " The low end assumes it covers all of your need; the high end is the published cost minus Pell" +
      (njSchool ? " and likely state grants" : "") +
      ". Merit aid would lower both.";
  }
  if (why) {
    long =
      why +
      (lo <= cap && cap < Math.min(cost, fam)
        ? " That cap is lower than your family's expected contribution, so it sets the estimate."
        : " Your expected contribution is lower than that cap, so it sets the estimate.");
  }

  return {
    low: Math.round(lo),
    high: Math.round(hi),
    basis: why ? `${basis}. ${long}` : `${basis}. ${long}`,
    programTag: tagT,
  };
}

export type SchoolRef = {
  id: string;
  name: string;
  finance: FinanceRecord | null;
};

export function buildFamilyProfile(
  d: FamilyFinanceDraft,
  schools: SchoolRef[],
  enteredAt: string = new Date().toISOString().slice(0, 10),
): FamilyProfile | null {
  if (!d.sit) return null;
  const core = calcCore(d);
  if (core.sai == null || core.im == null) return null;

  const saiRange = rangeAround(Math.max(0, core.sai), 0.1);
  // Keep negative SAI as a low floor range for display/storage when auto-low
  const saiLow = core.sai < 0 ? core.sai : saiRange.low;
  const saiHigh = core.sai < 0 ? core.sai : saiRange.high;
  const imRange = rangeAround(Math.max(0, core.im), 0.15);

  const njProgs = njPrograms(core, d);
  const tagLikely = njProgs.some((p) => p.key === "tag" && p.status === "likely");

  const programs: FamilyProgramResult[] = [
    {
      key: "pell",
      status: core.pell > 0 ? "qualifies" : "not-eligible",
      label: "Pell Grant",
      detail:
        core.pell > 0
          ? `Up to ${money(core.pell)}. Federal grant, any school`
          : "Not eligible. Aid index above the Pell range",
    },
    ...njProgs,
  ];

  // School-specific income programs that aren't NJ-only
  const schoolProgKeys = new Set<string>();
  for (const s of schools) {
    if (!s.finance) continue;
    const cap = programCapForSchool(s.finance, core.agi, core.nj);
    if (cap && !schoolProgKeys.has(cap.tag)) {
      schoolProgKeys.add(cap.tag);
      programs.push({
        key: `school:${cap.tag}`,
        status: "qualifies",
        label: cap.tag,
        detail: cap.why,
      });
    }
  }

  const two = isTwoParentEarners(d);
  const parentInfo: FamilyProfile["flags"]["parentInfo"] =
    d.sit === "nop"
      ? "none"
      : d.sit === "unavail"
        ? "unavailable"
        : two
          ? "both"
          : "one";

  const schoolEstimates: Record<string, FamilySchoolEstimate> = {};
  for (const s of schools) {
    if (!s.finance) continue;
    const est = estimateForSchool(s.finance, core, d, tagLikely);
    if (est) schoolEstimates[s.id] = est;
  }

  return {
    enteredAt,
    incomeBand: core.band,
    saiLow,
    saiHigh,
    imLow: imRange.low,
    imHigh: imRange.high,
    pell: core.pell,
    residency: core.nj ? "NJ" : "other",
    flags: {
      homeEquity: core.hasP && d.home > 0,
      divorcedOtherParent: d.sit === "divorced" && !d.opNone,
      otherParentWaiver: d.sit === "divorced" && d.opNone,
      business: core.hasP && d.self && d.biz > 0,
      multipleInCollege: core.hasP && d.nic > 1,
      circumstancesChanged: core.circumstancesChanged,
      parentInfo,
    },
    programs,
    agiThresholds: {
      under65k: core.agi <= 65000,
      under80k: core.agi <= 80000,
      under100k: core.agi <= 100000,
      under200k: core.agi < 200000,
    },
    schools: schoolEstimates,
  };
}

export function normalizeFamilyProfile(raw: unknown): FamilyProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  try {
    const bands: IncomeBand[] = [
      "Under $30,000",
      "$30,000–$48,000",
      "$48,000–$75,000",
      "$75,000–$110,000",
      "Over $110,000",
    ];
    if (typeof row.enteredAt !== "string" || !row.enteredAt.trim()) return null;
    if (!bands.includes(row.incomeBand as IncomeBand)) return null;
    for (const k of ["saiLow", "saiHigh", "imLow", "imHigh", "pell"] as const) {
      if (typeof row[k] !== "number" || !Number.isFinite(row[k] as number)) return null;
    }
    if (row.residency !== "NJ" && row.residency !== "other") return null;
    if (!row.flags || typeof row.flags !== "object") return null;
    if (!Array.isArray(row.programs)) return null;
    if (!row.agiThresholds || typeof row.agiThresholds !== "object") return null;
    if (!row.schools || typeof row.schools !== "object") return null;

    const flags = row.flags as Record<string, unknown>;
    const parentInfo = flags.parentInfo;
    if (
      parentInfo !== "both" &&
      parentInfo !== "one" &&
      parentInfo !== "none" &&
      parentInfo !== "unavailable"
    ) {
      return null;
    }

    const schools: Record<string, FamilySchoolEstimate> = {};
    for (const [id, value] of Object.entries(row.schools as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const e = value as Record<string, unknown>;
      if (typeof e.low !== "number" || typeof e.high !== "number") continue;
      if (typeof e.basis !== "string") continue;
      schools[id] = {
        low: e.low,
        high: e.high,
        basis: e.basis,
        programTag: typeof e.programTag === "string" ? e.programTag : null,
      };
    }

    const programs: FamilyProgramResult[] = [];
    for (const p of row.programs) {
      if (!p || typeof p !== "object") continue;
      const pr = p as Record<string, unknown>;
      if (typeof pr.key !== "string" || typeof pr.label !== "string") continue;
      if (typeof pr.detail !== "string") continue;
      const st = pr.status;
      if (
        st !== "qualifies" &&
        st !== "likely" &&
        st !== "possible" &&
        st !== "unlikely" &&
        st !== "not-eligible"
      ) {
        continue;
      }
      programs.push({
        key: pr.key,
        status: st,
        label: pr.label,
        detail: pr.detail,
      });
    }

    const agi = row.agiThresholds as Record<string, unknown>;
    return {
      enteredAt: row.enteredAt.trim(),
      incomeBand: row.incomeBand as IncomeBand,
      saiLow: row.saiLow as number,
      saiHigh: row.saiHigh as number,
      imLow: row.imLow as number,
      imHigh: row.imHigh as number,
      pell: row.pell as number,
      residency: row.residency as "NJ" | "other",
      flags: {
        homeEquity: Boolean(flags.homeEquity),
        divorcedOtherParent: Boolean(flags.divorcedOtherParent),
        otherParentWaiver: Boolean(flags.otherParentWaiver),
        business: Boolean(flags.business),
        multipleInCollege: Boolean(flags.multipleInCollege),
        circumstancesChanged: Boolean(flags.circumstancesChanged),
        parentInfo,
      },
      programs,
      agiThresholds: {
        under65k: Boolean(agi.under65k),
        under80k: Boolean(agi.under80k),
        under100k: Boolean(agi.under100k),
        under200k: Boolean(agi.under200k),
      },
      schools,
    };
  } catch {
    return null;
  }
}

export function formatEnteredDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function cssNoteForProfile(profile: FamilyProfile, cssSchoolCount: number): string {
  const parts: string[] = [];
  if (profile.flags.homeEquity) parts.push("home equity");
  if (profile.flags.divorcedOtherParent) parts.push("the other parent's income and assets");
  if (profile.flags.otherParentWaiver) {
    parts.push("the other parent's finances unless they grant a waiver");
  }
  if (profile.flags.business) parts.push("business value");
  if (profile.flags.multipleInCollege) parts.push("splitting the parent share across siblings");
  let note =
    cssSchoolCount > 0
      ? parts.length
        ? `At the ${cssSchoolCount} CSS Profile schools, the estimate also counts ${parts.join(", ")}.`
        : `At the ${cssSchoolCount} CSS Profile schools, nothing extra applies for your situation beyond the usual Profile items.`
      : "";
  if (profile.flags.circumstancesChanged) {
    note +=
      (note ? " " : "") +
      "You noted changes since 2025. Tell each aid office, because they can adjust for them.";
  }
  return note;
}

/** Map income band label to Scoir net-price band key. */
export function incomeBandToScoirKey(
  band: IncomeBand,
): "under30k" | "30to48k" | "48to75k" | "75to110k" | "over110k" {
  switch (band) {
    case "Under $30,000":
      return "under30k";
    case "$30,000–$48,000":
      return "30to48k";
    case "$48,000–$75,000":
      return "48to75k";
    case "$75,000–$110,000":
      return "75to110k";
    default:
      return "over110k";
  }
}
