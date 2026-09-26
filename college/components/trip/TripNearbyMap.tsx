"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  clusterLegLabels,
  clusterPolylinePoints,
  tripInterestLabel,
  type TripCluster,
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
  clusters,
  pointsById,
  clusterIds,
  activeClusterId,
  airport,
  onActiveCluster,
  onToggleCluster,
}: {
  schoolId: string;
  clusters: TripCluster[];
  pointsById: Map<string, TripSchoolPoint>;
  clusterIds: string[];
  activeClusterId: string;
  airport: { iata: string; lat: number; lng: number };
  onActiveCluster: (id: string) => void;
  onToggleCluster: (id: string) => void;
}) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const linesRef = useRef<Map<string, L.Polyline>>(new Map());
  const legsRef = useRef<Map<string, L.LayerGroup>>(new Map());
  const airRef = useRef<L.Marker | null>(null);
  const pinRootsRef = useRef<Map<string, Root>>(new Map());
  const propsRef = useRef({
    schoolId,
    clusters,
    pointsById,
    clusterIds,
    activeClusterId,
    airport,
    onActiveCluster,
    onToggleCluster,
  });
  propsRef.current = {
    schoolId,
    clusters,
    pointsById,
    clusterIds,
    activeClusterId,
    airport,
    onActiveCluster,
    onToggleCluster,
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
      linesRef.current.clear();
      legsRef.current.clear();
      airRef.current = null;
    };
  }, []);

  // Sync markers, lines, airport when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Markers
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

      // Mount SchoolMark into pin after DOM insert
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

      const cluster =
        clusters.find((c) => c.stops.some((s) => s.schoolId === id)) ?? clusters[0];
      if (cluster) {
        const pressed = clusterIds.includes(cluster.id);
        marker.bindPopup(
          () => {
            const wrap = document.createElement("div");
            wrap.className = "trip-pop";
            wrap.innerHTML = `<b>${escapeAttr(point.name)}</b><span>${escapeAttr(
              tripInterestLabel(point.interest === "none" ? "" : point.interest),
            )}${id === schoolId ? " · viewing" : ""}</span><span>${escapeAttr(
              cluster.name,
            )} · ${escapeAttr(cluster.sub)}</span>`;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "trip-inc";
            btn.setAttribute("aria-pressed", pressed ? "true" : "false");
            btn.textContent = pressed
              ? "In trip ✓"
              : `Add ${cluster.name.toLowerCase()} to trip`;
            btn.addEventListener("click", () => {
              propsRef.current.onToggleCluster(cluster.id);
              map.closePopup();
            });
            wrap.appendChild(btn);
            return wrap;
          },
          { closeButton: false, offset: [0, -8] },
        );
      }
    }

    // Airport
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

    // Polylines
    for (const [id, line] of linesRef.current) {
      if (!clusters.some((c) => c.id === id)) {
        line.remove();
        linesRef.current.delete(id);
        legsRef.current.get(id)?.remove();
        legsRef.current.delete(id);
      }
    }

    for (const cluster of clusters) {
      const pts = clusterPolylinePoints(cluster, pointsById);
      if (pts.length < 2) continue;
      let line = linesRef.current.get(cluster.id);
      if (!line) {
        line = L.polyline(pts, lineStyle(false)).addTo(map);
        line.on("mouseover", () => {
          if (cluster.id !== propsRef.current.activeClusterId) {
            propsRef.current.onActiveCluster(cluster.id);
          }
        });
        linesRef.current.set(cluster.id, line);
      } else {
        line.setLatLngs(pts);
      }

      const legs = clusterLegLabels(cluster);
      const markers = legs
        .map((label, i) => {
          if (!label) return null;
          const a = pts[i];
          const b = pts[i + 1];
          if (!a || !b) return null;
          const f = cluster.at[i] ?? 0.5;
          return L.marker(
            [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f],
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
      const group = L.layerGroup(markers);
      legsRef.current.get(cluster.id)?.remove();
      legsRef.current.set(cluster.id, group);
    }

    map.invalidateSize();
  }, [schoolId, clusters, pointsById, clusterIds, airport]);

  // Active cluster styling / fly
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const active = clusters.find((c) => c.id === activeClusterId);
    for (const cluster of clusters) {
      const on = cluster.id === activeClusterId;
      const line = linesRef.current.get(cluster.id);
      if (line) {
        line.setStyle(lineStyle(on));
        if (on) {
          line.bringToFront();
          legsRef.current.get(cluster.id)?.addTo(map);
        } else {
          legsRef.current.get(cluster.id)?.remove();
        }
      }
    }
    const keep = new Set(
      active
        ? [...active.stops.map((s) => s.schoolId), active.fromId].filter(Boolean)
        : [],
    );
    for (const [id, marker] of markersRef.current) {
      const pin = marker.getElement()?.firstElementChild;
      pin?.classList.toggle("dim", keep.size > 0 && !keep.has(id));
    }
    if (active) {
      const pts = clusterPolylinePoints(active, pointsById);
      if (pts.length) {
        flyToPointBounds(map, pts, {
          padding: [70, 70],
          duration: 0.6,
          maxZoom: 12,
        });
      }
    }
  }, [activeClusterId, clusters, pointsById]);

  return (
    <div
      ref={mapEl}
      className="trip-vmap"
      aria-label="Map of nearby schools"
    />
  );
}
