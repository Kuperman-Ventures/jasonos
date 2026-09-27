/**
 * Campus area map helpers — ~25-mile radius Google Satellite view for Snapshot.
 */

/** Miles shown as a radius around campus. */
export const CAMPUS_MAP_RADIUS_MILES = 25;

/** Static map pixel size (Google max 640 without scale=2). */
export const CAMPUS_MAP_SIZE = { width: 640, height: 360 } as const;

/**
 * Zoom so the map width is roughly 2 × radius (50 mi across).
 * Uses the standard Web Mercator meters-per-pixel formula.
 */
export function zoomForRadiusMiles(
  lat: number,
  radiusMiles: number,
  mapWidthPx: number = CAMPUS_MAP_SIZE.width,
): number {
  const diameterMeters = Math.max(1, radiusMiles * 2 * 1609.344);
  const targetMpp = diameterMeters / mapWidthPx;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const zoomExact = Math.log2((156543.03392 * Math.max(0.01, cosLat)) / targetMpp);
  const zoom = Math.round(zoomExact);
  return Math.min(18, Math.max(3, Number.isFinite(zoom) ? zoom : 10));
}

/** Closed circle path for Google Static Maps `path=` (lat,lng pairs). */
export function circlePathPoints(
  lat: number,
  lng: number,
  radiusMiles: number,
  steps = 48,
): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  const latMiles = 69.0;
  const lngMiles = Math.max(0.01, 69.0 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    points.push({
      lat: lat + (radiusMiles / latMiles) * Math.cos(angle),
      lng: lng + (radiusMiles / lngMiles) * Math.sin(angle),
    });
  }
  return points;
}

export function encodeStaticMapPath(
  points: Array<{ lat: number; lng: number }>,
): string {
  return points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
}

/** Build the Google Static Maps URL (caller adds the API key). */
export function buildSatelliteStaticMapUrl(opts: {
  lat: number;
  lng: number;
  apiKey: string;
  radiusMiles?: number;
  width?: number;
  height?: number;
  scale?: 1 | 2;
}): string {
  const radius = opts.radiusMiles ?? CAMPUS_MAP_RADIUS_MILES;
  const width = opts.width ?? CAMPUS_MAP_SIZE.width;
  const height = opts.height ?? CAMPUS_MAP_SIZE.height;
  const scale = opts.scale ?? 2;
  const zoom = zoomForRadiusMiles(opts.lat, radius, width);
  const circle = encodeStaticMapPath(circlePathPoints(opts.lat, opts.lng, radius));
  const params = new URLSearchParams({
    center: `${opts.lat},${opts.lng}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    scale: String(scale),
    maptype: "satellite",
    key: opts.apiKey,
  });
  // Soft orange ring matching The Track accent — outline only so campus stays clear.
  params.append(
    "path",
    `color:0xE85504CC|weight:2|${circle}`,
  );
  params.append(
    "markers",
    `color:0xE85504|${opts.lat.toFixed(5)},${opts.lng.toFixed(5)}`,
  );
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/** Opens Google Maps in satellite mode (no API key required). */
export function googleSatelliteMapsHref(lat: number, lng: number, zoom?: number): string {
  const z = zoom ?? zoomForRadiusMiles(lat, CAMPUS_MAP_RADIUS_MILES);
  return `https://www.google.com/maps/@${lat},${lng},${z}z/data=!3m1!1e3`;
}

export type CampusMapCoords = { lat: number; lng: number };

export function parseCampusMapQuery(searchParams: URLSearchParams): CampusMapCoords | null {
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
