/**
 * College Scorecard fetch-by-unit-ID for the add-school flow.
 * Prefer this over lib/college-scorecard.ts for the add-by-id path.
 */

import type { ProgramOption } from "./additional-programs";
import {
  SCORECARD_API_URL,
  resolveScorecardApiKey,
  isScorecardKeyInvalidError,
  scorecardKeyInvalidMessage,
} from "./college-scorecard";

/** CIP codes dropped because they match the three core snapshot programs (or materials). */
const EXCLUDED_ENGINEERING_CIPS = new Set(["1402", "1406", "1418", "1419", "1420"]);

/** Bachelor's CIP-4 codes that map onto Snapshot Yes/No program offers. */
const CORE_CIP = {
  mechanical: new Set(["1419"]),
  materials: new Set(["1406", "1418", "1420"]),
  aerospace: new Set(["1402"]),
} as const;

const CIP_CATEGORY: Record<string, string> = {
  "1401": "General Engineering",
  "1403": "Biological and Agricultural Engineering",
  "1404": "Architectural Engineering",
  "1405": "Biomedical Engineering",
  "1407": "Chemical Engineering",
  "1408": "Civil Engineering",
  "1409": "Computer Engineering",
  "1410": "Electrical Engineering",
  "1411": "Engineering Mechanics",
  "1412": "Engineering Physics",
  "1413": "Engineering Science",
  "1414": "Environmental Engineering",
  "1421": "Mining Engineering",
  "1422": "Ocean and Naval Engineering",
  "1423": "Nuclear Engineering",
  "1424": "Ocean and Naval Engineering",
  "1425": "Petroleum Engineering",
  "1427": "Industrial and Systems Engineering",
  "1433": "Construction Engineering",
  "1435": "Industrial and Systems Engineering",
  "1436": "Manufacturing Engineering",
  "1437": "Operations Research and Engineering",
  "1439": "Geological Engineering",
  "1441": "Mechatronics Engineering",
  "1442": "Robotics Engineering",
  "1443": "Biomolecular and Bioprocess Engineering",
  "1445": "Biological and Agricultural Engineering",
  "1447": "Electrical and Computer Engineering",
};

export type ScorecardCipRow = {
  code?: string | null;
  title?: string | null;
  credential?: { level?: number | null } | null;
};

function bachelorEngineeringCipCodes(rows: unknown): Set<string> {
  const codes = new Set<string>();
  if (!Array.isArray(rows)) return codes;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as ScorecardCipRow;
    const codeRaw = typeof item.code === "string" ? item.code.trim() : "";
    const code = codeRaw.padStart(4, "0").slice(-4);
    if (!/^\d{4}$/.test(code) || !code.startsWith("14")) continue;
    if (item.credential?.level !== 3) continue;
    codes.add(code);
  }
  return codes;
}

export type ScorecardCoreProgramOffers = {
  mechanicalEngineering: string;
  materials: string;
  aerospaceEngineering: string;
};

/**
 * Map Scorecard bachelor's CIP rows onto the three Snapshot program Yes/No fields.
 * Blank means Scorecard did not list that CIP (still "Undetermined" until web lookup or manual set).
 */
export function scorecardCoreProgramOffers(rows: unknown): ScorecardCoreProgramOffers {
  const codes = bachelorEngineeringCipCodes(rows);
  const has = (wanted: ReadonlySet<string>) => [...wanted].some((code) => codes.has(code));
  return {
    mechanicalEngineering: has(CORE_CIP.mechanical) ? "Yes" : "",
    materials: has(CORE_CIP.materials) ? "Yes" : "",
    aerospaceEngineering: has(CORE_CIP.aerospace) ? "Yes" : "",
  };
}

/** Map Scorecard CIP-4 rows to engineering ProgramOption entries. */
export function scorecardProgramsToOptions(
  schoolId: string,
  unitId: number,
  rows: unknown,
): ProgramOption[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const out: ProgramOption[] = [];
  const sourceUrl = `https://collegescorecard.ed.gov/school/?${Math.round(unitId)}`;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as ScorecardCipRow;
    const codeRaw = typeof item.code === "string" ? item.code.trim() : "";
    const code = codeRaw.padStart(4, "0").slice(-4);
    if (!/^\d{4}$/.test(code) || !code.startsWith("14")) continue;
    const level = item.credential?.level;
    if (level !== 3) continue;
    if (EXCLUDED_ENGINEERING_CIPS.has(code)) continue;
    if (seen.has(code)) continue;
    seen.add(code);

    const title = typeof item.title === "string" ? item.title.trim() : "";
    if (!title) continue;
    const name = title.replace(/\.+$/, "");
    out.push({
      id: `${schoolId}--cip-${code}`,
      name,
      category: CIP_CATEGORY[code] ?? "Other",
      sourceUrl,
      notes: "",
      source: "scorecard",
    });
  }
  return out;
}

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

async function fetchScorecardResponse(url: URL): Promise<Response> {
  const resolved = resolveScorecardApiKey();
  url.searchParams.set("api_key", resolved.key);
  let response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (
    !response.ok &&
    resolved.mode === "live" &&
    isScorecardKeyInvalidError(await response.clone().text().catch(() => String(response.status)))
  ) {
    url.searchParams.set("api_key", "DEMO_KEY");
    response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (isScorecardKeyInvalidError(text)) throw new Error(scorecardKeyInvalidMessage());
    throw new Error(`College Scorecard returned ${response.status}`);
  }
  return response;
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

async function fetchScorecardCipRows(unitId: number): Promise<unknown> {
  const url = new URL(SCORECARD_API_URL);
  url.searchParams.set("id", String(Math.round(unitId)));
  url.searchParams.set("per_page", "1");
  url.searchParams.set("fields", "id,latest.programs.cip_4_digit");

  const response = await fetchScorecardResponse(url);
  const body = (await response.json()) as {
    results?: Array<{ "latest.programs.cip_4_digit"?: unknown }>;
  };
  return body.results?.[0]?.["latest.programs.cip_4_digit"];
}

/** Bachelor's engineering CIP programs from College Scorecard for one school. */
export async function fetchScorecardEngineeringPrograms(
  unitId: number,
  schoolId: string,
): Promise<ProgramOption[]> {
  const bundle = await fetchScorecardEngineeringBundle(unitId, schoolId);
  return bundle.options;
}

/** Additional programs list plus Snapshot ME / materials / aerospace Yes offers from one CIP fetch. */
export async function fetchScorecardEngineeringBundle(
  unitId: number,
  schoolId: string,
): Promise<{ options: ProgramOption[]; coreOffers: ScorecardCoreProgramOffers }> {
  if (!Number.isFinite(unitId) || unitId <= 0) {
    throw new Error("unitId must be a positive number");
  }
  const id = schoolId.trim();
  if (!id) throw new Error("schoolId is required");

  const rounded = Math.round(unitId);
  const rows = await fetchScorecardCipRows(rounded);
  return {
    options: scorecardProgramsToOptions(id, rounded, rows),
    coreOffers: scorecardCoreProgramOffers(rows),
  };
}

/** Fetch one operating school by College Scorecard / IPEDS unit ID. */
export async function fetchScorecardByUnitId(unitId: number): Promise<ScorecardSchool> {
  if (!Number.isFinite(unitId) || unitId <= 0) {
    throw new Error("unitId must be a positive number");
  }

  const url = new URL(SCORECARD_API_URL);
  url.searchParams.set("id", String(Math.round(unitId)));
  url.searchParams.set("school.operating", "1");
  url.searchParams.set("per_page", "1");
  url.searchParams.set("fields", SCORECARD_BY_ID_FIELDS);

  const response = await fetchScorecardResponse(url);
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
  url.searchParams.set("school.name", trimmed);
  url.searchParams.set("school.operating", "1");
  url.searchParams.set("school.degrees_awarded.predominant", "3");
  url.searchParams.set("per_page", String(Math.min(Math.max(1, Math.round(limit)), 20)));
  url.searchParams.set("fields", SCORECARD_SEARCH_FIELDS);

  const response = await fetchScorecardResponse(url);
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
