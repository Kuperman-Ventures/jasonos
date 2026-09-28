"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { School } from "@/lib/types";
import {
  CAMPUS_MAP_RADIUS_MILES,
  googleSatelliteMapsHref,
  milesToMeters,
  zoomForRadiusMiles,
} from "@/lib/campus-map";
import { geocodeCityState, type GeoPoint } from "@/lib/visit-geo";
import { parseSchoolLocation } from "@/lib/visit-planning";
import { SchoolMark } from "./SchoolMark";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; coords: GeoPoint }
  | { status: "error"; message: string };

/** Esri World Imagery — no Google Maps JS key required; zoom & pan work. */
const SATELLITE_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

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

export function SchoolCampusSatelliteMap({ school }: { school: School }) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<L.Map | null>(null);
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
      setState({ status: "ready", coords });
    })();

    return () => {
      cancelled = true;
    };
  }, [school.id, school.location, school.visitAddress]);

  useEffect(() => {
    if (state.status !== "ready" || !mapNode.current) return;

    if (leafletRef.current) {
      leafletRef.current.remove();
      leafletRef.current = null;
    }

    // Leaflet requires a clean container (no leftover Google Maps DOM).
    mapNode.current.innerHTML = "";

    const { coords } = state;
    const zoom = zoomForRadiusMiles(coords.lat, CAMPUS_MAP_RADIUS_MILES, 720);
    const map = L.map(mapNode.current, {
      center: [coords.lat, coords.lng],
      zoom,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer(SATELLITE_TILE_URL, {
      attribution:
        "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      maxZoom: 18,
    }).addTo(map);

    L.circle([coords.lat, coords.lng], {
      radius: milesToMeters(CAMPUS_MAP_RADIUS_MILES),
      color: "#e85504",
      weight: 2,
      fillColor: "#e85504",
      fillOpacity: 0.08,
    }).addTo(map);

    L.circleMarker([coords.lat, coords.lng], {
      radius: 6,
      color: "#fff",
      weight: 2,
      fillColor: "#e85504",
      fillOpacity: 1,
    })
      .bindTooltip(school.name, { direction: "top", offset: [0, -8] })
      .addTo(map);

    leafletRef.current = map;
    const t1 = window.setTimeout(() => map.invalidateSize(), 50);
    const t2 = window.setTimeout(() => map.invalidateSize(), 300);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      map.remove();
      leafletRef.current = null;
    };
  }, [state, school.name]);

  const openHref =
    state.status === "ready"
      ? googleSatelliteMapsHref(
          state.coords.lat,
          state.coords.lng,
          zoomForRadiusMiles(state.coords.lat, CAMPUS_MAP_RADIUS_MILES),
        )
      : null;

  return (
    <section className="snapshot-satellite" aria-labelledby="snap-sat-h">
      <div className="snapshot-satellite-school">
        <span className="snapshot-satellite-mark" title={school.name}>
          <SchoolMark name={school.name} website={school.website} />
        </span>
        <b>{school.name}</b>
      </div>
      <div className="snapshot-satellite-head">
        <span className="area-label" id="snap-sat-h">
          Around campus
        </span>
        <span className="snapshot-satellite-meta">
          Satellite · about {CAMPUS_MAP_RADIUS_MILES} mi radius · zoom &amp; pan
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

      {state.status === "error" ? (
        <div className="snapshot-satellite-frame is-fallback">
          <p>{state.message}</p>
        </div>
      ) : null}
    </section>
  );
}
