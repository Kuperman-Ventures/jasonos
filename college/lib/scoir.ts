/**
 * Scoir import overlay (2026-09-27, revised). Match by unitId, then exact name.
 * Only fills gaps the tracker does not already cover from checked sources.
 */

import scoirFile from "@/data/scoir-import-2026-09-27.json";
import type { School } from "@/lib/types";

export type ScoirRequirementLevel =
  | "Required"
  | "Required for some applicants"
  | "Optional"
  | "Not required"
  | "";

export type ScoirHonorsCollege = "Separate application" | "By invitation" | null;

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
  essayOrStatement: ScoirRequirementLevel | null;
  interview: ScoirRequirementLevel | null;
  applicationFee: number | null;
  considersDemonstratedInterest: boolean;
  honorsCollege: ScoirHonorsCollege;
  netPriceByIncome: ScoirNetPriceByIncome | null;
  netPriceByIncomeNote: string | null;
  pctReceivingAid: number | null;
  pctFederalLoans: number | null;
  medianDebtAtGraduation: number | null;
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
export const SCOIR_SOURCE_LABEL = "Scoir";

const file = scoirFile as unknown as ScoirFile;

const byUnitId = new Map<number, ScoirRecord>();
const byName = new Map<string, ScoirRecord>();
for (const row of file.schools) {
  byUnitId.set(row.unitId, row);
  byName.set(row.school, row);
}

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

export function formatApplicationFee(fee: number | null | undefined): string {
  if (fee == null || !Number.isFinite(fee)) return "—";
  if (fee === 0) return "No fee";
  return formatScoirMoney(fee);
}

export function scoirRequirementState(
  value: ScoirRequirementLevel | null | undefined,
): { state: "req" | "mod" | "no"; note: string } | null {
  if (!value?.trim()) return null;
  if (value === "Required") return { state: "req", note: value };
  if (value === "Not required") return { state: "no", note: value };
  return { state: "mod", note: value };
}

export function honorsCollegeLine(value: ScoirHonorsCollege | undefined): string | null {
  if (value === "Separate application") return "Honors college: separate application";
  if (value === "By invitation") return "Honors college: by invitation";
  return null;
}

export type ScoirSummaryCounts = {
  schoolCount: number;
  demonstratedInterest: number;
  netPriceTable: number;
  netPriceNoteOnly: number;
  honorsSeparate: number;
  honorsInvite: number;
  honorsNone: number;
};

export function scoirSummaryCounts(): ScoirSummaryCounts {
  const rows = file.schools;
  return {
    schoolCount: rows.length,
    demonstratedInterest: rows.filter((r) => r.considersDemonstratedInterest).length,
    netPriceTable: rows.filter((r) => r.netPriceByIncome != null).length,
    netPriceNoteOnly: rows.filter((r) => r.netPriceByIncome == null).length,
    honorsSeparate: rows.filter((r) => r.honorsCollege === "Separate application").length,
    honorsInvite: rows.filter((r) => r.honorsCollege === "By invitation").length,
    honorsNone: rows.filter((r) => !r.honorsCollege).length,
  };
}
