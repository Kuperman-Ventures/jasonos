"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AgeSwitch } from "./AgeSwitch";
import { LocationSheet } from "./LocationSheet";
import { TaleFilter } from "./TaleFilter";
import { REGIONS } from "@/lib/lotr/regions";
import { LOCATIONS } from "@/lib/lotr/locations";
import {
  COASTLINE,
  FORESTS,
  LAKES,
  MOUNTAINS,
  NUMENOR,
  RIVERS,
} from "@/lib/lotr/geography";
import {
  TALES_BY_AGE,
  WHOLE_VIEW_BOX,
  locationInAge,
  locationName,
  scenesForTales,
  type Age,
  type Location,
  type Tale,
} from "@/lib/lotr/types";
import "./lotr.css";

function regionLabelPoint(path: string): { x: number; y: number } {
  const nums = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    sx += nums[i];
    sy += nums[i + 1];
    n += 1;
  }
  return { x: n ? sx / n : 0, y: n ? sy / n : 0 };
}

export function LotrMap() {
  const [age, setAge] = useState<Age>("third");
  const talesForAge = TALES_BY_AGE[age];
  const [selectedTales, setSelectedTales] = useState<Set<Tale>>(
    () => new Set(TALES_BY_AGE.third)
  );
  const [regionId, setRegionId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mapWidth, setMapWidth] = useState(390);
  const mapRef = useRef<HTMLDivElement>(null);

  const viewBox = useMemo(() => {
    if (!regionId) return WHOLE_VIEW_BOX;
    return REGIONS.find((region) => region.id === regionId)?.viewBox ?? WHOLE_VIEW_BOX;
  }, [regionId]);

  useEffect(() => {
    const node = mapRef.current;
    if (!node) return;
    const measure = () => setMapWidth(Math.max(node.clientWidth, 280));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const activeRegion = REGIONS.find((region) => region.id === regionId) ?? null;
  const viewWidth = Number(viewBox.split(/\s+/)[2]) || 1000;
  const hitR = Math.max(10, (22 * viewWidth) / mapWidth);

  const visibleLocations = useMemo(
    () => LOCATIONS.filter((location) => locationInAge(location, age)),
    [age]
  );

  const regionLocations = useMemo(() => {
    if (!regionId) return [] as Location[];
    return visibleLocations.filter((location) => location.regionId === regionId);
  }, [regionId, visibleLocations]);

  const activeLocation = visibleLocations.find((location) => location.id === activeId) ?? null;
  const activeName = activeLocation ? locationName(activeLocation, age) : null;

  function changeAge(next: Age) {
    setAge(next);
    setSelectedTales(new Set(TALES_BY_AGE[next]));
    setActiveId(null);
    if (regionId) {
      const stillVisible = LOCATIONS.some(
        (location) => location.regionId === regionId && locationInAge(location, next)
      );
      if (!stillVisible) setRegionId(null);
    }
  }

  function toggleTale(tale: Tale) {
    setSelectedTales((current) => {
      const next = new Set(current);
      if (next.has(tale)) {
        if (next.size === 1) return next;
        next.delete(tale);
      } else {
        next.add(tale);
      }
      return next;
    });
  }

  function openLocation(id: string) {
    setActiveId(id);
  }

  return (
    <div className="lotr-shell">
      <header className="lotr-header">
        <p className="lotr-eyebrow">Middle-earth</p>
        <h1>LOTR Map</h1>
        <p>
          Tap a region, then a place. Scene notes come from The Hobbit, The Lord of
          the Rings, and The Rings of Power seasons 1 and 2.
        </p>
      </header>

      <div className="lotr-controls">
        <AgeSwitch age={age} onChange={changeAge} />
        <TaleFilter
          tales={talesForAge}
          selected={selectedTales}
          onToggle={toggleTale}
        />
      </div>

      <div className="lotr-toolbar">
        <p className="lotr-region-title">
          {activeRegion ? activeRegion.name : "All regions"}
        </p>
        <button
          type="button"
          className="lotr-whole"
          disabled={!regionId}
          onClick={() => {
            setRegionId(null);
            setActiveId(null);
          }}
        >
          Whole map
        </button>
      </div>

      <div className="lotr-map-wrap" aria-label="Middle-earth map" ref={mapRef}>
        <svg
          className="lotr-map-svg"
          viewBox={viewBox}
          role="img"
          aria-label="Schematic map of Middle-earth"
        >
          <defs>
            <pattern id="lotr-sea-hatch" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M0 8 L8 0" stroke="#6f8898" strokeWidth="1" />
            </pattern>
          </defs>

          {/* Sea */}
          <rect x="0" y="0" width="1000" height="760" fill="#6f8797" />
          <rect x="0" y="0" width="1000" height="760" fill="url(#lotr-sea-hatch)" opacity="0.25" />

          <path
            className="lotr-land"
            d={COASTLINE}
            fill="#c2cbbd"
            stroke="#3d4a42"
            strokeWidth="2"
          />
          <path
            className="lotr-land"
            d={NUMENOR}
            fill="#c2cbbd"
            stroke="#3d4a42"
            strokeWidth="2"
          />

          {Object.entries(FORESTS).map(([name, d]) => (
            <path key={name} className="lotr-forest" d={d} fill="#6f8a6a99" stroke="none" />
          ))}

          {Object.entries(LAKES).map(([name, d]) => (
            <path key={name} className="lotr-lake" d={d} fill="#5f7a8c" stroke="#3d4a42" strokeWidth="1" />
          ))}

          {Object.entries(RIVERS).map(([name, d]) => (
            <path
              key={name}
              className="lotr-river"
              d={d}
              fill="none"
              stroke="#5f7a8c"
              strokeWidth={name === "anduin" ? 4 : 2.5}
              strokeLinecap="round"
            />
          ))}

          {Object.entries(MOUNTAINS).map(([name, d]) => (
            <path
              key={name}
              className="lotr-ridge"
              d={d}
              fill="none"
              stroke="#3d4a42"
              strokeWidth={
                name === "mistyMountains" || name === "whiteMountains" || name === "ephelDuath"
                  ? 3.2
                  : 2.6
              }
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
          ))}

          {!regionId
            ? REGIONS.map((region) => {
                const label = regionLabelPoint(region.path);
                const showSecondOnly =
                  region.id === "rhun" ||
                  region.id === "the-north" ||
                  region.id === "numenor-sea";
                if (showSecondOnly && age !== "second") return null;
                return (
                  <g key={region.id}>
                    <path
                      className="lotr-region"
                      d={region.path}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open ${region.name}`}
                      onClick={() => setRegionId(region.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setRegionId(region.id);
                        }
                      }}
                    />
                    <text className="lotr-region-label" x={label.x} y={label.y}>
                      {region.name}
                    </text>
                  </g>
                );
              })
            : null}

          {regionId
            ? regionLocations.map((location, index) => {
                const name = locationName(location, age);
                if (!name) return null;
                const matched = scenesForTales(location, age, selectedTales).length > 0;
                const labelY = location.y + (index % 2 === 0 ? -10 : 16);
                return (
                  <g key={location.id} className="lotr-pin" data-dimmed={matched ? "false" : "true"}>
                    <g
                      role="button"
                      tabIndex={0}
                      aria-label={name}
                      onClick={() => openLocation(location.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openLocation(location.id);
                        }
                      }}
                    >
                      <circle className="lotr-pin-hit" cx={location.x} cy={location.y} r={hitR} />
                      <circle className="lotr-pin-dot" cx={location.x} cy={location.y} r={7} />
                    </g>
                    <text className="lotr-pin-label" x={location.x + 10} y={labelY}>
                      {name}
                    </text>
                  </g>
                );
              })
            : null}
        </svg>
      </div>

      {activeRegion ? (
        <section aria-label={`${activeRegion.name} locations`}>
          <div className="lotr-loc-list">
            {regionLocations.map((location) => {
              const name = locationName(location, age);
              if (!name) return null;
              const matched = scenesForTales(location, age, selectedTales).length > 0;
              return (
                <button
                  key={location.id}
                  type="button"
                  data-dimmed={matched ? "false" : "true"}
                  onClick={() => openLocation(location.id)}
                >
                  {name}
                  <span>{location.summary}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="lotr-footer">
          Tap a shaded region to zoom in and see its places.
        </p>
      )}

      <p className="lotr-footer">
        Unofficial fan reference. Not affiliated with the Tolkien Estate,
        Middle-earth Enterprises or Amazon.
      </p>

      {activeLocation && activeName ? (
        <LocationSheet
          location={activeLocation}
          age={age}
          name={activeName}
          onClose={() => setActiveId(null)}
        />
      ) : null}
    </div>
  );
}
