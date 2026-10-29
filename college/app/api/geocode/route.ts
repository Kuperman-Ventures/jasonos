import { NextResponse } from "next/server";

export const runtime = "nodejs";

type GeocodeBody = {
  ok: boolean;
  lat?: number;
  lng?: number;
  label?: string;
  source?: "google" | "open-meteo";
  error?: string;
};

async function geocodeGoogle(query: string, key: string): Promise<GeocodeBody | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("key", key);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status?: string;
    results?: Array<{
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    }>;
  };
  const hit = data.results?.[0];
  const lat = hit?.geometry?.location?.lat;
  const lng = hit?.geometry?.location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return {
    ok: true,
    lat,
    lng,
    label: hit?.formatted_address ?? query,
    source: "google",
  };
}

async function geocodeOpenMeteo(query: string): Promise<GeocodeBody | null> {
  const params = new URLSearchParams({
    name: query,
    count: "1",
    language: "en",
    format: "json",
    countryCode: "US",
  });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    results?: Array<{ latitude: number; longitude: number; name?: string; admin1?: string }>;
  };
  const hit = data.results?.[0];
  if (!hit || !Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) return null;
  const label = [hit.name, hit.admin1].filter(Boolean).join(", ");
  return {
    ok: true,
    lat: hit.latitude,
    lng: hit.longitude,
    label: label || query,
    source: "open-meteo",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) {
    return NextResponse.json({ ok: false, error: "Missing q" } satisfies GeocodeBody, {
      status: 400,
    });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "";
  try {
    if (key) {
      const google = await geocodeGoogle(q, key);
      if (google) return NextResponse.json(google);
    }
    const fallback = await geocodeOpenMeteo(q);
    if (fallback) return NextResponse.json(fallback);
    return NextResponse.json(
      { ok: false, error: "No match for that address" } satisfies GeocodeBody,
      { status: 404 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Geocode failed",
      } satisfies GeocodeBody,
      { status: 500 },
    );
  }
}
