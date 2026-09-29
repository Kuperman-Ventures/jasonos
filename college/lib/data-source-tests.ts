/**
 * Test connection implementations for Reference › Data Sources (super admin only).
 * Each test makes one small real request. Billed APIs (Routes, Static Maps) cost one
 * call per test; Perplexity is never tested because every call is billed.
 */

import { adminSiteUrl } from "./admin";
import { saveLinkCheck, saveSourceCall } from "./data-source-checks";
import { SOURCE_REGISTRY } from "./data-sources";
import { collegeDb, supabaseConfigured } from "./db";
import { financeRecordForSchoolName, newJerseyStatePrograms } from "./finances";
import { checkLinks, summarizeLinkOutcomes, type LinkTarget } from "./link-check";
import type { LinkOverrides } from "./link-overrides";
import { virtualTourEmbedUrlForSchool, virtualTourUrlForSchool } from "./school-photos";
import type { School } from "./types";

export const SOURCE_TEST_TIMEOUT_MS = 10_000;

export type SourceTestResult = { ok: boolean; ms: number; message: string };
export type SourceTestContext = {
  schools: School[];
  linkOverrides: LinkOverrides;
  /** Epoch ms after which link checks stop starting new requests. */
  deadline?: number;
};

export class NotTestableError extends Error {}

const USER_AGENT = "KyleCollegePortal/0.1 (+data-sources-check)";
const SAMPLE_SCHOOL = "Massachusetts Institute of Technology";
const MIT = { lat: 42.3601, lng: -71.0942 };

function env(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

async function withTimeout<T>(promise: Promise<T>, ms = SOURCE_TEST_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOk(url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(SOURCE_TEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${body ? `: ${body.replace(/\s+/g, " ").slice(0, 200)}` : ""}`);
  }
  return response;
}

function requireKey(value: string, names: string): string {
  if (!value) throw new Error(`${names} is not set`);
  return value;
}

type LinkSourceId = "npc" | "nj-aid" | "virtual-tours" | "tour-embeds";

export function linkTargetsFor(id: LinkSourceId, ctx: Pick<SourceTestContext, "schools" | "linkOverrides">): LinkTarget[] {
  const schools = ctx.schools.filter((s) => !s.archived);
  const override = (sourceId: string, schoolId: string) => ctx.linkOverrides[sourceId]?.[schoolId] ?? null;
  const targets: LinkTarget[] = [];
  const push = (school: School, url: string | null | undefined) => {
    const trimmed = url?.trim();
    if (trimmed) targets.push({ url: trimmed, schoolId: school.id, schoolName: school.name });
  };
  switch (id) {
    case "npc":
      for (const s of schools) push(s, override("npc", s.id) ?? financeRecordForSchoolName(s.name)?.netPriceCalculatorUrl);
      break;
    case "virtual-tours":
      for (const s of schools) {
        if (virtualTourEmbedUrlForSchool(s.name)) continue;
        push(s, override("virtual-tours", s.id) ?? virtualTourUrlForSchool(s.name));
      }
      break;
    case "tour-embeds":
      for (const s of schools) push(s, virtualTourEmbedUrlForSchool(s.name));
      break;
    case "nj-aid":
      for (const program of newJerseyStatePrograms()) {
        for (const url of program.sourceUrl.split(/\s*;\s*/)) {
          if (url.trim()) targets.push({ url: url.trim(), schoolName: program.name });
        }
      }
      break;
  }
  return targets;
}

const LINK_SOURCES = new Set<string>(["npc", "nj-aid", "virtual-tours", "tour-embeds"]);

const TESTS: Record<string, (ctx: SourceTestContext) => Promise<string>> = {
  async supabase() {
    if (!supabaseConfigured()) throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
    const { error } = await collegeDb().from("app_state").select("id").limit(1);
    if (error) throw new Error(error.message);
    return "Read college.app_state";
  },

  async "google-signin"() {
    const url = requireKey(env("NEXT_PUBLIC_SUPABASE_URL"), "NEXT_PUBLIC_SUPABASE_URL");
    const anon = requireKey(env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), "NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const response = await fetchOk(`${url.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: anon } });
    const body = (await response.json()) as { external?: Record<string, boolean> };
    if (!body.external?.google) throw new Error("Google provider is disabled in Supabase Auth");
    return "Supabase Auth has Google enabled";
  },

  async "ai-gateway"() {
    const { gateway } = await import("@ai-sdk/gateway");
    const credits = await gateway.getCredits();
    return `Authenticated · balance ${credits.balance}`;
  },

  async "vercel-hosting"() {
    const site = adminSiteUrl();
    const response = await fetchOk(`${site}/login`, { redirect: "follow" });
    return `${new URL(site).host} answered ${response.status}`;
  },

  async "college-scorecard"() {
    const {
      resolveScorecardApiKey,
      isScorecardKeyInvalidError,
      scorecardKeyInvalidMessage,
    } = await import("./college-scorecard");
    const resolved = resolveScorecardApiKey();
    const attempt = async (key: string) => {
      const url = new URL("https://api.data.gov/ed/collegescorecard/v1/schools.json");
      url.searchParams.set("api_key", key);
      url.searchParams.set("school.name", SAMPLE_SCHOOL);
      url.searchParams.set("fields", "id,school.name");
      url.searchParams.set("per_page", "1");
      const response = await fetch(url.toString(), {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(SOURCE_TEST_TIMEOUT_MS),
      });
      const text = await response.text().catch(() => "");
      return { response, text };
    };

    let usedKey = resolved.key;
    let { response, text } = await attempt(resolved.key);
    let liveKeyRejected = false;
    if (!response.ok && resolved.mode === "live" && isScorecardKeyInvalidError(text)) {
      liveKeyRejected = true;
      usedKey = "DEMO_KEY";
      ({ response, text } = await attempt("DEMO_KEY"));
    }
    if (!response.ok) {
      if (liveKeyRejected || isScorecardKeyInvalidError(text)) {
        throw new Error(scorecardKeyInvalidMessage());
      }
      throw new Error(
        `HTTP ${response.status}${text ? `: ${text.replace(/\s+/g, " ").slice(0, 200)}` : ""}`,
      );
    }
    const body = JSON.parse(text) as { results?: unknown[] };
    const count = body.results?.length ?? 0;
    if (liveKeyRejected) {
      return (
        `${count} result for ${SAMPLE_SCHOOL} via DEMO_KEY. ` +
        `COLLEGE_SCORECARD_API_KEY in Vercel is invalid — fix or delete it (api.data.gov signup for a free key).`
      );
    }
    if (usedKey === "DEMO_KEY" || resolved.mode === "demo") {
      return `${count} result for ${SAMPLE_SCHOOL} (DEMO_KEY — set COLLEGE_SCORECARD_API_KEY in Vercel for production rates)`;
    }
    return `${count} result for ${SAMPLE_SCHOOL}`;
  },

  async "google-routes"() {
    const key = requireKey(env("GOOGLE_MAPS_API_KEY"), "GOOGLE_MAPS_API_KEY");
    const response = await fetchOk("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "originIndex,destinationIndex,duration,status",
      },
      body: JSON.stringify({
        origins: [{ waypoint: { address: "Maplewood, NJ" } }],
        destinations: [{ waypoint: { address: "Princeton, NJ" } }],
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
      }),
    });
    const text = await response.text();
    if (!/duration/.test(text)) throw new Error(`No duration in response: ${text.slice(0, 160)}`);
    return "One route leg returned";
  },

  async "google-maps"() {
    const key = requireKey(env("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "GOOGLE_MAPS_API_KEY"), "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
    await fetchOk(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=Function.prototype`);
    return "Loader script served. Key referrer rules are only enforced in the browser.";
  },

  async "google-static-maps"() {
    const key = requireKey(env("GOOGLE_MAPS_API_KEY"), "GOOGLE_MAPS_API_KEY");
    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${MIT.lat},${MIT.lng}&zoom=15&size=64x64&maptype=satellite&key=${encodeURIComponent(key)}`;
    const response = await fetchOk(url);
    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) throw new Error(`Expected an image, got ${type || "no content type"}`);
    return "Satellite tile returned";
  },

  async "open-meteo"() {
    const body = (await (await fetchOk("https://geocoding-api.open-meteo.com/v1/search?name=Boston&count=1")).json()) as {
      results?: unknown[];
    };
    if (!body.results?.length) throw new Error("No geocoding results for Boston");
    return "Geocoded Boston";
  },

  async "census-geocoder"() {
    const url = new URL("https://geocoding.geo.census.gov/geocoder/geographies/coordinates");
    url.searchParams.set("x", String(MIT.lng));
    url.searchParams.set("y", String(MIT.lat));
    url.searchParams.set("benchmark", "Public_AR_Current");
    url.searchParams.set("vintage", "Current_Current");
    url.searchParams.set("layers", "Metropolitan Statistical Areas");
    url.searchParams.set("format", "json");
    const body = (await (await fetchOk(url.toString())).json()) as {
      result?: { geographies?: Record<string, Array<{ NAME?: string }>> };
    };
    const metro = body.result?.geographies?.["Metropolitan Statistical Areas"]?.[0]?.NAME;
    if (!metro) throw new Error("No metro area returned for MIT");
    return metro;
  },

  async wikipedia() {
    const body = (await (
      await fetchOk("https://en.wikipedia.org/api/rest_v1/page/summary/Massachusetts_Institute_of_Technology")
    ).json()) as { title?: string };
    if (!body.title) throw new Error("No page summary returned");
    return `Summary for ${body.title}`;
  },

  async "link-preview"() {
    const { fetchLinkPreview } = await import("./link-preview");
    const preview = await fetchLinkPreview("https://example.com");
    return preview.title ? `Parsed “${preview.title}”` : "Fetched example.com";
  },

  async ocr() {
    const { version } = (await import("tesseract.js/package.json")).default as { version: string };
    await fetchOk(`https://cdn.jsdelivr.net/npm/tesseract.js@v${version}/dist/worker.min.js`, { method: "HEAD" });
    await fetchOk("https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", {
      method: "HEAD",
    });
    return "Worker and English data reachable on jsDelivr";
  },

  async "map-tiles"() {
    await fetchOk("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/3/3/2");
    await fetchOk("https://tile.openstreetmap.org/3/2/3.png");
    return "Esri and OpenStreetMap tiles served";
  },

  async helpers() {
    await fetchOk("https://icons.duckduckgo.com/ip3/mit.edu.ico");
    await fetchOk("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json", { method: "HEAD" });
    return "Icon service and world-atlas shapes reachable";
  },

  async "apple-maps"() {
    await fetchOk("https://maps.apple.com/", { redirect: "follow" });
    return "maps.apple.com reachable. Directions links are built from each school's address.";
  },

  async "calendar-feed"() {
    const { loadCalendarEventsForFeed, resolveCalendarFeedToken } = await import("./calendar-feed");
    const token = await resolveCalendarFeedToken();
    if (!token) throw new Error("No calendar feed token");
    const events = await loadCalendarEventsForFeed();
    return `Token set · ${events.length} calendar event${events.length === 1 ? "" : "s"} in app state`;
  },
};

export function isTestable(id: string): boolean {
  const def = SOURCE_REGISTRY.find((s) => s.id === id);
  return Boolean(def?.testable && (TESTS[id] || LINK_SOURCES.has(id)));
}

async function runLinkSource(id: LinkSourceId, ctx: SourceTestContext): Promise<SourceTestResult> {
  const started = Date.now();
  const targets = linkTargetsFor(id, ctx);
  if (targets.length === 0) {
    const result = { ok: true, ms: 0, message: "No links to check" };
    await saveLinkCheck(id, { broken: [], blocked: [], ms: 0 });
    return result;
  }
  const { outcomes, skipped } = await checkLinks(targets, { deadline: ctx.deadline });
  const summary = summarizeLinkOutcomes(outcomes);
  const ms = Date.now() - started;
  const parts = [`${summary.ok} ok`, `${summary.broken.length} broken`, `${summary.blocked.length} blocked`];
  if (skipped.length) parts.push(`${skipped.length} skipped for time`);
  const message = parts.join(", ");
  const ok = summary.broken.length === 0;
  await saveLinkCheck(id, {
    broken: summary.broken,
    blocked: summary.blocked,
    ms,
    error: ok ? null : `${summary.broken.length} broken link${summary.broken.length === 1 ? "" : "s"}`,
  });
  return { ok, ms, message };
}

/** Run one source's test and persist the outcome. Throws NotTestableError for untestable ids. */
export async function runSourceTest(id: string, ctx: SourceTestContext): Promise<SourceTestResult> {
  const def = SOURCE_REGISTRY.find((s) => s.id === id);
  if (!def) throw new NotTestableError(`Unknown source ${id}`);
  if (!def.testable || !isTestable(id)) {
    throw new NotTestableError(
      id === "perplexity"
        ? "Perplexity has no Test connection: every call is billed. Status comes from real school lookups."
        : `${def.name} has no Test connection.`,
    );
  }

  if (LINK_SOURCES.has(id)) return runLinkSource(id as LinkSourceId, ctx);

  const started = Date.now();
  try {
    const message = await withTimeout(TESTS[id]!(ctx));
    const ms = Date.now() - started;
    await saveSourceCall(id, { ok: true, ms });
    return { ok: true, ms, message };
  } catch (error) {
    const ms = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);
    await saveSourceCall(id, { ok: false, ms, error: message });
    return { ok: false, ms, message };
  }
}

export function testableSourceIds(): string[] {
  return SOURCE_REGISTRY.filter((s) => isTestable(s.id)).map((s) => s.id);
}
