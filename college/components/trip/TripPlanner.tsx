"use client";

import { useEffect, useMemo, useState } from "react";
import type { School } from "@/lib/types";
import {
  airportsForRegion,
  buildRouteFromOrder,
  defaultTripStartId,
  formatDriveDuration,
  shortestSchoolOrder,
  travelPointById,
  type PlannedRoute,
} from "@/lib/drive-matrix";
import { regionForLocation, type TripRegionId } from "@/lib/trip-planning";

type EndpointId = string; // "home" | "airport:…" | "__same__" for end only

export function TripPlanner({
  regionId,
  schools,
  onRouteChange,
  onClose,
}: {
  regionId: TripRegionId;
  schools: School[];
  onRouteChange: (route: PlannedRoute | null) => void;
  onClose: () => void;
}) {
  const live = useMemo(() => schools.filter((s) => !s.archived), [schools]);
  const regionSchools = useMemo(
    () => live.filter((s) => regionForLocation(s.location) === regionId),
    [live, regionId],
  );
  const otherSchools = useMemo(
    () => live.filter((s) => regionForLocation(s.location) !== regionId),
    [live, regionId],
  );

  const startOptions = useMemo(() => {
    const airports = airportsForRegion(regionId);
    return [
      { id: "home", label: "Home (Maplewood, NJ)" },
      ...airports.map((a) => ({ id: a.id, label: a.name })),
    ];
  }, [regionId]);

  const [startId, setStartId] = useState(() => defaultTripStartId(regionId));
  const [endChoice, setEndChoice] = useState<EndpointId>("__same__");
  const [checked, setChecked] = useState<string[]>(() => regionSchools.map((s) => s.id));
  const [showOthers, setShowOthers] = useState(false);
  const [manualOrder, setManualOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const endId = endChoice === "__same__" ? startId : endChoice;

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    map.set("home", "Home");
    for (const s of live) {
      map.set(s.id, s.name);
      map.set(`school:${s.id}`, s.name);
    }
    for (const opt of startOptions) map.set(opt.id, opt.label);
    return map;
  }, [live, startOptions]);

  const available = useMemo(() => {
    const base = showOthers ? [...regionSchools, ...otherSchools] : regionSchools;
    return base;
  }, [regionSchools, otherSchools, showOthers]);

  // Drop checked ids that are no longer visible
  useEffect(() => {
    const allowed = new Set(available.map((s) => s.id));
    setChecked((prev) => prev.filter((id) => allowed.has(id)));
  }, [available]);

  const tooMany = checked.length > 12;

  const shortest = useMemo(() => {
    if (tooMany) return null;
    return shortestSchoolOrder({
      startId,
      endId,
      schoolIds: checked,
      nameById,
    });
  }, [startId, endId, checked, nameById, tooMany]);

  const route = useMemo(() => {
    if (tooMany) return null;
    if (manualOrder) {
      const kept = manualOrder.filter((id) => checked.includes(id));
      const missing = checked.filter((id) => !kept.includes(id));
      return buildRouteFromOrder({
        startId,
        endId,
        schoolIds: [...kept, ...missing],
        nameById,
      });
    }
    return shortest;
  }, [tooMany, manualOrder, checked, startId, endId, nameById, shortest]);

  useEffect(() => {
    onRouteChange(route);
  }, [route, onRouteChange]);

  function toggleSchool(id: string) {
    setManualOrder(null);
    setChecked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId || !route) return;
    const schoolStops = route.order
      .filter((id) => id.startsWith("school:"))
      .map((id) => id.slice("school:".length));
    const from = schoolStops.indexOf(dragId);
    const to = schoolStops.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...schoolStops];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    setManualOrder(next);
    setDragId(null);
  }

  const schoolStops = (route?.order ?? [])
    .filter((id) => id.startsWith("school:"))
    .map((id) => id.slice("school:".length));

  return (
    <div className="trip-planner" role="dialog" aria-label={`Plan trip · ${regionId}`}>
      <div className="trip-planner-head">
        <div>
          <h3>Plan trip · {regionId}</h3>
          <p>Shortest drive order from the stored matrix. Drag stops to reorder.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="trip-planner-controls">
        <label>
          Start
          <select
            value={startId}
            onChange={(e) => {
              setStartId(e.target.value);
              setManualOrder(null);
            }}
          >
            {startOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          End
          <select
            value={endChoice}
            onChange={(e) => {
              setEndChoice(e.target.value);
              setManualOrder(null);
            }}
          >
            <option value="__same__">Same as start</option>
            {startOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="trip-planner-schools">
        <div className="trip-planner-schools-head">
          <b>Schools</b>
          <label className="trip-planner-others">
            <input
              type="checkbox"
              checked={showOthers}
              onChange={(e) => setShowOthers(e.target.checked)}
            />
            Show schools from other regions
          </label>
        </div>
        <ul>
          {available.map((school) => (
            <li key={school.id}>
              <label>
                <input
                  type="checkbox"
                  checked={checked.includes(school.id)}
                  onChange={() => toggleSchool(school.id)}
                />
                <span>{school.name}</span>
                {regionForLocation(school.location) !== regionId ? (
                  <small>{regionForLocation(school.location) ?? "Other"}</small>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      </div>

      {tooMany ? (
        <p className="trip-planner-warn">Select 12 or fewer schools to plan a route</p>
      ) : null}

      {route && !tooMany ? (
        <div className="trip-planner-route">
          <div className="trip-planner-route-head">
            <b>Route</b>
            {manualOrder ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setManualOrder(null)}
              >
                Use shortest order
              </button>
            ) : null}
          </div>
          <ol className="trip-planner-stops">
            {route.order.map((id, index) => {
              const isSchool = id.startsWith("school:");
              const schoolId = isSchool ? id.slice("school:".length) : null;
              const label =
                travelPointById(id)?.name ??
                nameById.get(id) ??
                nameById.get(schoolId ?? "") ??
                id;
              return (
                <li
                  key={`${id}-${index}`}
                  draggable={Boolean(schoolId)}
                  onDragStart={() => schoolId && setDragId(schoolId)}
                  onDragOver={(e) => schoolId && e.preventDefault()}
                  onDrop={() => schoolId && onDrop(schoolId)}
                  className={schoolId ? "draggable" : undefined}
                >
                  <span className="trip-planner-num">{index + 1}</span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>
          <ul className="trip-planner-legs">
            {route.legs.map((leg) => (
              <li key={`${leg.fromId}|${leg.toId}`}>
                {leg.missing ? (
                  <span className="trip-planner-missing">
                    Drive time not available for {leg.fromName} to {leg.toName}
                  </span>
                ) : (
                  <>
                    <span>
                      {leg.fromName} to {leg.toName}:{" "}
                      {formatDriveDuration(leg.minutes!)} ({leg.miles} mi)
                    </span>
                    {leg.longDrive ? (
                      <small>Long drive - consider splitting across two days.</small>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
          <p className="trip-planner-total">
            {route.incomplete
              ? "Total incomplete — some legs missing."
              : `Total: ${formatDriveDuration(route.totalMinutes!)} · ${route.totalMiles} mi · ${route.schoolCount} school${route.schoolCount === 1 ? "" : "s"}`}
          </p>
          {schoolStops.length === 0 ? (
            <p className="trip-empty">Check at least one school to plan stops.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
