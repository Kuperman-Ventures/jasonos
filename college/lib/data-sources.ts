/**
 * Data Sources registry for Reference › Data Sources.
 *
 * Feature → screens it covers (the chips on the page):
 *   schools       Colleges list, school modal (Snapshot, Photos, Requirements header, Project
 *                 Management), Add school lookup
 *   finances      Finances page, school Financials tab, Family finances modal
 *   applications  Apps & Materials, school Requirements tab, application deadlines
 *   trip          School Trip planning (Nearby, When to go, Itinerary, Climate, All schools),
 *                 Visit planning routes
 *   ingest        Ingest panel, Notes (link previews, pasted images / PDFs, AI extraction)
 *   calendar      Timeline / calendar, deadline dates, the webcal feed
 *
 * Source types:
 *   platform  Everything runs on these (database, auth, AI, hosting).
 *   live      Called while someone uses the app.
 *   snapshot  Imported files checked into the repo, dated.
 *   linkout   The app only links to the source site.
 *   outbound  Data the app sends out.
 */

import {
  COMMON_APP_GRID_CYCLE_START,
  KYLE_APPLICATION_CYCLE_START,
  queryCommonAppGrid,
} from "@/lib/common-app-grid";
import { driveLeg, schoolTravelPointId } from "@/lib/drive-matrix";
import { financeRecordForSchoolName } from "@/lib/finances";
import {
  catalogEntryForSchool,
  virtualTourEmbedUrlForSchool,
  virtualTourUrlForSchool,
  visitAddressForSchool,
} from "@/lib/school-photos";
import { scoirRecordForSchool, scoirSchoolCount } from "@/lib/scoir";
import { campusCalendarForSchoolName } from "@/lib/trip-planning/campus-calendars";
import type { School } from "@/lib/types";
import residencyImport from "@/content/residency-admit-import.json";

export type Feature = "schools" | "finances" | "applications" | "trip" | "ingest" | "calendar";
export type SourceType = "platform" | "live" | "snapshot" | "linkout" | "outbound";
export type Status = "ok" | "stale" | "failing" | "untested" | "no_date";
export type ApiKeyStatus = "set" | "missing" | "not_needed";

export type SourceLink = { label: string; url?: string | null };
export type SourceHistory = { date: string; note: string };
export type SourceCoverage = { have: number; total: number; label?: string; missing?: string[] };
export type BrokenOrBlockedLink = {
  schoolId?: string;
  schoolName?: string;
  url: string;
  status?: number | null;
};

export type DataSourceCheckState = {
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  lastMs: number | null;
  brokenLinks: BrokenOrBlockedLink[];
  blockedLinks: BrokenOrBlockedLink[];
};

export type DataSourceSetting = {
  label: string;
  options: string[];
  value: string;
  optionLabels?: Record<string, string>;
};

export type DataSource = {
  id: string;
  type: SourceType;
  name: string;
  subtitle?: string | null;
  feeds: Feature[];
  provider?: string | null;
  docsUrl?: string | null;
  notes?: string | null;
  apiKey: ApiKeyStatus;
  testable: boolean;
  importedAt?: string | null;
  dataCovers?: string | null;
  sourceLinks?: SourceLink[];
  staleAfter?: string | null;
  staleAfterDate?: string | null;
  howToUpdate?: string | null;
  history?: SourceHistory[];
  perSchool?: boolean;
  coverage?: SourceCoverage | null;
  status: Status;
  statusLabel: string;
  lastCheckedAt?: string | null;
  lastSuccessAt?: string | null;
  lastErrorAt?: string | null;
  lastErrorMessage?: string | null;
  lastMs?: number | null;
  brokenLinks?: BrokenOrBlockedLink[];
  blockedLinks?: BrokenOrBlockedLink[];
  setting?: DataSourceSetting | null;
  overrideAllowed?: boolean;
  tokenStatus?: "set" | "missing" | null;
};

/** Env vars that decide `apiKey`. Omit for sources that never use a key. */
export type DataSourceEnv = { keys?: string[]; anyOf?: boolean; notNeeded?: boolean };

export type DataSourceDef = Omit<
  DataSource,
  | "status"
  | "statusLabel"
  | "coverage"
  | "apiKey"
  | "lastCheckedAt"
  | "lastSuccessAt"
  | "lastErrorAt"
  | "lastErrorMessage"
  | "lastMs"
  | "brokenLinks"
  | "blockedLinks"
  | "setting"
  | "tokenStatus"
> & { env?: DataSourceEnv };

export const FEATURES: { id: Feature; name: string }[] = [
  { id: "schools", name: "Schools" },
  { id: "finances", name: "Finances" },
  { id: "applications", name: "Applications" },
  { id: "trip", name: "Trip" },
  { id: "ingest", name: "Ingest" },
  { id: "calendar", name: "Calendar" },
];

export const FEATURE_LABELS: Record<Feature, string> = {
  schools: "Schools",
  finances: "Finances",
  applications: "Applications",
  trip: "Trip",
  ingest: "Ingest",
  calendar: "Calendar",
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  platform: "Platform",
  live: "Live API",
  snapshot: "Snapshot",
  linkout: "Link-out",
  outbound: "Outbound",
};

export const STATUS_LABELS: Record<Status, string> = {
  ok: "Working",
  stale: "Stale",
  failing: "Failing",
  untested: "Untested",
  no_date: "No date",
};

/** A live check older than this counts as untested. */
export const CHECK_MAX_AGE_DAYS = 7;

const ALL_FEATURES: Feature[] = FEATURES.map((f) => f.id);

const SCOIR_IMPORTED_AT = "2026-09-27";

/** Snapshots that go stale when a school on the list has no row, regardless of date. */
const STALE_WHEN_INCOMPLETE = new Set(["drive-matrix"]);

const GOOGLE_MAPS = "Google Maps Platform";
const GATEWAY_ENV: DataSourceEnv = {
  keys: ["AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN", "VERCEL", "ANTHROPIC_API_KEY"],
  anyOf: true,
};

export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function cycleLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

// History rows must be added by hand when a snapshot is re-imported.
export const SOURCE_REGISTRY: DataSourceDef[] = [
  {
    id: "supabase",
    type: "platform",
    name: "Supabase",
    subtitle: "data, files",
    feeds: ALL_FEATURES,
    provider: "Supabase",
    docsUrl: "https://supabase.com/docs",
    env: { keys: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] },
    testable: true,
  },
  {
    id: "google-signin",
    type: "platform",
    name: "Google sign-in",
    subtitle: "through Supabase Auth",
    feeds: ALL_FEATURES,
    provider: "Google Identity",
    docsUrl: "https://supabase.com/docs/guides/auth/social-login/auth-google",
    env: { keys: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] },
    testable: true,
  },
  {
    id: "ai-gateway",
    type: "platform",
    name: "Vercel AI Gateway",
    subtitle: "ingest extraction, school lookup",
    feeds: ["ingest", "schools"],
    provider: "Vercel",
    docsUrl: "https://vercel.com/docs/ai-gateway",
    env: GATEWAY_ENV,
    testable: true,
  },
  {
    id: "vercel-hosting",
    type: "platform",
    name: "Vercel hosting",
    feeds: ALL_FEATURES,
    provider: "Vercel",
    docsUrl: "https://vercel.com/docs",
    testable: true,
  },

  {
    id: "college-scorecard",
    type: "live",
    name: "College Scorecard",
    feeds: ["schools"],
    provider: "U.S. Department of Education",
    docsUrl: "https://collegescorecard.ed.gov/data/documentation/",
    notes: "Without a key the app falls back to DEMO_KEY, which is rate-limited. Treat missing key as failing.",
    env: { keys: ["COLLEGE_SCORECARD_API_KEY", "SCORECARD_API_KEY"], anyOf: true },
    testable: true,
    perSchool: true,
  },
  {
    id: "google-routes",
    type: "live",
    name: "Google Routes",
    subtitle: "drive legs for added schools",
    feeds: ["schools", "trip"],
    provider: GOOGLE_MAPS,
    docsUrl: "https://developers.google.com/maps/documentation/routes",
    notes: "Each test is one billed Routes call.",
    env: { keys: ["GOOGLE_MAPS_API_KEY"] },
    testable: true,
  },
  {
    id: "google-maps",
    type: "live",
    name: "Google Maps",
    subtitle: "Maps JavaScript key",
    feeds: ["schools"],
    provider: GOOGLE_MAPS,
    docsUrl: "https://developers.google.com/maps/documentation/javascript",
    env: { keys: ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "GOOGLE_MAPS_API_KEY"], anyOf: true },
    testable: true,
  },
  {
    id: "google-static-maps",
    type: "live",
    name: "Google Static Maps",
    subtitle: "campus satellite image",
    feeds: ["schools"],
    provider: GOOGLE_MAPS,
    docsUrl: "https://developers.google.com/maps/documentation/maps-static",
    env: { keys: ["GOOGLE_MAPS_API_KEY"] },
    testable: true,
  },
  {
    id: "perplexity",
    type: "live",
    name: "Perplexity lookup",
    subtitle: "through AI Gateway",
    feeds: ["schools"],
    provider: "Perplexity",
    docsUrl: "https://docs.perplexity.ai",
    notes:
      "Runs as an AI Gateway tool (gateway.tools.perplexitySearch). No key of its own and no Test connection — every call is billed. Status comes from recorded real calls.",
    env: { notNeeded: true },
    testable: false,
  },
  {
    id: "open-meteo",
    type: "live",
    name: "Open-Meteo geocoder",
    feeds: ["trip", "schools"],
    provider: "Open-Meteo",
    docsUrl: "https://open-meteo.com/en/docs/geocoding-api",
    testable: true,
  },
  {
    id: "census-geocoder",
    type: "live",
    name: "Census geocoder",
    subtitle: "metro area for added schools",
    feeds: ["schools"],
    provider: "U.S. Census Bureau",
    docsUrl: "https://geocoding.geo.census.gov/geocoder/",
    testable: true,
  },
  {
    id: "wikipedia",
    type: "live",
    name: "Wikipedia",
    subtitle: "school lead photo",
    feeds: ["schools"],
    provider: "Wikimedia Foundation",
    docsUrl: "https://www.mediawiki.org/wiki/API:Main_page",
    testable: true,
  },
  {
    id: "link-preview",
    type: "live",
    name: "Link preview fetcher",
    feeds: ["ingest", "calendar"],
    provider: "App server function",
    testable: true,
  },
  {
    id: "ocr",
    type: "live",
    name: "OCR (Tesseract)",
    subtitle: "runs in the browser",
    feeds: ["ingest"],
    provider: "Tesseract.js",
    docsUrl: "https://tesseract.projectnaptha.com",
    notes: "Tesseract downloads eng language data from jsDelivr at runtime.",
    testable: true,
  },
  {
    id: "map-tiles",
    type: "live",
    name: "Map tiles (Esri, OSM)",
    feeds: ["schools", "trip"],
    provider: "Esri, OpenStreetMap",
    docsUrl: "https://operations.osmfoundation.org/policies/tiles/",
    testable: true,
  },
  {
    id: "tour-embeds",
    type: "live",
    name: "Tour embeds",
    subtitle: "in-page virtual tours",
    feeds: ["schools"],
    provider: "YouVisit, CampusReel and school tour hosts",
    testable: true,
    perSchool: true,
  },
  {
    id: "helpers",
    type: "live",
    name: "Favicons, map shapes",
    feeds: ["schools", "trip"],
    provider: "Google favicon service, world-atlas on jsDelivr",
    testable: false,
  },

  {
    id: "scoir",
    type: "snapshot",
    name: "Scoir",
    feeds: ["schools", "applications", "finances"],
    importedAt: SCOIR_IMPORTED_AT,
    dataCovers: `${scoirSchoolCount()} schools from Kyle's Scoir list`,
    sourceLinks: [{ label: "Scoir", url: "https://app.scoir.com" }],
    staleAfter: "180 days after import, or when Kyle adds a school in Scoir",
    staleAfterDate: addDaysIso(SCOIR_IMPORTED_AT, 180),
    howToUpdate:
      "Re-export Kyle's Scoir data, save it as data/scoir-import-YYYY-MM-DD.json, point lib/scoir.ts " +
      "at the new file, and add a Supabase migration (like 0033_scoir_import_fill.sql) to fill blank fields.",
    history: [
      { date: "2026-09-27", note: "Revised import to fill existing tabs only" },
      { date: "2026-09-27", note: "First import: application, admit, cost and student-body data" },
    ],
    perSchool: true,
    testable: false,
  },
  {
    id: "common-app-grid",
    type: "snapshot",
    name: "Common App grid",
    feeds: ["applications", "schools"],
    importedAt: "2026-09-24",
    dataCovers:
      `${cycleLabel(COMMON_APP_GRID_CYCLE_START)} grid. Deadlines shifted forward 1 year to Kyle's ` +
      `${cycleLabel(KYLE_APPLICATION_CYCLE_START)} cycle, so they are estimates.`,
    sourceLinks: [
      {
        label: "Common App requirements grid",
        url: "https://www.commonapp.org/counselors-and-recommenders/requirements-grid",
      },
    ],
    staleAfter: "When the 2027-28 Common App grid is published",
    staleAfterDate: "2027-08-01",
    howToUpdate:
      "Download the new grid, replace content/commonapp-grid-YYYY-YY.json, and bump " +
      "COMMON_APP_GRID_CYCLE_START and KYLE_APPLICATION_CYCLE_START in lib/common-app-grid.ts.",
    history: [{ date: "2026-09-24", note: "2026-27 grid fills blank school fields" }],
    perSchool: true,
    testable: false,
  },
  {
    id: "cds-residency",
    type: "snapshot",
    name: "CDS / IR / UC data",
    subtitle: "public schools",
    feeds: ["schools"],
    importedAt: "2026-09-26",
    dataCovers: "In-state and out-of-state admit rates from each school's CDS or IR office",
    staleAfter: "No expiry",
    staleAfterDate: null,
    howToUpdate:
      "Update content/residency-admit-import.json and add a migration like 0024_residency_admit_rates.sql.",
    history: [
      { date: "2026-09-28", note: "Rows adjusted for the Finances admit/cost scatter" },
      { date: "2026-09-26", note: "Residency admit rates for public schools" },
    ],
    perSchool: true,
    testable: false,
  },
  {
    id: "finances-catalog",
    type: "snapshot",
    name: "Finances catalog",
    feeds: ["finances"],
    importedAt: "2026-09-26",
    dataCovers: "Cost of attendance 2026-27; CDS years 2024-25 to 2025-26",
    staleAfter: "Schools post 2027-28 cost of attendance",
    staleAfterDate: "2027-07-01",
    howToUpdate: "Edit data/finances.json (costs, merit, need programs, NPC links) and bump preparedDate.",
    history: [
      { date: "2026-09-28", note: "Family finances fields" },
      { date: "2026-09-27", note: "Residency reclassification guide" },
      { date: "2026-09-26", note: "2026-27 costs, merit, need programs" },
    ],
    perSchool: true,
    testable: false,
  },
  {
    id: "bea-rpp",
    type: "snapshot",
    name: "BEA price parities",
    feeds: ["finances"],
    importedAt: "2026-09-26",
    dataCovers: "2024 regional price parities by metro area",
    sourceLinks: [
      {
        label: "BEA regional price parities",
        url: "https://www.bea.gov/data/prices-inflation/regional-price-parities-state-and-metro-area",
      },
    ],
    staleAfter: "BEA releases 2025 parities (December 2026)",
    staleAfterDate: "2026-12-31",
    howToUpdate:
      "Download MARPP from BEA and update costOfLiving plus each school's costOfLivingIndex and " +
      "housingCostIndex in data/finances.json.",
    history: [{ date: "2026-09-26", note: "2024 parities" }],
    perSchool: false,
    testable: false,
  },
  {
    id: "noaa-climate",
    type: "snapshot",
    name: "NOAA climate normals",
    feeds: ["trip"],
    importedAt: "2026-09-26",
    dataCovers: "1991-2020 climate normals",
    sourceLinks: [
      {
        label: "NOAA U.S. Climate Normals",
        url: "https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals",
      },
    ],
    staleAfter: "NOAA publishes 2001-2030 normals",
    staleAfterDate: null,
    howToUpdate: "Edit the city anchors in lib/trip-planning/climate.ts.",
    history: [
      { date: "2026-09-27", note: "Real city normals for the Climate tab" },
      { date: "2026-09-26", note: "First climate normals" },
    ],
    perSchool: false,
    testable: false,
  },
  {
    id: "campus-calendars",
    type: "snapshot",
    name: "Campus calendars",
    feeds: ["trip"],
    importedAt: "2026-09-27",
    dataCovers: "2026-27 academic year",
    staleAfter: "Schools post 2027-28 calendars",
    staleAfterDate: "2027-06-30",
    howToUpdate: "Replace data/campus-calendars.json with each school's official calendar.",
    history: [{ date: "2026-09-27", note: "Official 2026-27 calendars replace stubs" }],
    perSchool: true,
    testable: false,
  },
  {
    id: "chs-schedule",
    type: "snapshot",
    name: "CHS / SOMSD schedule",
    feeds: ["trip"],
    importedAt: "2026-09-26",
    dataCovers: "2026-27 school year",
    sourceLinks: [{ label: "South Orange & Maplewood School District", url: "https://www.somsd.k12.nj.us" }],
    staleAfter: "District posts the 2027-28 calendar",
    staleAfterDate: "2027-06-30",
    howToUpdate: "Update CHS_SCHEDULE in lib/trip-planning/chs-schedule.ts from the district PDF.",
    history: [
      { date: "2026-09-27", note: "Corrected years to 2026-27" },
      { date: "2026-09-26", note: "First import from the CHS schedule PDF" },
    ],
    perSchool: false,
    testable: false,
  },
  {
    id: "wikimedia-photos",
    type: "snapshot",
    name: "Wikimedia photo catalog",
    feeds: ["schools"],
    importedAt: "2026-09-27",
    dataCovers: "Campus photos, Creative Commons licensed",
    sourceLinks: [{ label: "Wikimedia Commons", url: "https://commons.wikimedia.org" }],
    staleAfter: "A school is added to the list",
    staleAfterDate: null,
    howToUpdate: "Edit data/school-photos.json.",
    history: [{ date: "2026-09-27", note: "Full catalog for all 43 schools" }],
    perSchool: true,
    testable: false,
  },
  {
    id: "drive-matrix",
    type: "snapshot",
    name: "Drive-time matrix",
    feeds: ["trip", "schools"],
    importedAt: "2026-09-27",
    dataCovers: "Drive legs from Maplewood, NJ to each school and airport",
    sourceLinks: [{ label: "Google Routes API", url: "https://developers.google.com/maps/documentation/routes" }],
    staleAfter: "A school on the list has no home drive leg",
    staleAfterDate: null,
    howToUpdate:
      "Run node scripts/compute-drive-matrix.mjs (needs GOOGLE_MAPS_API_KEY). Schools added in the app " +
      "get legs from Google Routes in college.drive_pairs_extra.",
    history: [{ date: "2026-09-27", note: "Google Routes pull from Maplewood, NJ" }],
    perSchool: true,
    testable: false,
  },
  {
    id: "metro-populations",
    type: "snapshot",
    name: "Metro populations",
    feeds: ["schools"],
    importedAt: "2026-09-27",
    dataCovers: "Census CBSA population estimates, 2025 vintage",
    sourceLinks: [
      { label: "Census metro area estimates", url: "https://www.census.gov/programs-surveys/popest.html" },
    ],
    staleAfter: "Census releases new estimates (yearly)",
    staleAfterDate: null,
    howToUpdate: "Run node scripts/build-metro-populations.mjs.",
    history: [{ date: "2026-09-27", note: "Census CBSA 2025 estimates" }],
    perSchool: true,
    testable: false,
  },
  {
    id: "travel-reference",
    type: "snapshot",
    name: "Regions, travel points, airports",
    feeds: ["trip"],
    importedAt: "2026-09-26",
    dataCovers: "State regions, home, school and airport travel points, visit airports",
    staleAfter: "A school is added outside the current regions",
    staleAfterDate: null,
    howToUpdate:
      "Edit data/state-regions.json, data/travel-points.json and US_VISIT_AIRPORTS in " +
      "lib/visit-airports.ts, then re-run scripts/compute-drive-matrix.mjs.",
    history: [
      { date: "2026-09-27", note: "State regions and travel points" },
      { date: "2026-09-26", note: "Visit airports" },
    ],
    perSchool: false,
    testable: false,
  },

  {
    id: "npc",
    type: "linkout",
    name: "Net Price Calculators",
    feeds: ["finances"],
    notes: "Per-school netPriceCalculatorUrl in data/finances.json.",
    testable: true,
    perSchool: true,
    overrideAllowed: true,
  },
  {
    id: "nj-aid",
    type: "linkout",
    name: "NJ HESAA and aid pages",
    feeds: ["finances"],
    provider: "NJ Higher Education Student Assistance Authority",
    docsUrl: "https://www.hesaa.org",
    notes: "NJ state program links in data/finances.json.",
    testable: true,
    perSchool: false,
  },
  {
    id: "virtual-tours",
    type: "linkout",
    name: "Virtual tours (no embed)",
    feeds: ["schools"],
    notes: "Per-school virtualTourUrl in data/school-photos.json when the tour cannot be embedded.",
    testable: true,
    perSchool: true,
    overrideAllowed: true,
  },
  {
    id: "apple-maps",
    type: "linkout",
    name: "Apple Maps directions",
    feeds: ["trip"],
    provider: "Apple",
    docsUrl: "https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html",
    notes: "Built from the school's visit address: maps.apple.com/directions?destination=…",
    testable: false,
    perSchool: true,
  },

  {
    id: "calendar-feed",
    type: "outbound",
    name: "Calendar feed",
    subtitle: "webcal / .ics",
    feeds: ["calendar"],
    notes: "Application deadlines, campus visits, test dates and To-Do due dates.",
    testable: true,
  },
];

function readEnv(key: string): string {
  if (typeof process === "undefined" || !process.env) return "";
  return process.env[key]?.trim() ?? "";
}

export function envKeyStatus(
  keys: string[],
  opts: { anyOf?: boolean; notNeeded?: boolean } = {},
): ApiKeyStatus {
  if (opts.notNeeded || keys.length === 0) return "not_needed";
  const present = keys.map((key) => readEnv(key) !== "");
  const ok = opts.anyOf ? present.some(Boolean) : present.every(Boolean);
  return ok ? "set" : "missing";
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

function isoDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Last error is newer than the last success (or there has never been a success). */
function errorIsCurrent(check: DataSourceCheckState): boolean {
  const err = parseTime(check.lastErrorAt);
  if (err == null) return false;
  const ok = parseTime(check.lastSuccessAt);
  return ok == null || err > ok;
}

function checkIsOld(check: DataSourceCheckState, now: Date): boolean {
  const checked = parseTime(check.lastCheckedAt);
  if (checked == null) return true;
  return now.getTime() - checked > CHECK_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Status rules (server decides; UI only renders):
 *
 * snapshot
 *   importedAt null                  → no_date
 *   past staleAfterDate              → stale
 *   drive-matrix coverage incomplete → stale
 *   otherwise                        → ok
 *
 * live / platform
 *   apiKey missing                   → failing "Key missing"
 *   last recorded call/test failed   → failing
 *   no recorded call or test         → untested
 *   otherwise                        → ok
 *
 * link-out
 *   broken links found               → stale "Broken link"
 *   never checked                    → untested
 *   otherwise                        → ok
 *
 * outbound
 *   no feed token                    → failing "No token"
 *   never checked                    → untested
 *   otherwise                        → ok
 */
export function computeStatus(
  source: Omit<DataSource, "status" | "statusLabel"> &
    Partial<Pick<DataSource, "status" | "statusLabel">>,
  check: DataSourceCheckState | null,
  now: Date,
): { status: Status; statusLabel: string } {
  const result = (status: Status, statusLabel: string = STATUS_LABELS[status]) => ({
    status,
    statusLabel,
  });

  if (source.type === "snapshot") {
    if (!source.importedAt) return result("no_date");
    if (source.staleAfterDate && isoDay(now) > source.staleAfterDate) return result("stale");
    const cov = source.coverage;
    if (STALE_WHEN_INCOMPLETE.has(source.id) && cov && cov.have < cov.total) {
      return result("stale", `Missing ${plural(cov.total - cov.have, "school")}`);
    }
    return result("ok");
  }

  if (source.type === "platform" || source.type === "live") {
    if (source.apiKey === "missing") return result("failing", "Key missing");
    if (check && errorIsCurrent(check)) return result("failing");
    if (!check || !check.lastCheckedAt) return result("untested");
    return result("ok");
  }

  if (source.type === "linkout") {
    if (check && (check.brokenLinks?.length ?? 0) > 0) {
      return result("stale", "Broken link");
    }
    if (!check || !check.lastCheckedAt) return result("untested");
    return result("ok");
  }

  // outbound
  if (source.tokenStatus === "missing") return result("failing", "No token");
  if (!check || !check.lastCheckedAt) return result("untested");
  if (errorIsCurrent(check)) return result("failing");
  return result("ok");
}

const STATUS_ORDER: Record<Status, number> = {
  failing: 0,
  stale: 1,
  untested: 1,
  no_date: 2,
  ok: 3,
};

/** Failing first, then stale/untested, then no_date, then ok; within a band, by name. */
export function sortForList(sources: DataSource[]): DataSource[] {
  return [...sources].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name),
  );
}

/** Failing, stale and untested sources. No-date snapshots are shown but not counted. */
export function needAttentionCount(sources: DataSource[]): number {
  return sources.filter((s) => s.status === "failing" || s.status === "stale" || s.status === "untested")
    .length;
}

export function diagramPositions(
  sources: DataSource[],
): Record<string, { x: number; y: number; w: number }> {
  const pos: Record<string, { x: number; y: number; w: number }> = {};
  const byType = (type: SourceType) => sources.filter((s) => s.type === type);
  byType("live").forEach((s, i) => {
    pos[s.id] = { x: 0, y: 110 + i * 40, w: 290 };
  });
  byType("snapshot").forEach((s, i) => {
    pos[s.id] = { x: 1030, y: 130 + i * 40, w: 290 };
  });
  byType("linkout").forEach((s, i) => {
    pos[s.id] = { x: i * 232, y: 712, w: 220 };
  });
  byType("outbound").forEach((s) => {
    pos[s.id] = { x: 1030, y: 712, w: 290 };
  });
  return pos;
}

type ResidencyRow = { school: string; control: string };
const RESIDENCY_CONTROL = new Map(
  (residencyImport as ResidencyRow[]).map((row) => [row.school, row.control] as const),
);

function isPublicSchool(school: School): boolean {
  return (school.control || RESIDENCY_CONTROL.get(school.name)) === "Public";
}

const SMALL_PLACE_SETTINGS = new Set(["college town", "small town"]);

function schoolCoverage(
  schools: School[],
  has: (school: School) => boolean,
  label?: string,
): SourceCoverage {
  const missing = schools.filter((school) => !safe(() => has(school), false)).map((s) => s.name);
  return {
    have: schools.length - missing.length,
    total: schools.length,
    missing,
    ...(label ? { label } : {}),
  };
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function hasOverride(
  overrides: Record<string, Record<string, string>> | undefined,
  sourceId: string,
  schoolId: string,
): boolean {
  return Boolean(overrides?.[sourceId]?.[schoolId]?.trim());
}

function perSchoolLinks(
  schools: School[],
  urlFor: (school: School) => string | null | undefined,
  suffix: string,
  limit = 3,
): SourceLink[] {
  const links: SourceLink[] = [];
  for (const school of schools) {
    const url = safe(() => urlFor(school)?.trim() || "", "");
    if (!url) continue;
    links.push({ label: `${school.name} ${suffix}`, url });
    if (links.length >= limit) break;
  }
  return links;
}

function coverageFor(
  id: string,
  schools: School[],
  linkOverrides: Record<string, Record<string, string>> | undefined,
): SourceCoverage | null {
  switch (id) {
    case "college-scorecard":
      return schoolCoverage(schools, (s) => s.unitId != null, `of ${schools.length} schools matched to a Scorecard ID`);
    case "tour-embeds":
      return schoolCoverage(schools, (s) => Boolean(virtualTourEmbedUrlForSchool(s.name)));
    case "scoir":
      return schoolCoverage(schools, (s) => scoirRecordForSchool(s) != null);
    case "common-app-grid":
      return schoolCoverage(schools, (s) => queryCommonAppGrid(s.name).status === "hit");
    case "cds-residency": {
      const publics = schools.filter(isPublicSchool);
      return schoolCoverage(publics, (s) => RESIDENCY_CONTROL.has(s.name), `of ${publics.length} public schools`);
    }
    case "finances-catalog":
      return schoolCoverage(schools, (s) => financeRecordForSchoolName(s.name) != null);
    case "campus-calendars":
      return schoolCoverage(schools, (s) => campusCalendarForSchoolName(s.name)?.published === true);
    case "wikimedia-photos":
      return schoolCoverage(schools, (s) => (catalogEntryForSchool(s.name)?.photos.length ?? 0) > 0);
    case "drive-matrix":
      return schoolCoverage(schools, (s) => driveLeg("home", schoolTravelPointId(s.id)) != null);
    case "metro-populations": {
      const metros = schools.filter((s) => !SMALL_PLACE_SETTINGS.has(s.campusSetting.trim().toLowerCase()));
      return schoolCoverage(
        metros,
        (s) => Boolean(s.metroArea?.trim()) || s.metroPopulation != null,
        `of ${metros.length} schools in a metro area`,
      );
    }
    case "npc":
      return schoolCoverage(
        schools,
        (s) =>
          Boolean(financeRecordForSchoolName(s.name)?.netPriceCalculatorUrl?.trim()) ||
          hasOverride(linkOverrides, "npc", s.id),
      );
    case "virtual-tours": {
      const linkOnly = schools.filter((s) => !safe(() => virtualTourEmbedUrlForSchool(s.name), null));
      return schoolCoverage(
        linkOnly,
        (s) => Boolean(virtualTourUrlForSchool(s.name)) || hasOverride(linkOverrides, "virtual-tours", s.id),
        `of ${linkOnly.length} schools without an embedded tour`,
      );
    }
    case "apple-maps":
      return schoolCoverage(
        schools,
        (s) => Boolean(s.visitAddress?.trim() || visitAddressForSchool(s.name) || s.location?.trim()),
      );
    default:
      return null;
  }
}

function sourceLinksFor(def: DataSourceDef, schools: School[]): SourceLink[] | undefined {
  switch (def.id) {
    case "finances-catalog":
      return perSchoolLinks(schools, (s) => financeRecordForSchoolName(s.name)?.costSourceUrl, "cost of attendance");
    case "campus-calendars":
      return perSchoolLinks(schools, (s) => campusCalendarForSchoolName(s.name)?.sourceUrl, "academic calendar");
    case "cds-residency":
      return perSchoolLinks(
        schools.filter(isPublicSchool),
        (s) => s.residencySourceUrl,
        "residency source",
      );
    default:
      return def.sourceLinks;
  }
}

export function buildDataSources(input: {
  schools: School[];
  checks: Record<string, DataSourceCheckState>;
  now?: Date;
  calendarTokenSet?: boolean;
  aiModelSetting?: { options: string[]; value: string; optionLabels?: Record<string, string> } | null;
  linkOverrides?: Record<string, Record<string, string>>;
}): DataSource[] {
  const now = input.now ?? new Date();
  const schools = input.schools.filter((s) => !s.archived);

  return SOURCE_REGISTRY.map((def) => {
    const { env, ...rest } = def;
    const check = input.checks[def.id] ?? null;
    const apiKey = env
      ? envKeyStatus(env.keys ?? [], { anyOf: env.anyOf, notNeeded: env.notNeeded })
      : "not_needed";
    const coverage = def.perSchool
      ? safe(() => coverageFor(def.id, schools, input.linkOverrides), null)
      : null;
    const sourceLinks = safe(() => sourceLinksFor(def, schools), def.sourceLinks);

    const setting: DataSourceSetting | null =
      def.id === "ai-gateway" && input.aiModelSetting
        ? {
            label: "AI model",
            options: input.aiModelSetting.options,
            value: input.aiModelSetting.value,
            ...(input.aiModelSetting.optionLabels ? { optionLabels: input.aiModelSetting.optionLabels } : {}),
          }
        : null;

    const tokenStatus: DataSource["tokenStatus"] =
      def.type === "outbound" ? (input.calendarTokenSet ? "set" : "missing") : null;

    const base: Omit<DataSource, "status" | "statusLabel"> = {
      ...rest,
      sourceLinks,
      apiKey,
      coverage,
      setting,
      tokenStatus,
      lastCheckedAt: check?.lastCheckedAt ?? null,
      lastSuccessAt: check?.lastSuccessAt ?? null,
      lastErrorAt: check?.lastErrorAt ?? null,
      lastErrorMessage: check?.lastErrorMessage ?? null,
      lastMs: check?.lastMs ?? null,
      brokenLinks: check?.brokenLinks ?? [],
      blockedLinks: check?.blockedLinks ?? [],
    };

    return { ...base, ...computeStatus(base, check, now) };
  });
}
