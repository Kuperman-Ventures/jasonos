"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  tripInterestLabel,
  type TripSchoolPoint,
} from "@/lib/trip-planning";
import { createRoot, type Root } from "react-dom/client";
import { SchoolMark } from "../SchoolMark";

function pinHtml(
  point: TripSchoolPoint,
  here: boolean,
  containerId: string,
): string {
  const none = point.interest === "none" ? " none" : "";
  const hereCls = here ? " here" : "";
  const nudge = point.nudge ? `margin-left:${point.nudge}px;` : "";
  return `<div class="trip-pin${none}${hereCls}" data-level="${point.interest}" style="${nudge}" title="${escapeAttr(
    point.name,
  )}" id="${containerId}"></div>`;
}

function escapeAttr(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Continental US fallback so Leaflet is loaded before flyToBounds. */
const MAP_FALLBACK_CENTER: L.LatLngExpression = [39.5, -98.35];
const MAP_FALLBACK_ZOOM = 4;

function mapIsReady(map: L.Map): boolean {
  try {
    map.getCenter();
    return true;
  } catch {
    return false;
  }
}

function ensureMapView(map: L.Map, center: L.LatLngExpression, zoom: number) {
  if (!mapIsReady(map)) map.setView(center, zoom, { animate: false });
}

/** Fit once to every nearby pin — no animated zoom on hover/select. */
function fitNearbyBounds(map: L.Map, pts: Array<[number, number]>) {
  if (!pts.length) return;
  ensureMapView(map, pts[0]!, MAP_FALLBACK_ZOOM);
  if (pts.length === 1) {
    map.setView(pts[0]!, 10, { animate: false });
    return;
  }
  map.fitBounds(pts, {
    padding: [48, 48],
    maxZoom: 11,
    animate: false,
  });
}

export function TripNearbyMap({
  schoolId,
  pointsById,
  activeSchoolId,
  airports,
  onActiveSchool,
}: {
  schoolId: string;
  pointsById: Map<string, TripSchoolPoint>;
  activeSchoolId: string;
  /** Local airports near this campus (not home → fly). */
  airports: Array<{ iata: string; lat: number; lng: number }>;
  onActiveSchool: (id: string) => void;
}) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const airGroupRef = useRef<L.LayerGroup | null>(null);
  const pinRootsRef = useRef<Map<string, Root>>(new Map());
  const propsRef = useRef({
    schoolId,
    pointsById,
    activeSchoolId,
    airports,
    onActiveSchool,
  });
  propsRef.current = {
    schoolId,
    pointsById,
    activeSchoolId,
    airports,
    onActiveSchool,
  };

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, {
      scrollWheelZoom: false,
      doubleClickZoom: false,
      zoomSnap: 0.25,
      center: MAP_FALLBACK_CENTER,
      zoom: MAP_FALLBACK_ZOOM,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      for (const root of pinRootsRef.current.values()) root.unmount();
      pinRootsRef.current.clear();
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      airGroupRef.current = null;
    };
  }, []);

  // Sync markers + airports when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const keep = new Set(pointsById.keys());
    for (const [id, marker] of markersRef.current) {
      if (!keep.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
        const root = pinRootsRef.current.get(id);
        root?.unmount();
        pinRootsRef.current.delete(id);
      }
    }

    for (const [id, point] of pointsById) {
      let marker = markersRef.current.get(id);
      const containerId = `trip-pin-${id}`;
      const isNew = !marker;
      if (!marker) {
        marker = L.marker([point.lat, point.lng], {
          icon: L.divIcon({
            className: "",
            html: pinHtml(point, id === schoolId, containerId),
            iconSize: undefined,
          }),
          riseOnHover: true,
          zIndexOffset: id === schoolId ? 1000 : 0,
        }).addTo(map);
        markersRef.current.set(id, marker);
      } else {
        marker.setLatLng([point.lat, point.lng]);
      }

      const mountMark = () => {
        const el = document.getElementById(containerId);
        if (!el) return;
        let root = pinRootsRef.current.get(id);
        if (!root) {
          root = createRoot(el);
          pinRootsRef.current.set(id, root);
        }
        root.render(<SchoolMark name={point.name} website={point.website} />);
      };
      if (isNew) requestAnimationFrame(mountMark);
      else mountMark();

      const driveHint =
        id === schoolId
          ? "Campus hub"
          : tripInterestLabel(point.interest === "none" ? "" : point.interest);
      marker.bindPopup(
        () => {
          const wrap = document.createElement("div");
          wrap.className = "trip-pop";
          wrap.innerHTML = `<b>${escapeAttr(point.name)}</b><span>${escapeAttr(
            driveHint,
          )}${id === schoolId ? " · you’re here" : ""}</span>`;
          return wrap;
        },
        { closeButton: false, offset: [0, -8] },
      );

      marker.off("mouseover");
      marker.on("mouseover", () => {
        if (id !== propsRef.current.activeSchoolId) {
          propsRef.current.onActiveSchool(id);
        }
      });

      const pin = marker.getElement()?.firstElementChild as HTMLElement | null;
      if (pin) {
        const live = id === propsRef.current.activeSchoolId;
        pin.dataset.level = point.interest;
        pin.classList.toggle("none", point.interest === "none");
        pin.classList.toggle("here", id === schoolId);
        pin.classList.toggle("dim", false);
        pin.classList.toggle("live", live);
        if (point.nudge) pin.style.marginLeft = `${point.nudge}px`;
        else pin.style.marginLeft = "";
        pin.title = point.name;
      }
    }

    airGroupRef.current?.remove();
    const airMarkers = airports
      .filter((airport) => airport.iata && airport.lat && airport.lng)
      .map((airport) =>
        L.marker([airport.lat, airport.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div class="trip-pin air">${escapeAttr(airport.iata)}</div>`,
            iconSize: undefined,
          }),
          interactive: false,
          zIndexOffset: -200,
        }),
      );
    airGroupRef.current = airMarkers.length
      ? L.layerGroup(airMarkers).addTo(map)
      : null;

    map.invalidateSize();
  }, [schoolId, pointsById, airports]);

  // Fit once around the hub + nearby pins — no zoom on hover/select.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const hub = pointsById.get(schoolId);
    const nearbyPts = [...pointsById.values()].map(
      (p) => [p.lat, p.lng] as [number, number],
    );
    if (hub && nearbyPts.length > 1) {
      ensureMapView(map, [hub.lat, hub.lng], MAP_FALLBACK_ZOOM);
      map.fitBounds(nearbyPts, {
        padding: [56, 56],
        maxZoom: 11,
        animate: false,
      });
      return;
    }
    fitNearbyBounds(map, nearbyPts);
  }, [schoolId, pointsById]);

  // Hover / list focus: wake the pin without changing zoom.
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const pin = marker.getElement()?.firstElementChild as HTMLElement | null;
      if (!pin) continue;
      const live = id === activeSchoolId;
      pin.classList.toggle("live", live);
      marker.setZIndexOffset(live ? 2000 : id === schoolId ? 1000 : 0);
    }
  }, [activeSchoolId, schoolId]);

  return (
    <div
      ref={mapEl}
      className="trip-vmap"
      aria-label="Map of nearby schools"
    />
  );
}
