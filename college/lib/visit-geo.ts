/**
 * Lightweight geocoding + drive estimates for Visit planning.
 * Uses Open-Meteo geocoding (no API key). Estimates road time from great-circle distance.
 */

export type GeoPoint = { lat: number; lng: number };

export type DriveEstimate = {
  /** Display label, e.g. "~25 min" or "~2 hr". */
  label: string;
  minutes: number;
  miles: number;
};

const GEO_CACHE_KEY = "track-visit-geo-v1";
const AVG_ROAD_MPH = 42;
const ROAD_FACTOR = 1.32; // great-circle → rough road miles

const memoryCache = new Map<string, GeoPoint | null>();

function readDiskCache(): Record<string, GeoPoint | null> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, GeoPoint | null>;
  } catch {
    return {};
  }
}

function writeDiskCache(entries: Record<string, GeoPoint | null>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(entries));
  } catch {
    /* private mode / quota */
  }
}

export function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDriveEstimate(roadMiles: number): DriveEstimate {
  const miles = Math.max(1, Math.round(roadMiles));
  const minutes = Math.max(5, Math.round((roadMiles / AVG_ROAD_MPH) * 60));
  let label: string;
  if (minutes < 60) {
    label = `${minutes} min`;
  } else {
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    // Match reference copy: "1 hr 45", "2 hr 30"
    label = rem === 0 ? `${hours} hr` : `${hours} hr ${rem}`;
  }
  return { label, minutes, miles };
}

export function estimateDriveBetweenPoints(a: GeoPoint, b: GeoPoint): DriveEstimate {
  return formatDriveEstimate(haversineMiles(a, b) * ROAD_FACTOR);
}

/** Sync fallback when coords are not ready yet. */
export function estimateDriveByLocation(
  fromLocation: string,
  toLocation: string,
): DriveEstimate {
  const parse = (value: string) => {
    const trimmed = value.trim();
    const comma = trimmed.lastIndexOf(",");
    if (comma === -1) return { city: trimmed.toLowerCase(), state: "" };
    return {
      city: trimmed.slice(0, comma).trim().toLowerCase(),
      state: trimmed.slice(comma + 1).trim().toUpperCase(),
    };
  };
  const a = parse(fromLocation);
  const b = parse(toLocation);
  if (a.city && b.city && a.city === b.city && a.state === b.state) {
    return { label: "20 min", minutes: 20, miles: 8 };
  }
  if (a.state && a.state === b.state) {
    return { label: "1 hr 30", minutes: 90, miles: 75 };
  }
  return { label: "4 hr", minutes: 240, miles: 220 };
}

async function geocodeOpenMeteo(name: string): Promise<GeoPoint | null> {
  const params = new URLSearchParams({
    name,
    count: "1",
    language: "en",
    format: "json",
    countryCode: "US",
  });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    results?: Array<{ latitude: number; longitude: number }>;
  };
  const hit = data.results?.[0];
  if (!hit || !Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) return null;
  return { lat: hit.latitude, lng: hit.longitude };
}

function cacheGet(key: string): GeoPoint | null | undefined {
  if (memoryCache.has(key)) return memoryCache.get(key) ?? null;
  const disk = readDiskCache();
  if (Object.prototype.hasOwnProperty.call(disk, key)) {
    memoryCache.set(key, disk[key] ?? null);
    return disk[key] ?? null;
  }
  return undefined;
}

function cacheSet(key: string, point: GeoPoint | null): void {
  memoryCache.set(key, point);
  const disk = readDiskCache();
  disk[key] = point;
  writeDiskCache(disk);
}

export async function geocodeCityState(
  city: string,
  state: string,
): Promise<GeoPoint | null> {
  const key = `${city.trim().toLowerCase()}|${state.trim().toLowerCase()}`;
  if (!city.trim()) return null;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  if (typeof fetch === "undefined") {
    cacheSet(key, null);
    return null;
  }

  try {
    const name = state.trim() ? `${city.trim()}, ${state.trim()}` : city.trim();
    const point = await geocodeOpenMeteo(name);
    cacheSet(key, point);
    return point;
  } catch {
    cacheSet(key, null);
    return null;
  }
}

/**
 * Geocode a free-text address / city / ZIP.
 * Prefers the app `/api/geocode` route (Google when configured), then Open-Meteo.
 */
export async function geocodeAddress(query: string): Promise<GeoPoint | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const key = `addr|${trimmed.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  if (typeof fetch === "undefined") {
    cacheSet(key, null);
    return null;
  }

  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
    if (res.ok) {
      const data = (await res.json()) as { lat?: number; lng?: number; ok?: boolean };
      if (
        data.ok !== false &&
        typeof data.lat === "number" &&
        typeof data.lng === "number" &&
        Number.isFinite(data.lat) &&
        Number.isFinite(data.lng)
      ) {
        const point = { lat: data.lat, lng: data.lng };
        cacheSet(key, point);
        return point;
      }
    }
  } catch {
    /* fall through */
  }

  try {
    const point = await geocodeOpenMeteo(trimmed);
    cacheSet(key, point);
    return point;
  } catch {
    cacheSet(key, null);
    return null;
  }
}
