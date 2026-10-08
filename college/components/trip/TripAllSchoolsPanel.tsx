"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import type { School } from "@/lib/types";
import type { GeoPoint } from "@/lib/visit-geo";
import {
  KYLE_STUDENT,
  TRIP_INTEREST_LABEL,
  TRIP_INTEREST_ORDER,
  TRIP_REGIONS,
  buildRegionDots,
  tripInterestLabel,
  type TripInterestKey,
  type TripRegionId,
} from "@/lib/trip-planning";

const WORLD_ATLAS_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";

const W = 700;
const H = 440;
const PAD = 15;

// world-atlas countries-110m shape (loose typing — topojson Topology generics vary by package).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TopoCountries = any;

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
  const [expanded, setExpanded] = useState<TripRegionId | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const highlight = expanded ?? focus;

  const live = useMemo(
    () => listSchools.filter((s) => !s.archived),
    [listSchools],
  );
  const dots = useMemo(
    () => buildRegionDots(live, coordsById),
    [live, coordsById],
  );
  const current = live.find((s) => s.id === schoolId);

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

  useEffect(() => {
    let cancelled = false;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    setReady(false);
    setLoadError(false);

    void (async () => {
      let topo: TopoCountries;
      try {
        const res = await fetch(WORLD_ATLAS_URL);
        topo = (await res.json()) as TopoCountries;
      } catch {
        if (!cancelled) setLoadError(true);
        return;
      }
      if (cancelled || !svgRef.current) return;

      // FeatureCollection from world-atlas countries layer
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

      type DotXY = (typeof dots)[number] & { xy: [number, number] };
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
        { path: d3.Selection<SVGPathElement, unknown, null, undefined>; lab: d3.Selection<SVGTextElement, unknown, null, undefined> }
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
          .on("mouseenter", () => setFocus(region.id))
          .on("mouseleave", () => setFocus(null));
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

      const levelFill = (lv: TripInterestKey) => {
        if (lv === "top") return "var(--lvl-4)";
        if (lv === "high") return "var(--lvl-3)";
        if (lv === "moderate") return "var(--lvl-2)";
        if (lv === "safety") return "var(--lvl-1)";
        return "var(--color-bg)";
      };

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
        .attr("title", (d) => `${d.name} · ${tripInterestLabel(d.interest === "none" ? "" : d.interest)}`)
        .on("mouseenter", (event, d) => {
          const node = svgRef.current;
          if (!node) return;
          const rect = node.getBoundingClientRect();
          setTip({
            x: (d.xy[0] / W) * rect.width,
            y: (d.xy[1] / H) * rect.height,
            text: `${d.name} · ${TRIP_INTEREST_LABEL[d.interest]}`,
          });
        })
        .on("mouseleave", () => setTip(null));

      // Store region els for focus updates via data attribute on svg
      (svgRef.current as SVGSVGElement & { __regionEls?: typeof regionEls }).__regionEls =
        regionEls;
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [dots, schoolId]);

  useEffect(() => {
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
  }, [highlight]);

  return (
    <div className="trip-panel" role="tabpanel">
      <div className="trip-head-row">
        <div>
          <h2>All schools</h2>
          <p>
            {live.length} schools · {TRIP_REGIONS.length} regions · Home:{" "}
            {KYLE_STUDENT.homeName}
          </p>
        </div>
      </div>

      <div className="trip-nat-layout">
        <div className="trip-map-wrap">
          <svg
            ref={svgRef}
            className="trip-usmap"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Map of Kyle's schools by region"
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
        </div>

        <div
          className="trip-regions"
          onMouseLeave={() => {
            if (!expanded) setFocus(null);
          }}
        >
          {regionLists.map((region) => {
            const isOpen = expanded === region.id;
            const isOn = highlight === region.id;
            return (
              <div
                key={region.id}
                className={`trip-rg${isOn ? " on" : ""}${isOpen ? " open" : ""}`}
                data-rg={region.id}
              >
                <button
                  type="button"
                  className="trip-rg-toggle"
                  aria-expanded={isOpen}
                  aria-controls={`trip-rg-schools-${region.id}`}
                  onMouseEnter={() => setFocus(region.id)}
                  onClick={() => {
                    setExpanded((current) => {
                      const next = current === region.id ? null : region.id;
                      setFocus(next ?? region.id);
                      return next;
                    });
                  }}
                >
                  <div className="trip-rg-top">
                    <b>{region.id}</b>
                    <span>
                      {region.schools.length}
                      <span className="trip-rg-caret" aria-hidden="true">
                        {isOpen ? " ▴" : " ▾"}
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
                {isOpen ? (
                  <ul
                    id={`trip-rg-schools-${region.id}`}
                    className="trip-rg-schools"
                  >
                    {region.schools.length === 0 ? (
                      <li className="muted">No schools in this region.</li>
                    ) : (
                      region.schools.map((s) => (
                        <li key={s.id} data-level={s.interest}>
                          <span className="trip-rg-school-name">{s.name}</span>
                          <span className="trip-rg-school-lvl muted">
                            {TRIP_INTEREST_LABEL[s.interest]}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}
              </div>
            );
          })}
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
      </div>
    </div>
  );
}
