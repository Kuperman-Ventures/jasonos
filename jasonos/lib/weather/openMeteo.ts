import { SKY_SCORES } from "@/config/scoring";
import type { DayWeather, SkyType } from "./types";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const CACHE_MS = 30 * 60 * 1000;
const TZ = "America/New_York";

export class WeatherRangeError extends Error {
  readonly date: string;
  constructor(date: string) {
    super(`Weather date ${date} is outside the available range`);
    this.name = "WeatherRangeError";
    this.date = date;
  }
}

export type HourSample = {
  time: string;
  temperatureF: number | null;
  apparentF: number | null;
  rainIn: number | null;
  snowfallIn: number | null;
  windMph: number | null;
  weatherCode: number | null;
};

type HourlyBundle = { samples: HourSample[]; fetchedAt: string };

const cache = new Map<string, { at: number; data: HourlyBundle }>();
const inflight = new Map<string, Promise<HourlyBundle>>();

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

function asNumbers(value: unknown): Array<number | null> {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "number" && Number.isFinite(item) ? item : null));
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatNy(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

function wallToUtcMillis(wall: string): number {
  const [date, time] = wall.split("T");
  const [y, m, d] = (date ?? "").split("-").map(Number);
  const [hh, mm] = (time ?? "00:00").split(":").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0);
}

/** Interpret a New York wall time ("YYYY-MM-DDTHH:MM") as an instant. */
function parseNy(wall: string): Date {
  let utc = wallToUtcMillis(wall);
  for (let pass = 0; pass < 3; pass++) {
    const formatted = formatNy(new Date(utc));
    utc -= wallToUtcMillis(formatted) - wallToUtcMillis(wall);
  }
  return new Date(utc);
}

function addCalendarDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

function skyFromCode(code: number): SkyType {
  if (code <= 1) return "sunny";
  if (code === 2) return "partly-cloudy";
  if (code === 3) return "overcast";
  if (code >= 45 && code <= 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code >= 71 && code <= 73) return "light-snow";
  if ((code >= 75 && code <= 77) || (code >= 85 && code <= 86) || code >= 95) return "heavy-snow";
  return "overcast";
}

const SKY_TIE_RANK: SkyType[] = [
  "rain",
  "fog",
  "heavy-snow",
  "overcast",
  "light-snow",
  "partly-cloudy",
  "sunny",
];

function skyIsWorse(candidate: SkyType, current: SkyType): boolean {
  const candidateScore = SKY_SCORES[candidate];
  const currentScore = SKY_SCORES[current];
  if (candidateScore !== currentScore) return candidateScore < currentScore;
  return SKY_TIE_RANK.indexOf(candidate) < SKY_TIE_RANK.indexOf(current);
}

function dominantSky(codes: number[]): SkyType {
  const counts = new Map<SkyType, number>();
  for (const code of codes) {
    const sky = skyFromCode(code);
    counts.set(sky, (counts.get(sky) ?? 0) + 1);
  }
  let best: SkyType = "overcast";
  let bestCount = -1;
  for (const [sky, count] of counts) {
    if (count > bestCount || (count === bestCount && skyIsWorse(sky, best))) {
      best = sky;
      bestCount = count;
    }
  }
  return best;
}

function numbersIn(samples: HourSample[], pick: (sample: HourSample) => number | null): number[] {
  const values: number[] = [];
  for (const sample of samples) {
    const value = pick(sample);
    if (value != null) values.push(value);
  }
  return values;
}

export function deriveDayWeather(samples: HourSample[], date: string, fetchedAt: string): DayWeather {
  const ski = samples.filter((sample) => sample.time >= `${date}T09:00` && sample.time <= `${date}T16:00`);
  if (ski.length === 0) throw new WeatherRangeError(date);

  const highs = numbersIn(ski, (sample) => sample.temperatureF);
  const winds = numbersIn(ski, (sample) => sample.windMph);
  const chills = numbersIn(ski, (sample) => sample.apparentF);
  if (highs.length === 0 || winds.length === 0 || chills.length === 0) throw new WeatherRangeError(date);

  const previous = addCalendarDays(date, -1);
  const overnight = samples.filter(
    (sample) => sample.time >= `${previous}T18:00` && sample.time <= `${date}T08:00`
  );
  const lows = numbersIn(overnight, (sample) => sample.temperatureF);
  if (lows.length === 0) throw new WeatherRangeError(date);

  const end = parseNy(`${date}T06:00`);
  const startWall = formatNy(new Date(end.getTime() - 72 * 60 * 60 * 1000));
  const endWall = `${date}T06:00`;
  const snowfallLast72hIn = samples
    .filter((sample) => sample.time >= startWall && sample.time <= endWall)
    .reduce((sum, sample) => sum + (sample.snowfallIn ?? 0), 0);

  const rainHours = ski.filter(
    (sample) => (sample.rainIn ?? 0) > 0.01 && (sample.temperatureF ?? -100) > 36
  ).length;

  const codes = numbersIn(ski, (sample) => sample.weatherCode);
  const sky = codes.length > 0 ? dominantSky(codes) : "overcast";

  return {
    date,
    highF: Math.max(...highs),
    lowF: Math.min(...lows),
    windSustainedMph: Math.max(...winds),
    windChillF: Math.min(...chills),
    snowfallLast72hIn,
    rainHours,
    sky,
    source: "open-meteo",
    fetchedAt,
  };
}

function snowfallInches(value: number, unit: string | undefined): number {
  if (!unit || unit.toLowerCase().includes("cm")) return value / 2.54;
  return value;
}

async function fetchHourly(lat: number, lon: number): Promise<HourlyBundle> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: "temperature_2m,apparent_temperature,precipitation,snowfall,rain,windspeed_10m,cloudcover,weathercode",
    temperature_unit: "fahrenheit",
    windspeed_unit: "mph",
    precipitation_unit: "inch",
    timezone: TZ,
    past_days: "3",
    forecast_days: "16",
  });
  const response = await fetch(`${FORECAST_URL}?${params.toString()}`, {
    headers: { "User-Agent": "SkiTracker (contact: jason@kupermanadvisors.com)" },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object") throw new Error("Open-Meteo returned an empty forecast");
  const record = body as { hourly?: unknown; hourly_units?: unknown };
  const hourly = record.hourly;
  if (!hourly || typeof hourly !== "object") throw new Error("Open-Meteo returned no hourly forecast");
  const table = hourly as Record<string, unknown>;
  const units =
    record.hourly_units && typeof record.hourly_units === "object"
      ? (record.hourly_units as Record<string, unknown>)
      : {};
  const snowUnit = typeof units.snowfall === "string" ? units.snowfall : undefined;
  const times = asStrings(table.time);
  const temps = asNumbers(table.temperature_2m);
  const apparent = asNumbers(table.apparent_temperature);
  const rain = asNumbers(table.rain);
  const snow = asNumbers(table.snowfall);
  const wind = asNumbers(table.windspeed_10m);
  const codes = asNumbers(table.weathercode);
  const samples: HourSample[] = times.map((time, index) => ({
    time: time.slice(0, 16),
    temperatureF: temps[index] ?? null,
    apparentF: apparent[index] ?? null,
    rainIn: rain[index] ?? null,
    snowfallIn: snow[index] == null ? null : snowfallInches(snow[index], snowUnit),
    windMph: wind[index] ?? null,
    weatherCode: codes[index] ?? null,
  }));
  return { samples, fetchedAt: new Date().toISOString() };
}

export function getHourly(lat: number, lon: number): Promise<HourlyBundle> {
  const key = cacheKey(lat, lon);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.data);
  const pending = inflight.get(key);
  if (pending) return pending;
  const promise = fetchHourly(lat, lon)
    .then((data) => {
      cache.set(key, { at: Date.now(), data });
      inflight.delete(key);
      return data;
    })
    .catch((error: unknown) => {
      inflight.delete(key);
      throw error;
    });
  inflight.set(key, promise);
  return promise;
}

export async function getDayWeather(lat: number, lon: number, date: string): Promise<DayWeather> {
  const hourly = await getHourly(lat, lon);
  return deriveDayWeather(hourly.samples, date, hourly.fetchedAt);
}

/** Previous 48 hours ending at 09:00 on date, for the resort-report stub. */
export function previous48Hours(samples: HourSample[], date: string): HourSample[] {
  const end = parseNy(`${date}T09:00`);
  const startWall = formatNy(new Date(end.getTime() - 48 * 60 * 60 * 1000));
  return samples.filter((sample) => sample.time >= startWall && sample.time < `${date}T09:00`);
}
