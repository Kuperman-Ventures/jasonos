"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { School } from "@/lib/types";
import { visitLabel } from "@/lib/types";
import {
  computePinNudges,
  toTripSchoolPoint,
  tripInterestLabel,
  type TripSchoolPoint,
} from "@/lib/trip-planning";
import { KYLE_STUDENT } from "@/lib/trip-planning/calendar";
import { parseSchoolLocation } from "@/lib/visit-planning";
import { geocodeAddress, geocodeCityState, type GeoPoint } from "@/lib/visit-geo";
import {
  VISIT_PLAN_END_ID,
  VISIT_PLAN_MAX_SCHOOLS,
  VISIT_PLAN_START_ID,
  buildVisitPlanFromOrder,
  formatVisitPlanLegLabel,
  optimizeVisitPlanOrder,
  schoolIdsFromRoute,
} from "@/lib/visit-plan-route";
import {
  DEFAULT_VISIT_END_ADDRESS,
  DEFAULT_VISIT_START_ADDRESS,
  readVisitPlanUiState,
  writeVisitPlanUiState,
  type VisitPlanUiState,
} from "@/lib/visit-plan-state";
import { formatDriveDuration } from "@/lib/drive-matrix";
import { SchoolMark } from "./SchoolMark";

const VisitPlanMap = dynamic(
  () => import("./visit-plan/VisitPlanMap").then((mod) => mod.VisitPlanMap),
  {
    ssr: false,
    loading: () => <div className="trip-vmap trip-vmap-loading" aria-hidden="true" />,
  },
);

export function VisitPlanTab({
  schools,
  dateline,
  onOpenSchool,
  onRemoveFromPlan,
}: {
  schools: School[];
  dateline: string;
  onOpenSchool: (id: string) => void;
  onRemoveFromPlan: (id: string) => void;
}) {
  const planned = useMemo(
    () =>
      schools
        .filter((row) => !row.archived && row.visitStatus === "planned")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [schools],
  );

  const [ui, setUi] = useState<VisitPlanUiState>(() => readVisitPlanUiState());
  const [startDraft, setStartDraft] = useState(ui.startAddress);
  const [endDraft, setEndDraft] = useState(ui.endAddress);
  const [startPoint, setStartPoint] = useState<GeoPoint | null>({
    lat: KYLE_STUDENT.homeLat,
    lng: KYLE_STUDENT.homeLng,
  });
  const [endPoint, setEndPoint] = useState<GeoPoint | null>({
    lat: KYLE_STUDENT.homeLat,
    lng: KYLE_STUDENT.homeLng,
  });
  const [geocodeStatus, setGeocodeStatus] = useState("");
  const [coordsById, setCoordsById] = useState<Map<string, GeoPoint | null>>(() => new Map());
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    writeVisitPlanUiState(ui);
  }, [ui]);

  useEffect(() => {
    setStartDraft(ui.startAddress);
    setEndDraft(ui.endAddress);
  }, [ui.startAddress, ui.endAddress]);

  // Geocode schools on the plan.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = new Map(coordsById);
      let changed = false;
      for (const school of planned) {
        if (next.has(school.id)) continue;
        const loc = parseSchoolLocation(school.location);
        const point = await geocodeCityState(loc.city, loc.state);
        if (cancelled) return;
        next.set(school.id, point);
        changed = true;
      }
      if (changed && !cancelled) setCoordsById(new Map(next));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planned]);

  // Geocode start / end when addresses settle.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setGeocodeStatus("Finding addresses…");
      const start =
        (await geocodeAddress(ui.startAddress)) ??
        (ui.startAddress.trim().toLowerCase().includes("maplewood")
          ? { lat: KYLE_STUDENT.homeLat, lng: KYLE_STUDENT.homeLng }
          : null);
      const end =
        (await geocodeAddress(ui.endAddress)) ??
        (ui.endAddress.trim().toLowerCase().includes("maplewood")
          ? { lat: KYLE_STUDENT.homeLat, lng: KYLE_STUDENT.homeLng }
          : null);
      if (cancelled) return;
      setStartPoint(start);
      setEndPoint(end);
      if (!start || !end) {
        setGeocodeStatus("Couldn’t place start or end — try a city and state, or a ZIP.");
      } else {
        setGeocodeStatus("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ui.startAddress, ui.endAddress]);

  const nudges = useMemo(() => {
    const pts = [...coordsById.entries()]
      .filter((entry): entry is [string, GeoPoint] => Boolean(entry[1]))
      .map(([id, point]) => ({ id, lat: point.lat, lng: point.lng }));
    return computePinNudges(pts);
  }, [coordsById]);

  const pointsById = useMemo(() => {
    const map = new Map<string, TripSchoolPoint>();
    for (const school of planned) {
      const coords = coordsById.get(school.id);
      if (!coords) continue;
      const point = toTripSchoolPoint(school, coords, nudges.get(school.id) ?? 0);
      if (point) map.set(school.id, point);
    }
    return map;
  }, [planned, coordsById, nudges]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const school of planned) map.set(school.id, school.name);
    map.set(VISIT_PLAN_START_ID, ui.startAddress.trim() || "Start");
    map.set(VISIT_PLAN_END_ID, ui.endAddress.trim() || "End");
    return map;
  }, [planned, ui.startAddress, ui.endAddress]);

  const startEndpoint = useMemo(
    () => ({
      id: VISIT_PLAN_START_ID,
      name: ui.startAddress.trim() || "Start",
      point: startPoint,
    }),
    [ui.startAddress, startPoint],
  );
  const endEndpoint = useMemo(
    () => ({
      id: VISIT_PLAN_END_ID,
      name: ui.endAddress.trim() || "End",
      point: endPoint,
    }),
    [ui.endAddress, endPoint],
  );

  const plannedIds = useMemo(() => planned.map((row) => row.id), [planned]);

  const route = useMemo(() => {
    if (!plannedIds.length) {
      return buildVisitPlanFromOrder({
        schoolIds: [],
        start: startEndpoint,
        end: endEndpoint,
        coords: coordsById,
        nameById,
      });
    }
    const available = new Set(plannedIds);
    if (ui.manualOrder?.length) {
      const ordered = ui.manualOrder.filter((id) => available.has(id));
      for (const id of plannedIds) {
        if (!ordered.includes(id)) ordered.push(id);
      }
      return buildVisitPlanFromOrder({
        schoolIds: ordered,
        start: startEndpoint,
        end: endEndpoint,
        coords: coordsById,
        nameById,
      });
    }
    return optimizeVisitPlanOrder({
      schoolIds: plannedIds,
      start: startEndpoint,
      end: endEndpoint,
      coords: coordsById,
      nameById,
    });
  }, [
    plannedIds,
    ui.manualOrder,
    startEndpoint,
    endEndpoint,
    coordsById,
    nameById,
  ]);

  const orderedSchoolIds = schoolIdsFromRoute(route);
  const routeLegs = route.legs.map(formatVisitPlanLegLabel);
  const tooMany = plannedIds.length > VISIT_PLAN_MAX_SCHOOLS;

  function applyAddresses() {
    setUi((prev) => ({
      ...prev,
      startAddress: startDraft.trim() || DEFAULT_VISIT_START_ADDRESS,
      endAddress: endDraft.trim() || DEFAULT_VISIT_END_ADDRESS,
      // Re-optimize when endpoints change unless user already locked order.
    }));
  }

  function optimizeRoute() {
    setUi((prev) => ({ ...prev, manualOrder: null }));
  }

  function moveSchool(id: string, dir: -1 | 1) {
    const current = orderedSchoolIds;
    const index = current.indexOf(id);
    if (index < 0) return;
    const nextIndex = index + dir;
    if (nextIndex < 0 || nextIndex >= current.length) return;
    const next = [...current];
    const [row] = next.splice(index, 1);
    next.splice(nextIndex, 0, row!);
    setUi((prev) => ({ ...prev, manualOrder: next }));
  }

  function onDropOn(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const current = [...orderedSchoolIds];
    const from = current.indexOf(dragId);
    const to = current.indexOf(targetId);
    if (from < 0 || to < 0) {
      setDragId(null);
      return;
    }
    const next = [...current];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row!);
    setUi((prev) => ({ ...prev, manualOrder: next }));
    setDragId(null);
  }

  return (
    <section className="visit-plan-page">
      <header className="page-head">
        <div>
          <div className="dateline">{dateline}</div>
          <h2>Visit Planning</h2>
          <p className="page-sub">
            Schools marked <strong>Plan Visit</strong> on the Colleges list. We suggest a drive
            order; drag the list (or use the arrows) to change it.
          </p>
        </div>
      </header>

      {!planned.length ? (
        <p className="trip-empty">
          No schools on the visit plan yet. On Colleges, set Visit to “
          {visitLabel("planned")}”.
        </p>
      ) : (
        <>
          <div className="visit-plan-endpoints">
            <label>
              <span className="trip-label trip-label-sm">Start</span>
              <input
                type="text"
                value={startDraft}
                onChange={(event) => setStartDraft(event.target.value)}
                onBlur={applyAddresses}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyAddresses();
                  }
                }}
                placeholder="Address, city, or ZIP"
              />
            </label>
            <label>
              <span className="trip-label trip-label-sm">End</span>
              <input
                type="text"
                value={endDraft}
                onChange={(event) => setEndDraft(event.target.value)}
                onBlur={applyAddresses}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyAddresses();
                  }
                }}
                placeholder="Address, city, or ZIP"
              />
            </label>
            <div className="visit-plan-endpoint-actions">
              <button type="button" className="ghost-btn" onClick={applyAddresses}>
                Update ends
              </button>
              <button type="button" className="ghost-btn" onClick={optimizeRoute}>
                Optimize route
              </button>
            </div>
          </div>
          {geocodeStatus ? <p className="visit-plan-status">{geocodeStatus}</p> : null}
          {tooMany ? (
            <p className="visit-plan-status">
              Optimized routing supports up to {VISIT_PLAN_MAX_SCHOOLS} schools. Remove some from
              Plan Visit, or drag a shorter subset after optimizing.
            </p>
          ) : null}

          <div className="trip-map-layout visit-plan-layout">
            <VisitPlanMap
              pointsById={pointsById}
              routeOrder={route.order}
              routeLegs={routeLegs}
              startPoint={startPoint}
              endPoint={endPoint}
              activeSchoolId={activeSchoolId}
              onActiveSchool={setActiveSchoolId}
            />
            <div className="trip-clist visit-plan-list">
              <div className="trip-near-head">
                <b>
                  {orderedSchoolIds.length} school
                  {orderedSchoolIds.length === 1 ? "" : "s"}
                  {route.totalMinutes != null
                    ? ` · ~${formatDriveDuration(route.totalMinutes)}`
                    : ""}
                </b>
                <span>
                  {ui.manualOrder
                    ? "Custom order — Optimize route to recalculate."
                    : "Suggested shortest drive order."}
                </span>
              </div>
              {orderedSchoolIds.map((id, index) => {
                const school = planned.find((row) => row.id === id);
                if (!school) return null;
                const point = pointsById.get(id);
                const level = point?.interest ?? "none";
                const legIn = route.legs[index];
                return (
                  <div
                    key={id}
                    className={`trip-cl${id === activeSchoolId ? " on" : ""}${
                      dragId === id ? " is-dragging" : ""
                    }`}
                    draggable
                    onDragStart={() => setDragId(id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => onDropOn(id)}
                    onDragEnd={() => setDragId(null)}
                    onMouseEnter={() => setActiveSchoolId(id)}
                  >
                    <div className="trip-cl-top">
                      <b>
                        <span className="visit-plan-stop-n">{index + 1}.</span> {school.name}
                      </b>
                      <span className="trip-cl-days">
                        {legIn && !legIn.missing && legIn.minutes != null
                          ? formatDriveDuration(legIn.minutes)
                          : "—"}
                      </span>
                    </div>
                    <span className="trip-cl-sub">
                      {school.location}
                      {level === "none" ? "" : ` · ${tripInterestLabel(level)}`}
                    </span>
                    <div className="trip-cl-bot">
                      <div className="trip-cl-marks">
                        <span
                          className={`trip-mk trip-mk-sm${level === "none" ? " none" : ""}`}
                          data-level={level}
                        >
                          <SchoolMark name={school.name} website={school.website} />
                        </span>
                      </div>
                      <div className="visit-plan-row-actions">
                        <button
                          type="button"
                          className="ghost-btn visit-plan-move"
                          aria-label="Move up"
                          disabled={index === 0}
                          onClick={() => moveSchool(id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="ghost-btn visit-plan-move"
                          aria-label="Move down"
                          disabled={index === orderedSchoolIds.length - 1}
                          onClick={() => moveSchool(id, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => onOpenSchool(id)}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => onRemoveFromPlan(id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="trip-foot">
            School-to-school times use the saved drive matrix when available; start/end legs are
            estimated from the map. Lines show visiting order, not turn-by-turn roads.
          </p>
        </>
      )}
    </section>
  );
}
