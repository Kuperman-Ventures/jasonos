/**
 * College Scorecard (data.gov) helpers.
 * Docs: https://collegescorecard.ed.gov/data/api/
 */

import {
  mapScorecard,
  pickScorecardMatch,
  type FoundFacts,
  type ScorecardRow,
} from "./school-research";

export const SCORECARD_API_URL = "https://api.data.gov/ed/collegescorecard/v1/schools.json";

/** Fields we pull for auto-filling school detail records. */
export const SCORECARD_FIELDS = [
  "id",
  "school.name",
  "school.city",
  "school.state",
  "school.locale",
  "school.school_url",
  "school.ownership",
  "latest.student.size",
  "latest.admissions.admission_rate.overall",
  "latest.admissions.test_requirements",
  "latest.admissions.sat_scores.25th_percentile.critical_reading",
  "latest.admissions.sat_scores.75th_percentile.critical_reading",
  "latest.admissions.sat_scores.25th_percentile.math",
  "latest.admissions.sat_scores.75th_percentile.math",
  "latest.cost.attendance.academic_year",
  "latest.cost.tuition.in_state",
  "latest.cost.tuition.out_of_state",
  "latest.cost.roomboard.oncampus",
  "latest.cost.booksupply",
  "latest.cost.otherexpense.oncampus",
  "latest.cost.avg_net_price.public",
  "latest.cost.avg_net_price.private",
].join(",");

export type ScorecardQueryStatus = "hit" | "miss" | "failed";

export type ScorecardQueryResult = {
  status: ScorecardQueryStatus;
  match: ScorecardRow | null;
  facts: FoundFacts | null;
  /** Official Scorecard name when matched. */
  officialName: string | null;
  error?: string;
};

function scorecardApiKey(): string {
  return process.env.COLLEGE_SCORECARD_API_KEY?.trim() || "DEMO_KEY";
}

/** Strip nickname parentheses so "MIT (MIT)" / "Georgia Tech (Georgia Tech)" search cleanly. */
export function scorecardSearchName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

/** Low-level fetch: search Scorecard by school name and return raw rows. */
export async function fetchScorecardRows(name: string): Promise<ScorecardRow[]> {
  const trimmed = scorecardSearchName(name);
  if (!trimmed) return [];
  const url = new URL(SCORECARD_API_URL);
  url.searchParams.set("api_key", scorecardApiKey());
  url.searchParams.set("school.name", trimmed);
  url.searchParams.set("school.operating", "1");
  url.searchParams.set("school.main_campus", "1");
  url.searchParams.set("per_page", "20");
  url.searchParams.set("fields", SCORECARD_FIELDS);
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`College Scorecard returned ${response.status}`);
  }
  const body = (await response.json()) as { results?: ScorecardRow[] };
  return body.results ?? [];
}

/**
 * Query College Scorecard by school name and map tuition, admit rate,
 * test score ranges, net price, and related detail fields.
 */
export async function queryCollegeScorecard(name: string): Promise<ScorecardQueryResult> {
  try {
    const rows = await fetchScorecardRows(name);
    const match = pickScorecardMatch(name, rows);
    if (!match) {
      return { status: "miss", match: null, facts: null, officialName: null };
    }
    return {
      status: "hit",
      match,
      facts: mapScorecard(match),
      officialName: match["school.name"] ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "College Scorecard request failed";
    return { status: "failed", match: null, facts: null, officialName: null, error: message };
  }
}

/** Fields Scorecard can fill on a school detail record. */
export const SCORECARD_DETAIL_KEYS = [
  "location",
  "campusSize",
  "undergradEnrollment",
  "admissionsContext",
  "satContext",
  "testPolicy",
  "middle50",
  "costOfAttendance",
  "netPriceEstimate",
  "website",
] as const satisfies ReadonlyArray<keyof FoundFacts>;

export type ScorecardDetailKey = (typeof SCORECARD_DETAIL_KEYS)[number];

export function schoolNeedsScorecardFill(school: {
  location?: string;
  campusSize?: string;
  undergradEnrollment?: number | null;
  admissionsContext?: string;
  satContext?: string;
  testPolicy?: string;
  middle50?: string;
  costOfAttendance?: string;
  netPriceEstimate?: string;
  website?: string;
}): boolean {
  return (
    !school.costOfAttendance?.trim() ||
    !school.netPriceEstimate?.trim() ||
    !school.middle50?.trim() ||
    !school.satContext?.trim() ||
    !school.testPolicy?.trim() ||
    !school.campusSize?.trim() ||
    school.undergradEnrollment == null ||
    !school.website?.trim()
  );
}
