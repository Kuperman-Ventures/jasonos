import type { NwsAlert } from "./types";

type AlertFeature = {
  id?: unknown;
  properties?: {
    event?: unknown;
    severity?: unknown;
    headline?: unknown;
    ends?: unknown;
    id?: unknown;
  };
};

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function alertUrl(feature: AlertFeature): string {
  const propertyId = text(feature.properties?.id);
  if (propertyId.startsWith("http")) return propertyId;
  const featureId = text(feature.id);
  if (featureId.startsWith("http")) return featureId;
  return "https://www.weather.gov";
}

export async function getAlerts(lat: number, lon: number): Promise<NwsAlert[]> {
  try {
    const response = await fetch(
      `https://api.weather.gov/alerts/active?point=${lat},${lon}`,
      {
        headers: {
          "User-Agent": "SkiTracker (contact: jason@kupermanadvisors.com)",
          Accept: "application/geo+json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      }
    );
    if (!response.ok) throw new Error(`NWS ${response.status}`);
    const body: unknown = await response.json();
    const features =
      body && typeof body === "object" && Array.isArray((body as { features?: unknown }).features)
        ? ((body as { features: AlertFeature[] }).features)
        : [];
    return features
      .map((feature) => {
        const event = text(feature.properties?.event);
        if (!event) return null;
        const ends = feature.properties?.ends;
        return {
          event,
          severity: text(feature.properties?.severity),
          headline: text(feature.properties?.headline),
          ends: typeof ends === "string" ? ends : null,
          url: alertUrl(feature),
        };
      })
      .filter((alert): alert is NwsAlert => alert !== null);
  } catch (error) {
    console.error("[nws] alerts failed", error);
    return [];
  }
}
