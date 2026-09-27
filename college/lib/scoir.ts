/**
 * Scoir import overlay (2026-09-27). Matched by unitId, then exact school name.
 * Nested Scoir facts stay in data/scoir-import-2026-09-27.json — not on the school row.
 * Empty SAT / platform / essay fills are applied via migration 0033.
 */

import scoirFile from "@/data/scoir-import-2026-09-27.json";
import type { School } from "@/lib/types";

export type ScoirRequirementLevel =
  | "Required"
  | "Required for some applicants"
  | "Optional"
  | "Not required"
  | "";

export type ScoirDeadlineRound = {
  roundName: string;
  roundType: string;
  deadline: string;
  binding: boolean;
};

export type ScoirNetPriceByIncome = {
  under30k: number | null;
  "30to48k": number | null;
  "48to75k": number | null;
  "75to110k": number | null;
  over110k: number | null;
  average: number | null;
};

export type ScoirRaceEthnicity = {
  asian: number;
  black: number;
  hispanic: number;
  white: number;
  americanIndian: number;
  allOther: number;
};

export type ScoirGender = {
  female: number;
  male: number;
};

export type ScoirTopPlace = {
  place: string;
  pct: number;
};

export type ScoirGeography = {
  homeState: string;
  homeStatePct: number | null;
  newJerseyPct: number | null;
  otherUsStatesPct: number | null;
  internationalPct: number | null;
  statesRepresented: number | null;
  topPlaces: ScoirTopPlace[];
  complete: boolean;
};

export type ScoirGreekLife = {
  fraternities: number | null;
  sororities: number | null;
  fraternityParticipationPct: number | null;
  sororityParticipationPct: number | null;
};

export type ScoirRecord = {
  school: string;
  unitId: number;
  scoirId: number;
  scoirListStatus: "Following" | "Applying";
  applicationPlatforms: string[];
  usesCommonApp: boolean;
  essayOrStatement: ScoirRequirementLevel | null;
  resume: ScoirRequirementLevel | null;
  portfolio: ScoirRequirementLevel | null;
  interview: ScoirRequirementLevel | null;
  considersDemonstratedInterest: boolean;
  applicationFee: number | null;
  fall2027EntryDeadlines: ScoirDeadlineRound[];
  admitRatePct: number | null;
  applicants: number | null;
  admitted: number | null;
  enrolled: number | null;
  satMid50: string | null;
  satMathMid50: string | null;
  satReadingWritingMid50: string | null;
  actMid50: string | null;
  firstYearRetentionPct: number | null;
  stickerPriceInState: number | null;
  stickerPriceOutOfState: number | null;
  tuitionInState: number | null;
  tuitionOutOfState: number | null;
  roomAndBoard: number | null;
  netPriceByIncome: ScoirNetPriceByIncome | null;
  netPriceByIncomeNote: string | null;
  pctReceivingAid: number | null;
  pctFederalLoans: number | null;
  medianDebtAtGraduation: number | null;
  honorsCollege: "Apply" | "Invite" | null;
  nearestAirport: string | null;
  nearestAirportMiles: number | null;
  nearestTrainStation: string | null;
  nearestTrainStationMiles: number | null;
  ncaaDivision: string | null;
  conference: string | null;
  rotc: string[];
  engineeringShareOfDegreesPct: number | null;
  undergradRaceEthnicityPct: ScoirRaceEthnicity | null;
  undergradGenderPct: ScoirGender | null;
  undergradFullTimePct: number | null;
  undergradGeography: ScoirGeography | null;
  greekLife: ScoirGreekLife | null;
};

export type ScoirFile = {
  updateType: string;
  source: string;
  pulledDate: string;
  matchOn: string;
  schoolCount: number;
  schools: ScoirRecord[];
};

export const SCOIR_PULLED_DATE = "2026-09-27";
export const SCOIR_DEADLINES_LABEL = "Fall 2027 entry deadlines (last cycle)";

const file = scoirFile as unknown as ScoirFile;

const byUnitId = new Map<number, ScoirRecord>();
const byName = new Map<string, ScoirRecord>();
for (const row of file.schools) {
  byUnitId.set(row.unitId, row);
  byName.set(row.school, row);
}

/** Tracker schools known to have no Scoir row. */
export const SCOIR_ABSENT_NAMES = [
  "Stevens Institute of Technology",
  "Worcester Polytechnic Institute (WPI)",
  "Rose-Hulman Institute of Technology",
  "University of Florida",
  "Vassar College",
] as const;

export function scoirSchoolCount(): number {
  return file.schoolCount;
}

export function listScoirRecords(): ScoirRecord[] {
  return file.schools;
}

export function scoirRecordForSchool(school: Pick<School, "name" | "unitId">): ScoirRecord | null {
  if (school.unitId != null && byUnitId.has(school.unitId)) {
    return byUnitId.get(school.unitId) ?? null;
  }
  return byName.get(school.name) ?? null;
}

export function scoirNewJerseyPct(school: Pick<School, "name" | "unitId">): number | null {
  const rec = scoirRecordForSchool(school);
  const pct = rec?.undergradGeography?.newJerseyPct;
  return pct == null || !Number.isFinite(pct) ? null : pct;
}

/** Format Scoir mid-50 "1500-1570" as the tracker's "~1500–1570". */
export function formatScoirSatMid50(mid: string | null | undefined): string {
  if (!mid?.trim()) return "";
  return `~${mid.trim().replace(/-/g, "–")}`;
}

export function formatScoirPlatforms(platforms: string[] | null | undefined): string {
  return (platforms ?? []).filter(Boolean).join(", ");
}

export function formatScoirMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatScoirPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10 ** digits) / 10 ** digits;
  const text = String(rounded).replace(/\.0$/, "");
  return `${text}%`;
}

export function formatScoirDeadline(mmdd: string): string {
  const m = mmdd.match(/^(\d{2})-(\d{2})$/);
  if (!m) return mmdd;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const names = [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${names[month] ?? m[1]} ${day}`;
}

export function scoirListStatusLabel(status: ScoirRecord["scoirListStatus"] | null | undefined): string {
  if (!status) return "";
  return `Scoir: ${status}`;
}

/** Public schools outside New Jersey — Scoir net price is in-state. */
export function scoirNeedsOutOfStateNetPriceNote(school: Pick<School, "control" | "name" | "location">): boolean {
  if (school.control !== "Public") return false;
  const name = school.name.toLowerCase();
  const loc = school.location.toLowerCase();
  if (name.includes("rutgers") || name.includes("new jersey institute")) return false;
  if (loc.includes(", nj") || loc.endsWith(" nj") || loc.includes("new jersey")) return false;
  return true;
}

export type ScoirSummaryCounts = {
  schoolCount: number;
  applying: number;
  following: number;
  usesCommonApp: number;
  noCommonApp: number;
  essayRequired: number;
  essaySome: number;
  essayOptional: number;
  essayNotRequired: number;
  essayEmpty: number;
  demonstratedInterest: number;
  bindingEarlyDecision: number;
  satMissing: number;
};

export function scoirSummaryCounts(): ScoirSummaryCounts {
  const rows = file.schools;
  return {
    schoolCount: rows.length,
    applying: rows.filter((r) => r.scoirListStatus === "Applying").length,
    following: rows.filter((r) => r.scoirListStatus === "Following").length,
    usesCommonApp: rows.filter((r) => r.usesCommonApp).length,
    noCommonApp: rows.filter((r) => !r.usesCommonApp).length,
    essayRequired: rows.filter((r) => r.essayOrStatement === "Required").length,
    essaySome: rows.filter((r) => r.essayOrStatement === "Required for some applicants").length,
    essayOptional: rows.filter((r) => r.essayOrStatement === "Optional").length,
    essayNotRequired: rows.filter((r) => r.essayOrStatement === "Not required").length,
    essayEmpty: rows.filter((r) => !r.essayOrStatement).length,
    demonstratedInterest: rows.filter((r) => r.considersDemonstratedInterest).length,
    bindingEarlyDecision: rows.filter((r) =>
      (r.fall2027EntryDeadlines ?? []).some((d) => d.binding),
    ).length,
    satMissing: rows.filter((r) => !r.satMid50).length,
  };
}

export function unmatchedScoirNames(schools: { name: string; unitId: number | null }[]): {
  missingScoir: string[];
  missingSchool: string[];
} {
  const matched = new Set<string>();
  for (const school of schools) {
    const rec = scoirRecordForSchool(school);
    if (rec) matched.add(rec.school);
  }
  return {
    missingScoir: schools
      .filter((s) => !scoirRecordForSchool(s))
      .map((s) => s.name)
      .sort(),
    missingSchool: file.schools.filter((r) => !matched.has(r.school)).map((r) => r.school),
  };
}
