import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import {
  buildSatelliteStaticMapUrl,
  parseCampusMapQuery,
} from "@/lib/campus-map";

export const runtime = "nodejs";
export const maxDuration = 20;

/**
 * Proxies Google Static Maps (satellite) so the API key stays server-side.
 * Requires Maps Static API enabled on GOOGLE_MAPS_API_KEY.
 */
export async function GET(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      {
        error: "missing_key",
        message: "GOOGLE_MAPS_API_KEY is not set on the server.",
      },
      { status: 503 },
    );
  }

  const coords = parseCampusMapQuery(new URL(request.url).searchParams);
  if (!coords) {
    return NextResponse.json(
      { error: "bad_coords", message: "Provide valid lat and lng query params." },
      { status: 400 },
    );
  }

  const url = buildSatelliteStaticMapUrl({
    lat: coords.lat,
    lng: coords.lng,
    apiKey: key,
  });

  let upstream: Response;
  try {
    upstream = await fetch(url, { cache: "force-cache" });
  } catch {
    return NextResponse.json(
      { error: "upstream", message: "Could not reach Google Maps." },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get("content-type") || "";
  if (!upstream.ok || !contentType.startsWith("image/")) {
    const body = await upstream.text();
    const denied =
      /not authorized|REQUEST_DENIED|ApiNotActivated|STATIC_MAPS/i.test(body);
    return NextResponse.json(
      {
        error: denied ? "api_not_enabled" : "upstream",
        message: denied
          ? "Enable Maps Static API for this Google Cloud key (and allow it on the key’s API restrictions). The key is currently limited to Routes."
          : body.slice(0, 280) || "Google Maps returned an error.",
      },
      { status: denied ? 403 : 502 },
    );
  }

  const bytes = await upstream.arrayBuffer();
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
