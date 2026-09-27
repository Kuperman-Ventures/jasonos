"use client";

import { useEffect, useState } from "react";
import type { School } from "@/lib/types";
import {
  CAMPUS_MAP_RADIUS_MILES,
  googleSatelliteMapsHref,
  zoomForRadiusMiles,
} from "@/lib/campus-map";
import { geocodeCityState, type GeoPoint } from "@/lib/visit-geo";
import { parseSchoolLocation } from "@/lib/visit-planning";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; coords: GeoPoint; src: string }
  | { status: "needs_api"; coords: GeoPoint; message: string }
  | { status: "error"; message: string };

async function resolveCampusPoint(school: School): Promise<GeoPoint | null> {
  const address = school.visitAddress?.trim();
  if (address) {
    // Prefer the admissions address when we can parse a city/state from it.
    const comma = address.lastIndexOf(",");
    if (comma !== -1) {
      const left = address.slice(0, comma).trim();
      const right = address.slice(comma + 1).trim();
      // "... City, ST 12345" or "City, ST"
      const stateMatch = right.match(/^([A-Z]{2})\b/i);
      if (stateMatch) {
        const cityParts = left.split(",");
        const city = (cityParts[cityParts.length - 1] || left).trim();
        const hit = await geocodeCityState(city, stateMatch[1]!.toUpperCase());
        if (hit) return hit;
      }
    }
  }
  const loc = parseSchoolLocation(school.location);
  if (!loc.city) return null;
  return geocodeCityState(loc.city, loc.state);
}

export function SchoolCampusSatelliteMap({ school }: { school: School }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    void (async () => {
      const coords = await resolveCampusPoint(school);
      if (cancelled) return;
      if (!coords) {
        setState({
          status: "error",
          message: "Could not locate this campus on a map yet.",
        });
        return;
      }

      const src = `/api/maps/satellite?lat=${coords.lat}&lng=${coords.lng}`;
      try {
        const res = await fetch(src);
        if (cancelled) return;
        if (res.ok && (res.headers.get("content-type") || "").startsWith("image/")) {
          // Blob URL so we don't re-hit auth cookies oddly with <img> alone.
          const blob = await res.blob();
          if (cancelled) return;
          const objectUrl = URL.createObjectURL(blob);
          setState({ status: "ready", coords, src: objectUrl });
          return;
        }
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        if (cancelled) return;
        if (body?.error === "api_not_enabled" || res.status === 403) {
          setState({
            status: "needs_api",
            coords,
            message:
              body?.message ||
              "Maps Static API is not enabled for the Google key yet.",
          });
          return;
        }
        setState({
          status: "error",
          message: body?.message || "Satellite map could not load.",
        });
      } catch {
        if (!cancelled) {
          setState({ status: "error", message: "Satellite map could not load." });
        }
      }
    })();

    return () => {
      cancelled = true;
      setState((prev) => {
        if (prev.status === "ready") URL.revokeObjectURL(prev.src);
        return prev;
      });
    };
  }, [school.id, school.location, school.visitAddress]);

  const openHref =
    state.status === "ready" || state.status === "needs_api"
      ? googleSatelliteMapsHref(
          state.coords.lat,
          state.coords.lng,
          zoomForRadiusMiles(state.coords.lat, CAMPUS_MAP_RADIUS_MILES),
        )
      : null;

  return (
    <section className="snapshot-satellite" aria-labelledby="snap-sat-h">
      <div className="snapshot-satellite-head">
        <span className="area-label" id="snap-sat-h">
          Around campus
        </span>
        <span className="snapshot-satellite-meta">
          Google Satellite · about {CAMPUS_MAP_RADIUS_MILES} mi radius
        </span>
      </div>

      {state.status === "loading" ? (
        <div className="snapshot-satellite-frame is-loading" role="status">
          Locating campus…
        </div>
      ) : null}

      {state.status === "ready" ? (
        <div className="snapshot-satellite-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={state.src}
            alt={`Satellite map of ${school.name} and the surrounding ${CAMPUS_MAP_RADIUS_MILES} miles`}
          />
          {openHref ? (
            <a
              className="snapshot-satellite-open"
              href={openHref}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps
            </a>
          ) : null}
        </div>
      ) : null}

      {state.status === "needs_api" ? (
        <div className="snapshot-satellite-frame is-fallback">
          <p>
            Google Satellite is wired up, but this API key is still limited to
            Routes. Enable <strong>Maps Static API</strong> in Google Cloud and
            add it to the key’s API restrictions to show the map here.
          </p>
          {openHref ? (
            <a href={openHref} target="_blank" rel="noreferrer">
              Open satellite view in Google Maps
            </a>
          ) : null}
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="snapshot-satellite-frame is-fallback">
          <p>{state.message}</p>
        </div>
      ) : null}
    </section>
  );
}
