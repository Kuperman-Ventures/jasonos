/**
 * College Scorecard fetch-by-unit-ID for the add-school flow.
 * Prefer this over lib/college-scorecard.ts for the add-by-id path.
 */

import { SCORECARD_API_URL } from "./college-scorecard";

export const SCORECARD_BY_ID_FIELDS = [
  "id",
  "school.name",
  "school.city",
  "school.state",
  "school.school_url",
  "school.ownership",
  "latest.student.size",
  "latest.admissions.sat_scores.25th_percentile.critical_reading",
  "latest.admissions.sat_scores.75th_percentile.critical_reading",
  "latest.admissions.sat_scores.25th_percentile.math",
  "latest.admissions.sat_scores.75th_percentile.math",
  "latest.cost.attendance.academic_year",
  "latest.cost.tuition.in_state",
  "latest.cost.tuition.out_of_state",
  "latest.cost.avg_net_price.public",
  "latest.cost.avg_net_price.private",
  "location.lat",
  "location.lon",
].join(",");

export type ScorecardByIdRow = {
  id: number;
  "school.name": string;
  "school.city"?: string | null;
  "school.state"?: string | null;
  "school.school_url"?: string | null;
  "school.ownership"?: number | null;
  "latest.student.size"?: number | null;
  "latest.admissions.sat_scores.25th_percentile.critical_reading"?: number | null;
  "latest.admissions.sat_scores.75th_percentile.critical_reading"?: number | null;
  "latest.admissions.sat_scores.25th_percentile.math"?: number | null;
  "latest.admissions.sat_scores.75th_percentile.math"?: number | null;
  "latest.cost.attendance.academic_year"?: number | null;
  "latest.cost.tuition.in_state"?: number | null;
  "latest.cost.tuition.out_of_state"?: number | null;
  "latest.cost.avg_net_price.public"?: number | null;
  "latest.cost.avg_net_price.private"?: number | null;
  "location.lat"?: number | null;
  "location.lon"?: number | null;
};

export type ScorecardSchool = {
  unitId: number;
  name: string;
  location: string;
  website: string;
  control: "Public" | "Private";
  undergradEnrollment: number | null;
  /** Composite SAT band, e.g. "~1370–1530". Empty when any percentile is missing. */
  sat: string;
  costOfAttendance: string;
  netPriceEstimate: string;
  lat: number | null;
  lon: number | null;
  scorecardFetchedDate: string;
};

export class ScorecardUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScorecardUnsupportedError";
  }
}

function scorecardApiKey(): string {
  return (
    process.env.COLLEGE_SCORECARD_API_KEY?.trim() ||
    process.env.SCORECARD_API_KEY?.trim() ||
    "DEMO_KEY"
  );
}

function todayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function money(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function httpsUrl(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** "~{r25+m25}–{r75+m75}" or "" if any of the four percentiles is missing. */
export function formatScorecardSat(row: ScorecardByIdRow): string {
  const r25 = finiteNumber(row["latest.admissions.sat_scores.25th_percentile.critical_reading"]);
  const r75 = finiteNumber(row["latest.admissions.sat_scores.75th_percentile.critical_reading"]);
  const m25 = finiteNumber(row["latest.admissions.sat_scores.25th_percentile.math"]);
  const m75 = finiteNumber(row["latest.admissions.sat_scores.75th_percentile.math"]);
  if (r25 == null || r75 == null || m25 == null || m75 == null) return "";
  const low = Math.round(r25 + m25);
  const high = Math.round(r75 + m75);
  return `~${low}–${high}`;
}

export function formatScorecardCost(row: ScorecardByIdRow): string {
  const attendance = finiteNumber(row["latest.cost.attendance.academic_year"]);
  const ownership = row["school.ownership"];
  const state = row["school.state"]?.trim() ?? "";
  const inState = finiteNumber(row["latest.cost.tuition.in_state"]);
  const outState = finiteNumber(row["latest.cost.tuition.out_of_state"]);

  if (attendance == null || attendance <= 0) return "";

  const isPublic = ownership === 1;
  const isNjPublic = isPublic && state === "NJ";
  const isPrivateOrNj = !isPublic || isNjPublic || state === "";

  if (isPrivateOrNj) {
    return `${money(attendance)} sticker price, latest College Scorecard`;
  }

  // Public outside NJ: out-of-state sticker = attendance − in-state + out-of-state tuition.
  if (inState == null || outState == null) {
    return `${money(attendance)} sticker price, latest College Scorecard`;
  }
  const outOfStateSticker = attendance - inState + outState;
  if (!(outOfStateSticker > 0)) {
    return `${money(attendance)} sticker price, latest College Scorecard`;
  }
  return `${money(outOfStateSticker)} out-of-state sticker price (College Scorecard cost of attendance with out-of-state tuition). In-state figure ${money(attendance)}`;
}

export function formatScorecardNetPrice(row: ScorecardByIdRow): string {
  const ownership = row["school.ownership"];
  const publicNet = finiteNumber(row["latest.cost.avg_net_price.public"]);
  const privateNet = finiteNumber(row["latest.cost.avg_net_price.private"]);
  if (ownership === 1) {
    if (publicNet == null || publicNet <= 0) return "";
    return `${money(publicNet)} average net price for in-state students receiving federal aid (College Scorecard)`;
  }
  if (privateNet == null || privateNet <= 0) return "";
  return `${money(privateNet)} average net price for students receiving federal aid (College Scorecard)`;
}

export function mapScorecardByIdRow(
  row: ScorecardByIdRow,
  fetchedDate = todayIsoDate(),
): ScorecardSchool {
  const ownership = row["school.ownership"];
  if (ownership === 3) {
    throw new ScorecardUnsupportedError("For-profit schools are not supported");
  }
  if (ownership !== 1 && ownership !== 2) {
    throw new ScorecardUnsupportedError("School ownership is missing or unsupported");
  }

  const city = row["school.city"]?.trim() ?? "";
  const state = row["school.state"]?.trim() ?? "";
  const undergrads = finiteNumber(row["latest.student.size"]);
  const lat = finiteNumber(row["location.lat"]);
  const lon = finiteNumber(row["location.lon"]);

  return {
    unitId: row.id,
    name: row["school.name"]?.trim() ?? "",
    location: [city, state].filter(Boolean).join(", "),
    website: httpsUrl(row["school.school_url"]),
    control: ownership === 1 ? "Public" : "Private",
    undergradEnrollment:
      undergrads != null && undergrads >= 0 ? Math.round(undergrads) : null,
    sat: formatScorecardSat(row),
    costOfAttendance: formatScorecardCost(row),
    netPriceEstimate: formatScorecardNetPrice(row),
    lat,
    lon,
    scorecardFetchedDate: fetchedDate,
  };
}

/** Fetch one operating school by College Scorecard / IPEDS unit ID. */
export async function fetchScorecardByUnitId(unitId: number): Promise<ScorecardSchool> {
  if (!Number.isFinite(unitId) || unitId <= 0) {
    throw new Error("unitId must be a positive number");
  }

  const url = new URL(SCORECARD_API_URL);
  url.searchParams.set("api_key", scorecardApiKey());
  url.searchParams.set("id", String(Math.round(unitId)));
  url.searchParams.set("school.operating", "1");
  url.searchParams.set("per_page", "1");
  url.searchParams.set("fields", SCORECARD_BY_ID_FIELDS);

  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) {
    throw new Error(`College Scorecard returned ${response.status}`);
  }
  const body = (await response.json()) as { results?: ScorecardByIdRow[] };
  const row = body.results?.[0];
  if (!row) {
    throw new Error(`No College Scorecard school found for unitId ${unitId}`);
  }
  return mapScorecardByIdRow(row);
}

export const SCORECARD_SEARCH_FIELDS = ["id", "school.name", "school.city", "school.state"].join(",");

export type ScorecardSearchHit = {
  id: number;
  name: string;
  city: string;
  state: string;
};

/**
 * Search operating bachelor's-predominant schools by name.
 * Strips commas — Scorecard 500s when school.name contains them.
 */
export async function searchScorecardSchools(
  query: string,
  limit = 10,
): Promise<ScorecardSearchHit[]> {
  const trimmed = query.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (!trimmed) return [];

  const url = new URL(SCORECARD_API_URL);
  url.searchParams.set("api_key", scorecardApiKey());
  url.searchParams.set("school.name", trimmed);
  url.searchParams.set("school.operating", "1");
  url.searchParams.set("school.degrees_awarded.predominant", "3");
  url.searchParams.set("per_page", String(Math.min(Math.max(1, Math.round(limit)), 20)));
  url.searchParams.set("fields", SCORECARD_SEARCH_FIELDS);

  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) {
    throw new Error(`College Scorecard returned ${response.status}`);
  }
  const body = (await response.json()) as {
    results?: Array<{
      id?: number;
      "school.name"?: string;
      "school.city"?: string | null;
      "school.state"?: string | null;
    }>;
  };

  const hits: ScorecardSearchHit[] = [];
  for (const row of body.results ?? []) {
    if (typeof row.id !== "number" || !Number.isFinite(row.id)) continue;
    const name = row["school.name"]?.trim() ?? "";
    if (!name) continue;
    hits.push({
      id: Math.round(row.id),
      name,
      city: row["school.city"]?.trim() ?? "",
      state: row["school.state"]?.trim() ?? "",
    });
    if (hits.length >= limit) break;
  }
  return hits;
}
