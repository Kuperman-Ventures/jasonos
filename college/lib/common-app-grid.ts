/**
 * Common App 2026–27 Requirements Grid helpers.
 * Fills application platform, essays, recs, test policy, and deadlines
 * from the published grid (blank fields only when used as backfill).
 */

import gridFile from "@/content/commonapp-grid-2026-27.json";
import {
  emptyFacts,
  scoreSchoolName,
  type DeadlineFact,
  type FoundFacts,
} from "./school-research";

export type CommonAppDeadlineKey = "ED" | "EDII" | "EA" | "EAII" | "REA" | "RD";

export type CommonAppGridRow = {
  name: string;
  platform: string;
  schoolType: string;
  deadlines: Record<CommonAppDeadlineKey, string | null>;
  feeUS: number | null;
  feeIntl: number | null;
  feeWaiver: string | null;
  requiresPersonalEssay: boolean;
  requiresCoursesAndGrades: boolean;
  portfolio: string | null;
  testPolicyCode: string;
  testPolicy: string;
  testsUsed: string;
  teacherRecs: number;
  otherRecs: number;
  midYearReport: boolean;
  counselorRec: boolean;
  source: string;
};

export type CommonAppQueryStatus = "hit" | "miss";

export type CommonAppQueryResult = {
  status: CommonAppQueryStatus;
  match: CommonAppGridRow | null;
  facts: FoundFacts | null;
  officialName: string | null;
  score: number;
};

const DEADLINE_LABELS: Record<CommonAppDeadlineKey, string> = {
  ED: "Early Decision",
  EDII: "Early Decision II",
  EA: "Early Action",
  EAII: "Early Action II",
  REA: "Restrictive Early Action",
  RD: "Regular Decision",
};

const DEADLINE_ORDER: CommonAppDeadlineKey[] = ["ED", "EDII", "EA", "EAII", "REA", "RD"];

/** Schools that do not use Common App — force a miss so we never pick a near-name. */
const NOT_ON_COMMON_APP = new Set([
  "massachusetts institute of technology",
  "mit",
  "university of california berkeley",
  "uc berkeley",
  "university of california los angeles",
  "ucla",
  "university of california davis",
  "uc davis",
  "university of california irvine",
  "uc irvine",
  "university of california san diego",
  "uc san diego",
  "ucsd",
  "university of california santa barbara",
  "uc santa barbara",
  "ucsb",
]);

/**
 * Canonical grid names for nicknames / parenthetical seed names.
 * Values must match `name` in the grid JSON exactly.
 */
const ALIASES: Record<string, string> = {
  "stanford university": "Stanford University",
  "cornell university": "Cornell University",
  "northwestern university": "Northwestern University",
  "carnegie mellon university": "Carnegie Mellon University",
  cmu: "Carnegie Mellon University",
  "university of pennsylvania": "University of Pennsylvania",
  upenn: "University of Pennsylvania",
  "johns hopkins university": "Johns Hopkins University",
  "georgia institute of technology": "Georgia Institute of Technology",
  "georgia tech": "Georgia Institute of Technology",
  "university of michigan": "University of Michigan",
  "university of michigan ann arbor": "University of Michigan",
  "university of illinois urbana champaign": "University of Illinois Urbana-Champaign",
  uiuc: "University of Illinois Urbana-Champaign",
  "university of texas at austin": "The University of Texas at Austin",
  "ut austin": "The University of Texas at Austin",
  "purdue university": "Purdue University",
  "university of maryland": "University of Maryland",
  "university of maryland college park": "University of Maryland",
  "university of washington": "University of Washington",
  "university of wisconsin": "University of Wisconsin- Madison",
  "university of wisconsin madison": "University of Wisconsin- Madison",
  "virginia polytechnic institute and state university": "Virginia Tech",
  "virginia tech": "Virginia Tech",
  "pennsylvania state university": "Penn State",
  "penn state": "Penn State",
  "ohio state university": "The Ohio State University",
  "the ohio state university": "The Ohio State University",
  "university of minnesota twin cities": "University of Minnesota Twin Cities",
  "north carolina state university": "North Carolina State University",
  "nc state": "North Carolina State University",
  "case western reserve university": "Case Western Reserve University",
  "rensselaer polytechnic institute": "Rensselaer Polytechnic Institute",
  rpi: "Rensselaer Polytechnic Institute",
  "rutgers university": "Rutgers University",
  "rutgers university new brunswick": "Rutgers University",
  "university of florida": "University of Florida",
  "texas a&m university": "Texas A&M University",
  "texas a and m university": "Texas A&M University",
  "texas a m university": "Texas A&M University",
  "texas am university": "Texas A&M University",
  "colorado school of mines": "Colorado School of Mines",
  "university of virginia": "University of Virginia",
  uva: "University of Virginia",
  "lehigh university": "Lehigh University",
  "university of connecticut": "University of Connecticut",
  uconn: "University of Connecticut",
  "university of delaware": "University of Delaware",
  "drexel university": "Drexel University",
  "iowa state university": "Iowa State University",
  "clemson university": "Clemson University",
  "university of tennessee knoxville": "The University of Tennessee Knoxville",
  "university of tennessee": "The University of Tennessee Knoxville",
  "michigan technological university": "Michigan Technological University",
  "michigan tech": "Michigan Technological University",
  "new jersey institute of technology": "New Jersey Institute of Technology",
  njit: "New Jersey Institute of Technology",
  "worcester polytechnic institute": "Worcester Polytechnic Institute",
  wpi: "Worcester Polytechnic Institute",
  "stevens institute of technology": "Stevens Institute of Technology",
  "rose hulman institute of technology": "Rose-Hulman Institute of Technology",
};

const BRANCH_TOKENS = new Set([
  "east",
  "west",
  "north",
  "south",
  "northern",
  "southern",
  "western",
  "eastern",
  "dearborn",
  "flint",
  "wise",
  "qatar",
  "bothell",
  "tacoma",
  "galveston",
  "fort",
  "wayne",
  "northwest",
  "parkside",
  "milwaukee",
  "eau",
  "claire",
  "stevens",
  "point",
  "stout",
  "whitewater",
  "arlington",
  "dallas",
  "corpus",
  "christi",
  "kunshan",
  "global",
  "worldwide",
  "regional",
]);

const gridRows = gridFile as CommonAppGridRow[];

const gridByNormalizedName = new Map<string, CommonAppGridRow>();
for (const row of gridRows) {
  gridByNormalizedName.set(normalizeName(row.name), row);
}

export function commonAppGridRows(): CommonAppGridRow[] {
  return gridRows;
}

/** Strip nickname parentheses and normalize punctuation for matching. */
export function normalizeName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/[–—]/g, "-")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactName(name: string): string {
  return normalizeName(name).replace(/[^a-z0-9]+/g, "");
}

function aliasKey(name: string): string {
  return normalizeName(name);
}

function branchPenalty(query: string, candidate: string): number {
  const wanted = new Set(normalizeName(query).split(" ").filter(Boolean));
  const have = normalizeName(candidate).split(" ").filter(Boolean);
  let penalty = 0;
  for (const token of have) {
    if (BRANCH_TOKENS.has(token) && !wanted.has(token)) penalty += 18;
  }
  // Prefer main "University of X" over "… College at …" / satellite labels.
  if (/\bcollege at\b/i.test(candidate) && !/\bcollege at\b/i.test(query)) penalty += 25;
  if (/\bat\s+\w+/i.test(candidate) && !/\bat\s+\w+/i.test(query) && /university/i.test(candidate)) {
    // e.g. Texas A&M University at Galveston
    if (!/urban|champaign|austin|arbor|brunswick|knoxville|college park/i.test(candidate)) {
      penalty += 12;
    }
  }
  return penalty;
}

export function scoreCommonAppName(query: string, candidate: string): number {
  const qNorm = normalizeName(query);
  const cNorm = normalizeName(candidate);
  const qCompact = compactName(query);
  const cCompact = compactName(candidate);
  if (!qCompact || !cCompact) return 0;

  let score = scoreSchoolName(qNorm, cNorm);

  if (qCompact === cCompact) score += 80;
  else if (cCompact.startsWith(qCompact) || qCompact.startsWith(cCompact)) {
    // Prefer near-exact length so "University of Pennsylvania" beats
    // "East Stroudsburg University of Pennsylvania".
    const lengthRatio = Math.min(qCompact.length, cCompact.length) / Math.max(qCompact.length, cCompact.length);
    score += Math.round(40 * lengthRatio);
  }

  score -= branchPenalty(query, candidate);

  // Prefer shorter official names when the compact forms nearly match.
  if (qCompact.length >= 8 && cCompact.includes(qCompact)) {
    score += Math.max(0, 20 - (cCompact.length - qCompact.length));
  }

  return score;
}

export function pickCommonAppMatch(query: string, rows: CommonAppGridRow[] = gridRows): CommonAppGridRow | null {
  const key = aliasKey(query);
  if (NOT_ON_COMMON_APP.has(key)) return null;

  const alias = ALIASES[key];
  if (alias) {
    const exact = rows.find((row) => row.name === alias) ?? gridByNormalizedName.get(normalizeName(alias));
    if (exact) return exact;
  }

  let best: CommonAppGridRow | null = null;
  let bestScore = 0;
  let second = 0;
  for (const row of rows) {
    const score = scoreCommonAppName(query, row.name);
    if (score > bestScore) {
      second = bestScore;
      bestScore = score;
      best = row;
    } else if (score > second) {
      second = score;
    }
  }

  if (!best || bestScore < 18) return null;
  // Require a clear winner when two schools are close (East Texas A&M vs Texas A&M).
  if (second > 0 && bestScore - second < 8 && compactName(query) !== compactName(best.name)) {
    return null;
  }
  return best;
}

function deadlineFacts(row: CommonAppGridRow): DeadlineFact[] {
  const facts: DeadlineFact[] = [];
  for (const key of DEADLINE_ORDER) {
    const raw = row.deadlines?.[key];
    if (raw == null || !String(raw).trim()) continue;
    const value = String(raw).trim();
    const title = DEADLINE_LABELS[key];
    if (/^rolling$/i.test(value)) {
      facts.push({ title: `${title} (Rolling)`, dueDate: null });
      continue;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      facts.push({ title, dueDate: value });
      continue;
    }
    facts.push({ title: `${title} (${value})`, dueDate: null });
  }
  return facts;
}

function essayLine(row: CommonAppGridRow): string {
  const parts: string[] = [];
  parts.push(
    row.requiresPersonalEssay
      ? "Common App personal essay required"
      : "Common App personal essay not required",
  );
  if (row.requiresCoursesAndGrades) parts.push("courses and grades required");
  if (row.portfolio?.trim()) parts.push(`portfolio: ${row.portfolio.trim()}`);
  return parts.join("; ");
}

function recsLine(row: CommonAppGridRow): string {
  const parts: string[] = [];
  const teachers = Number(row.teacherRecs) || 0;
  parts.push(teachers === 1 ? "1 teacher recommendation" : `${teachers} teacher recommendations`);
  parts.push(row.counselorRec ? "counselor recommendation required" : "counselor recommendation not required");
  const other = Number(row.otherRecs) || 0;
  if (other > 0) {
    parts.push(other === 1 ? "1 other recommendation" : `${other} other recommendations`);
  }
  if (row.midYearReport) parts.push("mid-year report required");
  return parts.join("; ");
}

function testPolicyLine(row: CommonAppGridRow): string {
  const policy = row.testPolicy?.trim() || "";
  const used = row.testsUsed?.trim() || "";
  if (policy && used && used.toLowerCase() !== "none" && used.toLowerCase() !== "see website") {
    return `${policy} (${used})`;
  }
  return policy || used;
}

function feeLine(row: CommonAppGridRow): string {
  const parts: string[] = [];
  if (typeof row.feeUS === "number" && Number.isFinite(row.feeUS)) {
    parts.push(row.feeUS === 0 ? "US application fee $0" : `US application fee $${row.feeUS}`);
  }
  if (row.feeWaiver?.trim()) parts.push(`fee waiver: ${row.feeWaiver.trim()}`);
  return parts.join("; ");
}

export function mapCommonAppRow(row: CommonAppGridRow): FoundFacts {
  const facts = emptyFacts();
  facts.applicationPlatform = row.platform?.trim() || "Common App";
  facts.requiredEssays = essayLine(row);
  facts.teacherRecs = recsLine(row);
  facts.testPolicy = testPolicyLine(row);
  facts.meritAidNotes = feeLine(row);
  facts.deadlines = deadlineFacts(row);
  facts.sources = [
    {
      title: "Common App 2026-27 Requirements Grid",
      url: "https://www.commonapp.org/",
    },
  ];
  return facts;
}

/** Query the local Common App grid by school name. */
export function queryCommonAppGrid(name: string): CommonAppQueryResult {
  const trimmed = name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return { status: "miss", match: null, facts: null, officialName: null, score: 0 };
  }
  const match = pickCommonAppMatch(trimmed);
  if (!match) {
    return { status: "miss", match: null, facts: null, officialName: null, score: 0 };
  }
  return {
    status: "hit",
    match,
    facts: mapCommonAppRow(match),
    officialName: match.name,
    score: scoreCommonAppName(trimmed, match.name),
  };
}

/** Fields the Common App grid can fill on a school detail record. */
export const COMMON_APP_DETAIL_KEYS = [
  "applicationPlatform",
  "requiredEssays",
  "teacherRecs",
  "testPolicy",
  "meritAidNotes",
] as const satisfies ReadonlyArray<keyof FoundFacts>;

export function schoolNeedsCommonAppFill(school: {
  applicationPlatform?: string;
  requiredEssays?: string;
  teacherRecs?: string;
  testPolicy?: string;
  meritAidNotes?: string;
  deadlines?: Array<{ title: string }>;
}): boolean {
  return (
    !school.applicationPlatform?.trim() ||
    !school.requiredEssays?.trim() ||
    !school.teacherRecs?.trim() ||
    !school.testPolicy?.trim() ||
    !school.meritAidNotes?.trim() ||
    !(school.deadlines && school.deadlines.length > 0)
  );
}

/** Apply Common App facts onto a plain school-like object (seed / local). */
export function applyCommonAppFactsLocal<T extends {
  id: string;
  applicationPlatform: string;
  requiredEssays: string;
  teacherRecs: string;
  testPolicy: string;
  meritAidNotes: string;
  researchSources: string;
  deadlines: Array<{ id: string; title: string; dueDate: string | null; completed: boolean; sortOrder: number }>;
}>(school: T, facts: FoundFacts): T {
  const next = { ...school };
  if (!next.applicationPlatform.trim() && facts.applicationPlatform) next.applicationPlatform = facts.applicationPlatform;
  if (!next.requiredEssays.trim() && facts.requiredEssays) next.requiredEssays = facts.requiredEssays;
  if (!next.teacherRecs.trim() && facts.teacherRecs) next.teacherRecs = facts.teacherRecs;
  if (!next.testPolicy.trim() && facts.testPolicy) next.testPolicy = facts.testPolicy;
  if (!next.meritAidNotes.trim() && facts.meritAidNotes) next.meritAidNotes = facts.meritAidNotes;
  if (!next.researchSources.trim() && facts.sources.length) {
    next.researchSources = facts.sources.map((s) => `${s.title}: ${s.url}`).join("\n");
  }
  if (!next.deadlines.length && facts.deadlines.length) {
    next.deadlines = facts.deadlines.map((deadline, index) => ({
      id: `${next.id}-ca-dl-${index}`,
      title: deadline.title,
      dueDate: deadline.dueDate,
      completed: false,
      sortOrder: index,
    }));
  }
  return next;
}
