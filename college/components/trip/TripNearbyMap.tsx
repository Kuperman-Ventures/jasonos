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

function lineStyle(on: boolean): L.PolylineOptions {
  const ink =
    typeof document !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--color-text").trim() ||
        "#201e1d"
      : "#201e1d";
  return on
    ? { color: "#e85504", weight: 4, opacity: 1, dashArray: undefined }
    : { color: ink, weight: 2, opacity: 0.35, dashArray: "4 6" };
}

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

function flyToPointBounds(
  map: L.Map,
  pts: Array<[number, number]>,
  options: L.FitBoundsOptions & { duration?: number },
) {
  if (!pts.length) return;
  ensureMapView(map, pts[0]!, MAP_FALLBACK_ZOOM);
  map.flyToBounds(pts, options);
}

export function TripNearbyMap({
  schoolId,
  pointsById,
  schoolIds,
  routeOrder,
  routeLegs,
  activeSchoolId,
  airport,
  onActiveSchool,
  onToggleSchool,
}: {
  schoolId: string;
  pointsById: Map<string, TripSchoolPoint>;
  schoolIds: string[];
  /** Visiting order for the orange route line (school ids). */
  routeOrder: string[];
  /** Drive labels between consecutive route stops (same length as routeOrder − 1). */
  routeLegs: (string | null)[];
  activeSchoolId: string;
  airport: { iata: string; lat: number; lng: number };
  onActiveSchool: (id: string) => void;
  onToggleSchool: (id: string) => void;
}) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLineRef = useRef<L.Polyline | null>(null);
  const legsGroupRef = useRef<L.LayerGroup | null>(null);
  const airRef = useRef<L.Marker | null>(null);
  const pinRootsRef = useRef<Map<string, Root>>(new Map());
  const propsRef = useRef({
    schoolId,
    pointsById,
    schoolIds,
    routeOrder,
    routeLegs,
    activeSchoolId,
    airport,
    onActiveSchool,
    onToggleSchool,
  });
  propsRef.current = {
    schoolId,
    pointsById,
    schoolIds,
    routeOrder,
    routeLegs,
    activeSchoolId,
    airport,
    onActiveSchool,
    onToggleSchool,
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

    map.on("zoomend", () => {
      const air = airRef.current;
      if (!air || !mapIsReady(map)) return;
      if (map.getZoom() >= 10.5) air.addTo(map);
      else air.remove();
    });

    mapEl.current.addEventListener("dblclick", () => {
      const pts = [...propsRef.current.pointsById.values()].map(
        (p) => [p.lat, p.lng] as [number, number],
      );
      if (pts.length) {
        flyToPointBounds(map, pts, { padding: [28, 28], duration: 0.6 });
      }
    });

    return () => {
      for (const root of pinRootsRef.current.values()) root.unmount();
      pinRootsRef.current.clear();
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      routeLineRef.current = null;
      legsGroupRef.current = null;
      airRef.current = null;
    };
  }, []);

  // Sync markers, route, airport when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const inTrip = new Set(schoolIds);

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
        marker.setIcon(
          L.divIcon({
            className: "",
            html: pinHtml(point, id === schoolId, containerId),
            iconSize: undefined,
          }),
        );
      }

      requestAnimationFrame(() => {
        const el = document.getElementById(containerId);
        if (!el) return;
        let root = pinRootsRef.current.get(id);
        if (!root) {
          root = createRoot(el);
          pinRootsRef.current.set(id, root);
        }
        root.render(<SchoolMark name={point.name} website={point.website} />);
      });

      const pressed = inTrip.has(id);
      const driveHint =
        id === schoolId
          ? "Viewing"
          : tripInterestLabel(point.interest === "none" ? "" : point.interest);
      marker.bindPopup(
        () => {
          const wrap = document.createElement("div");
          wrap.className = "trip-pop";
          wrap.innerHTML = `<b>${escapeAttr(point.name)}</b><span>${escapeAttr(
            driveHint,
          )}${id === schoolId ? " · this school" : ""}</span>`;
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "trip-inc";
          btn.setAttribute("aria-pressed", pressed ? "true" : "false");
          btn.textContent = pressed ? "In trip ✓" : "Add to trip";
          btn.addEventListener("click", () => {
            propsRef.current.onToggleSchool(id);
            map.closePopup();
          });
          wrap.appendChild(btn);
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

      const pin = marker.getElement()?.firstElementChild;
      pin?.classList.toggle("dim", schoolIds.length > 0 && !inTrip.has(id));
    }

    if (airport.iata !== "—" && airport.lat && airport.lng) {
      if (!airRef.current) {
        airRef.current = L.marker([airport.lat, airport.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div class="trip-pin air">${escapeAttr(airport.iata)}</div>`,
            iconSize: undefined,
          }),
          interactive: false,
        });
      } else {
        airRef.current.setLatLng([airport.lat, airport.lng]);
        airRef.current.setIcon(
          L.divIcon({
            className: "",
            html: `<div class="trip-pin air">${escapeAttr(airport.iata)}</div>`,
            iconSize: undefined,
          }),
        );
      }
      if (mapIsReady(map) && map.getZoom() >= 10.5) airRef.current.addTo(map);
    }

    const routePts = routeOrder
      .map((id) => pointsById.get(id))
      .filter((p): p is TripSchoolPoint => Boolean(p))
      .map((p) => [p.lat, p.lng] as [number, number]);

    if (routePts.length >= 2) {
      if (!routeLineRef.current) {
        routeLineRef.current = L.polyline(routePts, lineStyle(true)).addTo(map);
      } else {
        routeLineRef.current.setLatLngs(routePts);
        routeLineRef.current.setStyle(lineStyle(true));
        if (!map.hasLayer(routeLineRef.current)) routeLineRef.current.addTo(map);
      }
      routeLineRef.current.bringToFront();

      const markers = routeLegs
        .map((label, i) => {
          if (!label) return null;
          const a = routePts[i];
          const b = routePts[i + 1];
          if (!a || !b) return null;
          return L.marker(
            [a[0] + (b[0] - a[0]) * 0.5, a[1] + (b[1] - a[1]) * 0.5],
            {
              icon: L.divIcon({
                className: "",
                html: `<div class="trip-leg">${escapeAttr(label)}</div>`,
                iconSize: undefined,
              }),
              interactive: false,
            },
          );
        })
        .filter((m): m is L.Marker => Boolean(m));
      legsGroupRef.current?.remove();
      legsGroupRef.current = L.layerGroup(markers).addTo(map);
    } else {
      routeLineRef.current?.remove();
      legsGroupRef.current?.remove();
      legsGroupRef.current = null;
    }

    map.invalidateSize();
  }, [schoolId, pointsById, schoolIds, routeOrder, routeLegs, airport]);

  // Fly to active school (or full route when focusing the base with multiple stops)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const active = pointsById.get(activeSchoolId);
    if (!active) return;
    const routePts = routeOrder
      .map((id) => pointsById.get(id))
      .filter((p): p is TripSchoolPoint => Boolean(p))
      .map((p) => [p.lat, p.lng] as [number, number]);
    if (activeSchoolId === schoolId && routePts.length >= 2) {
      flyToPointBounds(map, routePts, {
        padding: [70, 70],
        duration: 0.6,
        maxZoom: 12,
      });
      return;
    }
    flyToPointBounds(map, [[active.lat, active.lng]], {
      padding: [70, 70],
      duration: 0.5,
      maxZoom: 11,
    });
  }, [activeSchoolId, pointsById, routeOrder, schoolId]);

  return (
    <div
      ref={mapEl}
      className="trip-vmap"
      aria-label="Map of nearby schools"
    />
  );
}
