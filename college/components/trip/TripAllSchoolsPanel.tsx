"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import type { School } from "@/lib/types";
import type { GeoPoint } from "@/lib/visit-geo";
import { shortSchoolName } from "@/lib/visit-planning";
import {
  KYLE_STUDENT,
  TRIP_INTEREST_LABEL,
  TRIP_INTEREST_ORDER,
  TRIP_REGIONS,
  appendRegionRouteStop,
  buildRegionDots,
  buildRegionRouteLegs,
  formatRegionRouteLeg,
  formatRegionRouteTotal,
  tripInterestLabel,
  type RegionSchoolDot,
  type TripInterestKey,
  type TripRegionId,
} from "@/lib/trip-planning";

const WORLD_ATLAS_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";

const W = 700;
const H = 440;
const PAD = 15;
const DETAIL_PAD = 48;
const DETAIL_ZOOM_MIN = 1;
const DETAIL_ZOOM_MAX = 8;

// world-atlas countries-110m shape (loose typing — topojson Topology generics vary by package).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TopoCountries = any;

let worldAtlasCache: TopoCountries | null = null;
let worldAtlasPromise: Promise<TopoCountries> | null = null;

async function loadWorldAtlas(): Promise<TopoCountries> {
  if (worldAtlasCache) return worldAtlasCache;
  if (!worldAtlasPromise) {
    worldAtlasPromise = fetch(WORLD_ATLAS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Atlas HTTP ${res.status}`);
        return res.json() as Promise<TopoCountries>;
      })
      .then((topo) => {
        worldAtlasCache = topo;
        return topo;
      })
      .catch((error) => {
        worldAtlasPromise = null;
        throw error;
      });
  }
  return worldAtlasPromise;
}

function levelFill(lv: TripInterestKey): string {
  if (lv === "top") return "var(--lvl-4)";
  if (lv === "high") return "var(--lvl-3)";
  if (lv === "moderate") return "var(--lvl-2)";
  if (lv === "safety") return "var(--lvl-1)";
  return "var(--color-bg)";
}

export function TripAllSchoolsPanel({
  schoolId,
  listSchools,
  coordsById,
}: {
  schoolId: string;
  listSchools: School[];
  coordsById: Map<string, GeoPoint | null>;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [focus, setFocus] = useState<TripRegionId | null>(null);
  const [detailRegion, setDetailRegion] = useState<TripRegionId | null>(null);
  const [chain, setChain] = useState<string[]>([]);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const detailRef = useRef<TripRegionId | null>(null);
  const chainRef = useRef<string[]>([]);
  const openRegionRef = useRef<(regionId: TripRegionId) => void>(() => {});
  const pickSchoolRef = useRef<(id: string) => void>(() => {});
  const detailZoomRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const detailZoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(
    null,
  );
  const detailZoomRegionRef = useRef<TripRegionId | null>(null);
  detailRef.current = detailRegion;
  chainRef.current = chain;

  const highlight = detailRegion ?? focus;

  const live = useMemo(
    () => listSchools.filter((s) => !s.archived),
    [listSchools],
  );
  const dots = useMemo(
    () => buildRegionDots(live, coordsById),
    [live, coordsById],
  );
  const current = live.find((s) => s.id === schoolId);
  const namesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const school of live) map.set(school.id, school.name);
    return map;
  }, [live]);

  const regionLists = useMemo(() => {
    return TRIP_REGIONS.map((region) => ({
      ...region,
      schools: dots
        .filter((d) => d.region === region.id)
        .slice()
        .sort(
          (a, b) =>
            TRIP_INTEREST_ORDER.indexOf(a.interest) -
            TRIP_INTEREST_ORDER.indexOf(b.interest),
        ),
    }));
  }, [dots]);

  const detailSchools = useMemo(
    () => (detailRegion ? dots.filter((d) => d.region === detailRegion) : []),
    [dots, detailRegion],
  );

  const route = useMemo(
    () => buildRegionRouteLegs(chain, namesById),
    [chain, namesById],
  );

  function openRegion(regionId: TripRegionId) {
    setDetailRegion((current) => {
      if (current === regionId) {
        setChain([]);
        detailZoomRef.current = d3.zoomIdentity;
        detailZoomRegionRef.current = null;
        return null;
      }
      setChain([]);
      detailZoomRef.current = d3.zoomIdentity;
      detailZoomRegionRef.current = regionId;
      return regionId;
    });
    setFocus(regionId);
  }

  function pickSchool(id: string) {
    setChain((current) => appendRegionRouteStop(current, id));
  }

  function resetDetailView() {
    const svg = svgRef.current;
    const zoom = detailZoomBehaviorRef.current;
    detailZoomRef.current = d3.zoomIdentity;
    if (svg && zoom) {
      d3.select(svg).transition().duration(200).call(zoom.transform, d3.zoomIdentity);
    }
  }

  function nudgeDetailZoom(direction: 1 | -1) {
    const svg = svgRef.current;
    const zoom = detailZoomBehaviorRef.current;
    if (!svg || !zoom) return;
    const factor = direction > 0 ? 1.4 : 1 / 1.4;
    d3.select(svg).transition().duration(180).call(zoom.scaleBy, factor);
  }

  openRegionRef.current = openRegion;
  pickSchoolRef.current = pickSchool;

  // National overview map
  useEffect(() => {
    if (detailRegion) return;
    let cancelled = false;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    setReady(false);
    setLoadError(false);

    void (async () => {
      let topo: TopoCountries;
      try {
        topo = await loadWorldAtlas();
      } catch {
        if (!cancelled) setLoadError(true);
        return;
      }
      if (cancelled || !svgRef.current) return;

      const collection = feature(topo, topo.objects.countries) as unknown as {
        type: "FeatureCollection";
        features: Array<{
          id?: string | number;
          type: string;
          geometry: unknown;
          properties: unknown;
        }>;
      };
      const feats = collection.features;
      const proj = d3
        .geoAlbers()
        .parallels([29.5, 45.5])
        .rotate([96, 0])
        .fitExtent(
          [
            [28, 28],
            [W - 28, H - 28],
          ],
          {
            type: "MultiPoint",
            coordinates: [
              [-124.6, 48.4],
              [-67.2, 44.8],
              [-80.2, 25.2],
              [-117.1, 32.5],
              [-97.4, 25.9],
              [-95, 49],
            ],
          },
        );
      const path = d3.geoPath(proj);
      const g = svg.append("g");

      g.selectAll("path.land-o")
        .data(
          feats.filter((f: { id?: string | number }) =>
            ["124", "484"].includes(String(f.id)),
          ),
        )
        .join("path")
        .attr("class", "land-o")
        .attr("d", (d) => path(d as d3.GeoPermissibleObjects) ?? "");

      const us = feats.find((f: { id?: string | number }) => String(f.id) === "840");
      if (us) {
        g.append("path")
          .datum(us)
          .attr("class", "land-us")
          .attr("d", (d) => path(d as d3.GeoPermissibleObjects) ?? "");
      }

      type DotXY = RegionSchoolDot & { xy: [number, number] };
      const projected: DotXY[] = dots
        .map((d) => {
          const xy = proj([d.lng, d.lat]);
          if (!xy) return null;
          return { ...d, xy: xy as [number, number] };
        })
        .filter((d): d is DotXY => Boolean(d));

      const line = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5));
      const rg = g.append("g");
      const regionEls = new Map<
        string,
        {
          path: d3.Selection<SVGPathElement, unknown, null, undefined>;
          lab: d3.Selection<SVGTextElement, unknown, null, undefined>;
        }
      >();

      for (const region of TRIP_REGIONS) {
        const pts = projected.filter((s) => s.region === region.id).map((s) => s.xy);
        if (pts.length < 1) continue;
        const ring = pts.flatMap(([x, y]) =>
          d3.range(16).map((a) => [
            x + PAD * Math.cos((a / 8) * Math.PI),
            y + PAD * Math.sin((a / 8) * Math.PI),
          ]),
        );
        const hull = d3.polygonHull(ring as [number, number][]);
        if (!hull) continue;
        const el = rg
          .append("path")
          .attr("class", "region")
          .attr("d", line(hull))
          .style("cursor", "pointer")
          .on("mouseenter", () => setFocus(region.id))
          .on("mouseleave", () => {
            if (!detailRef.current) setFocus(null);
          })
          .on("click", (event) => {
            event.stopPropagation();
            openRegionRef.current(region.id);
          });
        const xs = hull.map((p) => p[0]);
        const ys = hull.map((p) => p[1]);
        const x0 = d3.min(xs) ?? 0;
        const x1 = d3.max(xs) ?? 0;
        const y0 = d3.min(ys) ?? 0;
        const y1 = d3.max(ys) ?? 0;
        const mx = (x0 + x1) / 2;
        const my = (y0 + y1) / 2;
        const pos = {
          top: [mx, y0 - 6, "middle"],
          bottom: [mx, y1 + 14, "middle"],
          left: [x0 - 6, my + 4, "end"],
          right: [x1 + 6, my + 4, "start"],
        }[region.at] as [number, number, string];
        const lab = rg
          .append("text")
          .attr("class", "rlabel")
          .attr("x", pos[0])
          .attr("y", pos[1])
          .attr("text-anchor", pos[2])
          .text(region.id);
        regionEls.set(region.id, { path: el, lab });
      }

      const hp = proj([KYLE_STUDENT.homeLng, KYLE_STUDENT.homeLat]);
      if (hp) {
        g.append("rect")
          .attr("class", "home")
          .attr("x", hp[0] - 5)
          .attr("y", hp[1] - 5)
          .attr("width", 10)
          .attr("height", 10)
          .attr("transform", `rotate(45 ${hp[0]} ${hp[1]})`);
        g.append("text")
          .attr("class", "home-l")
          .attr("x", hp[0] - 9)
          .attr("y", hp[1] + 4)
          .attr("text-anchor", "end")
          .text("Home");
      }

      const sorted = projected
        .slice()
        .sort(
          (a, b) =>
            TRIP_INTEREST_ORDER.indexOf(b.interest) -
            TRIP_INTEREST_ORDER.indexOf(a.interest),
        );

      g.selectAll("circle.dot")
        .data(sorted)
        .join("circle")
        .attr("class", (d) => `dot${d.id === schoolId ? " here" : ""}`)
        .attr("cx", (d) => d.xy[0])
        .attr("cy", (d) => d.xy[1])
        .attr("r", (d) => (d.id === schoolId ? 8 : 6.5))
        .style("fill", (d) => levelFill(d.interest))
        .attr(
          "title",
          (d) =>
            `${d.name} · ${tripInterestLabel(d.interest === "none" ? "" : d.interest)}`,
        )
        .on("mouseenter", (_event, d) => {
          const node = svgRef.current;
          if (!node) return;
          const rect = node.getBoundingClientRect();
          setTip({
            x: (d.xy[0] / W) * rect.width,
            y: (d.xy[1] / H) * rect.height,
            text: `${d.name} · ${TRIP_INTEREST_LABEL[d.interest]}`,
          });
        })
        .on("mouseleave", () => setTip(null))
        .on("click", (event, d) => {
          event.stopPropagation();
          openRegionRef.current(d.region);
        });

      (svgRef.current as SVGSVGElement & { __regionEls?: typeof regionEls }).__regionEls =
        regionEls;
      if (!cancelled && !detailRef.current) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [dots, schoolId, detailRegion]);

  // Region detail map (labels + route chain + pan/zoom)
  useEffect(() => {
    if (!detailRegion) {
      detailZoomBehaviorRef.current = null;
      return;
    }
    let cancelled = false;
    const initialNode = svgRef.current;
    if (initialNode) {
      const clear = d3.select(initialNode);
      clear.selectAll("*").remove();
      clear.on(".zoom", null);
    }
    setReady(false);
    setLoadError(false);
    setTip(null);

    if (detailZoomRegionRef.current !== detailRegion) {
      detailZoomRef.current = d3.zoomIdentity;
      detailZoomRegionRef.current = detailRegion;
    }

    void (async () => {
      let topo: TopoCountries;
      try {
        topo = await loadWorldAtlas();
      } catch {
        if (!cancelled) setLoadError(true);
        return;
      }
      const svgNode = svgRef.current;
      if (cancelled || !svgNode) return;
      const svg = d3.select(svgNode);

      const regionDots = dots.filter((d) => d.region === detailRegion);
      if (!regionDots.length) {
        setReady(true);
        return;
      }

      const collection = feature(topo, topo.objects.countries) as unknown as {
        type: "FeatureCollection";
        features: Array<{ id?: string | number }>;
      };
      const feats = collection.features;
      const coords = regionDots.map((d) => [d.lng, d.lat] as [number, number]);
      const proj = d3
        .geoAlbers()
        .parallels([29.5, 45.5])
        .rotate([96, 0])
        .fitExtent(
          [
            [DETAIL_PAD, DETAIL_PAD],
            [W - DETAIL_PAD, H - DETAIL_PAD],
          ],
          { type: "MultiPoint", coordinates: coords },
        );
      const path = d3.geoPath(proj);
      const g = svg.append("g").attr("class", "trip-region-zoom");

      g.selectAll("path.land-o")
        .data(feats.filter((f) => ["124", "484"].includes(String(f.id))))
        .join("path")
        .attr("class", "land-o")
        .attr("d", (d) => path(d as d3.GeoPermissibleObjects) ?? "");

      const us = feats.find((f) => String(f.id) === "840");
      if (us) {
        g.append("path")
          .datum(us)
          .attr("class", "land-us")
          .attr("d", (d) => path(d as d3.GeoPermissibleObjects) ?? "");
      }

      type DotXY = RegionSchoolDot & { xy: [number, number] };
      const projected: DotXY[] = regionDots
        .map((d) => {
          const xy = proj([d.lng, d.lat]);
          if (!xy) return null;
          return { ...d, xy: xy as [number, number] };
        })
        .filter((d): d is DotXY => Boolean(d));

      const byId = new Map(projected.map((d) => [d.id, d]));
      const chainIds = chainRef.current;
      const chainPts = chainIds
        .map((id) => byId.get(id)?.xy)
        .filter((xy): xy is [number, number] => Boolean(xy));

      if (chainPts.length >= 2) {
        g.append("path")
          .attr("class", "trip-region-route")
          .attr("d", d3.line()(chainPts) ?? "");
      }

      const routeSummary = buildRegionRouteLegs(chainIds, namesById);
      for (let i = 0; i < routeSummary.legs.length; i++) {
        const leg = routeSummary.legs[i]!;
        const a = byId.get(leg.fromId)?.xy;
        const b = byId.get(leg.toId)?.xy;
        if (!a || !b) continue;
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        g.append("text")
          .attr("class", "trip-region-leg")
          .attr("x", mx)
          .attr("y", my - 6)
          .attr("text-anchor", "middle")
          .text(formatRegionRouteLeg(leg));
      }

      const sorted = projected
        .slice()
        .sort(
          (a, b) =>
            TRIP_INTEREST_ORDER.indexOf(b.interest) -
            TRIP_INTEREST_ORDER.indexOf(a.interest),
        );

      const cx = W / 2;
      for (const d of sorted) {
        const inChain = chainIds.includes(d.id);
        const order = chainIds.indexOf(d.id);
        const right = d.xy[0] >= cx;
        g.append("circle")
          .attr(
            "class",
            `dot${d.id === schoolId ? " here" : ""}${inChain ? " picked" : ""}`,
          )
          .attr("cx", d.xy[0])
          .attr("cy", d.xy[1])
          .attr("r", inChain ? 9 : d.id === schoolId ? 8 : 7)
          .style("fill", () => levelFill(d.interest))
          .style("cursor", "pointer")
          .on("click", (event) => {
            event.stopPropagation();
            pickSchoolRef.current(d.id);
          })
          .on("mouseenter", (event) => {
            const node = svgRef.current;
            if (!node) return;
            const rect = node.getBoundingClientRect();
            const [px, py] = d3.pointer(event, node);
            setTip({
              x: (px / W) * rect.width,
              y: (py / H) * rect.height,
              text: `${d.name} · ${TRIP_INTEREST_LABEL[d.interest]}`,
            });
          })
          .on("mouseleave", () => setTip(null));

        if (order >= 0) {
          g.append("text")
            .attr("class", "trip-region-step")
            .attr("x", d.xy[0])
            .attr("y", d.xy[1] + 4)
            .attr("text-anchor", "middle")
            .text(String(order + 1));
        }

        g.append("text")
          .attr("class", "trip-region-name")
          .attr("x", d.xy[0] + (right ? 12 : -12))
          .attr("y", d.xy[1] + 4)
          .attr("text-anchor", right ? "start" : "end")
          .style("pointer-events", "none")
          .text(shortSchoolName(d.name));
      }

      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([DETAIL_ZOOM_MIN, DETAIL_ZOOM_MAX])
        .extent([
          [0, 0],
          [W, H],
        ])
        .translateExtent([
          [-W * 0.5, -H * 0.5],
          [W * 1.5, H * 1.5],
        ])
        .filter((event) => {
          if (event.type === "wheel") return true;
          if (event.type === "mousedown" || event.type === "touchstart") {
            const target = event.target as Element | null;
            if (target?.closest?.("circle.dot")) return false;
          }
          return !event.ctrlKey && event.button === 0;
        })
        .on("zoom", (event) => {
          detailZoomRef.current = event.transform;
          g.attr("transform", event.transform.toString());
          setTip(null);
        });

      detailZoomBehaviorRef.current = zoom;
      svg.call(zoom).on("dblclick.zoom", null);
      svg.call(zoom.transform, detailZoomRef.current);

      if (!cancelled && detailRef.current === detailRegion) setReady(true);
    })();

    return () => {
      cancelled = true;
      detailZoomBehaviorRef.current = null;
      if (svgRef.current) d3.select(svgRef.current).on(".zoom", null);
    };
  }, [detailRegion, dots, schoolId, chain, namesById]);

  useEffect(() => {
    if (detailRegion) return;
    const svg = svgRef.current as
      | (SVGSVGElement & {
          __regionEls?: Map<
            string,
            {
              path: d3.Selection<SVGPathElement, unknown, null, undefined>;
              lab: d3.Selection<SVGTextElement, unknown, null, undefined>;
            }
          >;
        })
      | null;
    if (!svg?.__regionEls) return;
    for (const [id, els] of svg.__regionEls) {
      els.path
        .classed("on", id === highlight)
        .classed("off", Boolean(highlight) && id !== highlight);
      els.lab.classed("on", id === highlight);
    }
    d3.select(svg)
      .selectAll<SVGCircleElement, { region: TripRegionId }>("circle.dot")
      .attr("opacity", (d) => (!highlight || d.region === highlight ? 1 : 0.18));
  }, [highlight, detailRegion]);

  const detailMeta = TRIP_REGIONS.find((row) => row.id === detailRegion);

  return (
    <div className="trip-panel" role="tabpanel">
      <div className="trip-head-row">
        <div>
          <h2>{detailRegion ? detailRegion : "All schools"}</h2>
          <p>
            {detailRegion
              ? `${detailSchools.length} schools · ${detailMeta?.note ?? ""}`
              : `${live.length} schools · ${TRIP_REGIONS.length} regions · Home: ${KYLE_STUDENT.homeName}`}
          </p>
        </div>
        {detailRegion ? (
          <div className="trip-region-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setDetailRegion(null);
                setChain([]);
                setFocus(null);
                detailZoomRef.current = d3.zoomIdentity;
                detailZoomRegionRef.current = null;
              }}
            >
              Back to map
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => resetDetailView()}>
              Reset view
            </button>
            {chain.length ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setChain([])}
              >
                Clear path
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={`trip-nat-layout${detailRegion ? " is-detail" : ""}`}>
        <div className="trip-map-wrap">
          <svg
            ref={svgRef}
            className={`trip-usmap${detailRegion ? " is-detail" : ""}`}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={
              detailRegion
                ? `${detailRegion} schools map`
                : "Map of Kyle's schools by region"
            }
          />
          {loadError ? (
            <p className="trip-empty" style={{ padding: 16 }}>
              Map data failed to load.
            </p>
          ) : null}
          {!ready && !loadError && dots.length === 0 ? (
            <p className="trip-empty" style={{ padding: 16 }}>
              Locating schools…
            </p>
          ) : null}
          {tip ? (
            <div className="trip-tip" style={{ left: tip.x, top: tip.y }}>
              {tip.text}
            </div>
          ) : null}
          {detailRegion ? (
            <div
              className="trip-region-zoom-controls"
              role="group"
              aria-label="Map zoom"
            >
              <button
                type="button"
                className="trip-region-zoom-btn"
                aria-label="Zoom in"
                onClick={() => nudgeDetailZoom(1)}
              >
                +
              </button>
              <button
                type="button"
                className="trip-region-zoom-btn"
                aria-label="Zoom out"
                onClick={() => nudgeDetailZoom(-1)}
              >
                −
              </button>
            </div>
          ) : null}
          {detailRegion ? (
            <p className="trip-region-hint muted">
              Use +/− or scroll to zoom · drag to pan · click schools in order for
              drive times. Click an earlier stop to truncate.
            </p>
          ) : null}
        </div>

        <div
          className="trip-regions"
          onMouseLeave={() => {
            if (!detailRegion) setFocus(null);
          }}
        >
          {detailRegion ? (
            <div className="trip-region-detail-side">
              <div className="trip-region-route-sum">
                <strong>{formatRegionRouteTotal(route)}</strong>
                {chain.length ? (
                  <ol className="trip-region-chain">
                    {chain.map((id, index) => {
                      const school = namesById.get(id) ?? id;
                      const leg = index > 0 ? route.legs[index - 1] : null;
                      return (
                        <li key={`${id}-${index}`}>
                          <button
                            type="button"
                            className="trip-region-chain-stop"
                            onClick={() => pickSchool(id)}
                          >
                            <span className="trip-region-chain-n">{index + 1}</span>
                            <span>{shortSchoolName(school)}</span>
                          </button>
                          {leg ? (
                            <span className="trip-region-chain-leg muted">
                              {formatRegionRouteLeg(leg)}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="section-sub">
                    Pick a first school on the map or in the list below.
                  </p>
                )}
              </div>
              <ul className="trip-rg-schools trip-rg-schools-pick">
                {detailSchools
                  .slice()
                  .sort(
                    (a, b) =>
                      TRIP_INTEREST_ORDER.indexOf(a.interest) -
                      TRIP_INTEREST_ORDER.indexOf(b.interest),
                  )
                  .map((s) => {
                    const order = chain.indexOf(s.id);
                    return (
                      <li key={s.id} data-level={s.interest}>
                        <button
                          type="button"
                          className={`trip-rg-school-btn${order >= 0 ? " on" : ""}`}
                          onClick={() => pickSchool(s.id)}
                        >
                          <span className="trip-rg-school-name">
                            {order >= 0 ? `${order + 1}. ` : ""}
                            {s.name}
                          </span>
                          <span className="trip-rg-school-lvl muted">
                            {TRIP_INTEREST_LABEL[s.interest]}
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ) : (
            regionLists.map((region) => {
              const isOn = highlight === region.id;
              return (
                <div
                  key={region.id}
                  className={`trip-rg${isOn ? " on" : ""}`}
                  data-rg={region.id}
                >
                  <button
                    type="button"
                    className="trip-rg-toggle"
                    aria-expanded={false}
                    onMouseEnter={() => setFocus(region.id)}
                    onClick={() => openRegion(region.id)}
                  >
                    <div className="trip-rg-top">
                      <b>{region.id}</b>
                      <span>
                        {region.schools.length}
                        <span className="trip-rg-caret" aria-hidden="true">
                          {" ▸"}
                        </span>
                      </span>
                    </div>
                    <div className="trip-rg-bar">
                      {region.schools.map((s) => (
                        <i
                          key={s.id}
                          title={`${s.name} · ${TRIP_INTEREST_LABEL[s.interest]}`}
                          data-level={s.interest}
                        />
                      ))}
                    </div>
                    <span className="trip-rg-note">{region.note}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="trip-legend">
        <span className="trip-label trip-label-sm">
          {KYLE_STUDENT.name}&apos;s interest
        </span>
        {TRIP_INTEREST_ORDER.map((key) => (
          <span key={key}>
            <span
              className={`trip-sw${key === "none" ? " trip-sw-none" : ""}`}
              data-level={key}
            />
            {TRIP_INTEREST_LABEL[key]}
          </span>
        ))}
        {current ? (
          <span className="trip-legend-here">
            <span className="trip-sw trip-sw-here" />
            This school
          </span>
        ) : null}
        {!detailRegion ? (
          <>
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: "var(--color-text)",
                  transform: "rotate(45deg)",
                  display: "inline-block",
                }}
              />
              Home
            </span>
            <span>
              <span
                className="trip-sw"
                style={{ border: "1px dashed var(--text-subtle)", background: "transparent" }}
              />
              Region
            </span>
          </>
        ) : (
          <span className="muted" style={{ marginLeft: "auto" }}>
            Numbers on pins = stop order
          </span>
        )}
      </div>
    </div>
  );
}
