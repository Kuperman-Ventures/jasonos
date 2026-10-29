"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TripSchoolPoint } from "@/lib/trip-planning";
import type { GeoPoint } from "@/lib/visit-geo";
import { createRoot, type Root } from "react-dom/client";
import { SchoolMark } from "../SchoolMark";

function lineStyle(): L.PolylineOptions {
  return { color: "#e85504", weight: 4, opacity: 1 };
}

function escapeAttr(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

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

function fitBounds(map: L.Map, pts: Array<[number, number]>) {
  if (!pts.length) return;
  ensureMapView(map, pts[0]!, MAP_FALLBACK_ZOOM);
  if (pts.length === 1) {
    map.setView(pts[0]!, 9, { animate: false });
    return;
  }
  map.fitBounds(pts, { padding: [48, 48], maxZoom: 10, animate: false });
}

export function VisitPlanMap({
  pointsById,
  routeOrder,
  routeLegs,
  startPoint,
  endPoint,
  activeSchoolId,
  onActiveSchool,
}: {
  pointsById: Map<string, TripSchoolPoint>;
  /** Full route order including visit-start / visit-end / school: ids. */
  routeOrder: string[];
  routeLegs: (string | null)[];
  startPoint: GeoPoint | null;
  endPoint: GeoPoint | null;
  activeSchoolId: string | null;
  onActiveSchool: (id: string) => void;
}) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const endMarkersRef = useRef<{ start: L.Marker | null; end: L.Marker | null }>({
    start: null,
    end: null,
  });
  const routeLineRef = useRef<L.Polyline | null>(null);
  const legsGroupRef = useRef<L.LayerGroup | null>(null);
  const pinRootsRef = useRef<Map<string, Root>>(new Map());

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
      endMarkersRef.current = { start: null, end: null };
      routeLineRef.current = null;
      legsGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const keep = new Set(pointsById.keys());
    for (const [id, marker] of markersRef.current) {
      if (!keep.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
        pinRootsRef.current.get(id)?.unmount();
        pinRootsRef.current.delete(id);
      }
    }

    for (const [id, point] of pointsById) {
      const containerId = `visit-plan-pin-${id}`;
      let marker = markersRef.current.get(id);
      const html = `<div class="trip-pin${point.interest === "none" ? " none" : ""}${
        id === activeSchoolId ? " live" : ""
      }" data-level="${point.interest}" id="${containerId}" title="${escapeAttr(
        point.name,
      )}"></div>`;
      if (!marker) {
        marker = L.marker([point.lat, point.lng], {
          icon: L.divIcon({ className: "", html, iconSize: undefined }),
          riseOnHover: true,
          zIndexOffset: id === activeSchoolId ? 2000 : 0,
        }).addTo(map);
        markersRef.current.set(id, marker);
        requestAnimationFrame(() => {
          const el = document.getElementById(containerId);
          if (!el) return;
          const root = createRoot(el);
          pinRootsRef.current.set(id, root);
          root.render(<SchoolMark name={point.name} website={point.website} />);
        });
      } else {
        marker.setLatLng([point.lat, point.lng]);
        const pin = marker.getElement()?.firstElementChild as HTMLElement | null;
        if (pin) {
          pin.classList.toggle("live", id === activeSchoolId);
          pin.dataset.level = point.interest;
        }
        marker.setZIndexOffset(id === activeSchoolId ? 2000 : 0);
        pinRootsRef.current
          .get(id)
          ?.render(<SchoolMark name={point.name} website={point.website} />);
      }

      marker.off("mouseover");
      marker.on("mouseover", () => onActiveSchool(id));
    }

    const syncEnd = (
      kind: "start" | "end",
      point: GeoPoint | null,
      label: string,
    ) => {
      if (!point) {
        endMarkersRef.current[kind]?.remove();
        endMarkersRef.current[kind] = null;
        return;
      }
      const html = `<div class="trip-pin air">${escapeAttr(label)}</div>`;
      let marker = endMarkersRef.current[kind];
      if (!marker) {
        marker = L.marker([point.lat, point.lng], {
          icon: L.divIcon({ className: "", html, iconSize: undefined }),
          interactive: false,
          zIndexOffset: 1500,
        }).addTo(map);
        endMarkersRef.current[kind] = marker;
      } else {
        marker.setLatLng([point.lat, point.lng]);
        marker.setIcon(L.divIcon({ className: "", html, iconSize: undefined }));
      }
    };
    syncEnd("start", startPoint, "Start");
    syncEnd("end", endPoint, "End");

    const latLngForRouteId = (id: string): [number, number] | null => {
      if (id === "visit-start" && startPoint) return [startPoint.lat, startPoint.lng];
      if (id === "visit-end" && endPoint) return [endPoint.lat, endPoint.lng];
      if (id.startsWith("school:")) {
        const point = pointsById.get(id.slice("school:".length));
        return point ? [point.lat, point.lng] : null;
      }
      return null;
    };

    const routePts = routeOrder
      .map(latLngForRouteId)
      .filter((p): p is [number, number] => Boolean(p));

    if (routePts.length >= 2) {
      if (!routeLineRef.current) {
        routeLineRef.current = L.polyline(routePts, lineStyle()).addTo(map);
      } else {
        routeLineRef.current.setLatLngs(routePts);
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

    const fitPts: Array<[number, number]> = [
      ...[...pointsById.values()].map((p) => [p.lat, p.lng] as [number, number]),
    ];
    if (startPoint) fitPts.push([startPoint.lat, startPoint.lng]);
    if (endPoint) fitPts.push([endPoint.lat, endPoint.lng]);
    fitBounds(map, fitPts);
    map.invalidateSize();
  }, [
    pointsById,
    routeOrder,
    routeLegs,
    startPoint,
    endPoint,
    activeSchoolId,
    onActiveSchool,
  ]);

  return (
    <div ref={mapEl} className="trip-vmap visit-plan-map" aria-label="Visit plan map" />
  );
}
