import { CHRISTMAS_BREAK, HISTORY_DECEMBER_YEARS } from "@/config/christmas";
import { eachDate } from "./dates";
import { seasonFromDaily, summarizeHistory, type HistorySummary, type ProjectionSummary, type SeasonSnow } from "./summarize";

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const SEASONAL_URL = "https://seasonal-api.open-meteo.com/v1/seasonal";
const CACHE_MS = 30 * 60 * 1000;
const TZ = "America/New_York";

type DailyPoint = { snowIn: number | null; highF: number | null };

const cache = new Map<string, { at: number; times: string[]; points: DailyPoint[] }>();

function asNumbers(value: unknown): Array<number | null> {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "number" && Number.isFinite(item) ? item : null));
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function toInches(value: number | null, unit: string | undefined): number | null {
  if (value == null) return null;
  const label = (unit ?? "").toLowerCase();
  if (label.length === 0 || label.includes("cm")) return value / 2.54;
  return value;
}

async function fetchDaily(
  url: string,
  lat: number,
  lon: number,
  start: string,
  end: string,
  extra: string
): Promise<Map<string, DailyPoint>> {
  const key = `${url}|${lat.toFixed(4)}|${lon.toFixed(4)}|${start}|${end}|${extra}`;
  const hit = cache.get(key);
  const now = Date.now();
  let stored = hit && now - hit.at < CACHE_MS ? hit : null;

  if (!stored) {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      start_date: start,
      end_date: end,
      daily: "snowfall_sum,temperature_2m_max",
      temperature_unit: "fahrenheit",
      precipitation_unit: "inch",
      timezone: TZ,
    });
    if (extra) params.set("models", extra);
    const response = await fetch(`${url}?${params.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "SkiTracker (contact: jason@kupermanadvisors.com)" },
    });
    if (!response.ok) throw new Error(`Weather ${response.status}`);
    const body = (await response.json()) as {
      error?: boolean;
      reason?: string;
      daily_units?: { snowfall_sum?: string };
      daily?: { time?: unknown; snowfall_sum?: unknown; temperature_2m_max?: unknown };
    };
    if (body.error) throw new Error(body.reason || "Weather request failed");
    const times = asStrings(body.daily?.time);
    const snowUnit = body.daily_units?.snowfall_sum;
    const snow = asNumbers(body.daily?.snowfall_sum).map((value) => toInches(value, snowUnit));
    const highs = asNumbers(body.daily?.temperature_2m_max);
    const points = times.map((_, index) => ({ snowIn: snow[index] ?? null, highF: highs[index] ?? null }));
    stored = { at: now, times, points };
    cache.set(key, stored);
  }

  const byDate = new Map<string, DailyPoint>();
  stored.times.forEach((date, index) => {
    const point = stored?.points[index];
    if (point) byDate.set(date, point);
  });
  return byDate;
}

export async function getHistory(lat: number, lon: number): Promise<HistorySummary> {
  const first = HISTORY_DECEMBER_YEARS[0];
  const last = HISTORY_DECEMBER_YEARS[HISTORY_DECEMBER_YEARS.length - 1];
  if (first == null || last == null) throw new Error("No history years");
  const byDate = await fetchDaily(ARCHIVE_URL, lat, lon, `${first}-12-24`, `${last + 1}-01-02`, "");
  const seasons: SeasonSnow[] = [];
  for (const year of HISTORY_DECEMBER_YEARS) {
    const dates = eachDate(`${year}-12-24`, `${year + 1}-01-02`);
    const season = seasonFromDaily(year, dates, byDate);
    if (season) seasons.push(season);
  }
  if (seasons.length === 0) throw new Error("No historical Christmas windows");
  return summarizeHistory(seasons);
}

export async function getProjection(lat: number, lon: number): Promise<ProjectionSummary> {
  const dates = eachDate(CHRISTMAS_BREAK.start, CHRISTMAS_BREAK.end);
  const byDate = await fetchDaily(
    SEASONAL_URL,
    lat,
    lon,
    CHRISTMAS_BREAK.start,
    CHRISTMAS_BREAK.end,
    "ecmwf_seasonal_ensemble_mean_seamless"
  );
  const season = seasonFromDaily(2026, dates, byDate);
  if (!season) throw new Error("Seasonal forecast does not cover this break");
  return { snowIn: season.snowIn, meanHighF: season.meanHighF };
}
