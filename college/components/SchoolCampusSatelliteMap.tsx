"use client";

import { useEffect, useRef, useState } from "react";
import type { School } from "@/lib/types";
import {
  CAMPUS_MAP_RADIUS_MILES,
  googleSatelliteMapsHref,
  loadGoogleMapsJavaScript,
  milesToMeters,
  zoomForRadiusMiles,
} from "@/lib/campus-map";
import { geocodeCityState, type GeoPoint } from "@/lib/visit-geo";
import { parseSchoolLocation } from "@/lib/visit-planning";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; coords: GeoPoint }
  | { status: "needs_api"; coords: GeoPoint; message: string }
  | { status: "error"; message: string };

async function resolveCampusPoint(school: School): Promise<GeoPoint | null> {
  const address = school.visitAddress?.trim();
  if (address) {
    const comma = address.lastIndexOf(",");
    if (comma !== -1) {
      const left = address.slice(0, comma).trim();
      const right = address.slice(comma + 1).trim();
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

async function fetchBrowserMapsKey(): Promise<string> {
  const res = await fetch("/api/maps/browser-key");
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    throw new Error(body?.message || "Could not load Maps API key.");
  }
  const body = (await res.json()) as { key?: string };
  if (!body.key) throw new Error("Maps API key missing from server.");
  return body.key;
}

export function SchoolCampusSatelliteMap({ school }: { school: School }) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    mapRef.current = null;

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

      try {
        const key = await fetchBrowserMapsKey();
        if (cancelled) return;
        await loadGoogleMapsJavaScript(key);
        if (cancelled) return;
        if (!window.google?.maps?.Map) {
          throw new Error("Google Maps failed to initialize.");
        }
        setState({ status: "ready", coords });
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Satellite map could not load.";
        const needsApi =
          /not authorized|ApiNotActivated|Maps JavaScript API|REQUEST_DENIED/i.test(
            message,
          );
        if (needsApi) {
          setState({
            status: "needs_api",
            coords,
            message:
              "Enable Maps JavaScript API on this Google Cloud key (keep Maps Static + Routes too) to use zoom and pan here.",
          });
          return;
        }
        setState({ status: "error", message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [school.id, school.location, school.visitAddress]);

  useEffect(() => {
    if (state.status !== "ready" || !mapNode.current || !window.google?.maps) return;

    const { coords } = state;
    const zoom = zoomForRadiusMiles(coords.lat, CAMPUS_MAP_RADIUS_MILES, 720);
    const center = { lat: coords.lat, lng: coords.lng };

    const map = new google.maps.Map(mapNode.current, {
      center,
      zoom,
      mapTypeId: google.maps.MapTypeId.SATELLITE,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
        mapTypeIds: [
          google.maps.MapTypeId.SATELLITE,
          google.maps.MapTypeId.HYBRID,
          google.maps.MapTypeId.ROADMAP,
        ],
      },
      zoomControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM,
      },
      streetViewControl: false,
      fullscreenControl: true,
      scaleControl: true,
      rotateControl: false,
      gestureHandling: "greedy",
      clickableIcons: false,
    });

    new google.maps.Marker({
      map,
      position: center,
      title: school.name,
    });

    new google.maps.Circle({
      map,
      center,
      radius: milesToMeters(CAMPUS_MAP_RADIUS_MILES),
      strokeColor: "#e85504",
      strokeOpacity: 0.9,
      strokeWeight: 2,
      fillColor: "#e85504",
      fillOpacity: 0.08,
      clickable: false,
    });

    mapRef.current = map;

    return () => {
      mapRef.current = null;
    };
  }, [state, school.name]);

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
          Google Satellite · about {CAMPUS_MAP_RADIUS_MILES} mi radius · zoom &amp; pan
        </span>
      </div>

      {state.status === "loading" ? (
        <div className="snapshot-satellite-frame is-loading" role="status">
          Locating campus…
        </div>
      ) : null}

      {state.status === "ready" ? (
        <div className="snapshot-satellite-frame is-interactive">
          <div
            ref={mapNode}
            className="snapshot-satellite-canvas"
            role="application"
            aria-label={`Interactive satellite map of ${school.name} within about ${CAMPUS_MAP_RADIUS_MILES} miles`}
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
          <p>{state.message}</p>
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
