"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { School } from "@/lib/types";
import {
  computePinNudges,
  spreadCoincidentCoords,
  toTripSchoolPoint,
  tripInterestLabel,
  type TripSchoolPoint,
} from "@/lib/trip-planning";
import { KYLE_STUDENT } from "@/lib/trip-planning/calendar";
import { schoolTravelPointId, travelPointById } from "@/lib/drive-matrix";
import { parseSchoolLocation, schoolMapLocation } from "@/lib/visit-planning";
import { campusCoordsForSchool } from "@/lib/campus-coords";
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
  defaultVisitPlanUiState,
  readVisitPlanUiState,
  writeVisitPlanUiState,
  type VisitPlanUiState,
} from "@/lib/visit-plan-state";
import {
  createSavedTripLocal,
  deleteSavedTripLocal,
  formatTripSavedWhen,
  formatTripSchoolSummary,
  listSavedTripsLocal,
  tripMapRouteParts,
  type SavedTrip,
} from "@/lib/saved-trips";
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
  memberId,
  memberName,
  onOpenSchool,
  onRemoveFromPlan,
  onLoadTripSchools,
}: {
  schools: School[];
  dateline: string;
  memberId: string;
  memberName: string;
  onOpenSchool: (id: string) => void;
  onRemoveFromPlan: (id: string) => void;
  /** Pin exactly these schools for Visit Planning (unpins the rest). */
  onLoadTripSchools: (schoolIds: string[]) => void;
}) {
  const planned = useMemo(
    () =>
      schools
        .filter((row) => !row.archived && row.planVisit)
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
  const [library, setLibrary] = useState<SavedTrip[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [tripNameDraft, setTripNameDraft] = useState("");
  const [libraryStatus, setLibraryStatus] = useState("");
  const [libraryBusy, setLibraryBusy] = useState(false);

  useEffect(() => {
    writeVisitPlanUiState(ui);
  }, [ui]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/visit-trips");
        if (res.ok) {
          const data = (await res.json()) as { items?: SavedTrip[] };
          if (!cancelled) setLibrary(Array.isArray(data.items) ? data.items : []);
          return;
        }
      } catch {
        /* fall through to local */
      }
      if (!cancelled) setLibrary(listSavedTripsLocal());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setStartDraft(ui.startAddress);
    setEndDraft(ui.endAddress);
  }, [ui.startAddress, ui.endAddress]);

  // Resolve campus pins: known campus coords first (avoids City Hall stacking),
  // then visit-address geocode, then city fallback.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = new Map(coordsById);
      let changed = false;
      for (const school of planned) {
        if (next.has(school.id)) continue;
        const known = campusCoordsForSchool(school.id);
        if (known) {
          next.set(school.id, known);
          changed = true;
          continue;
        }
        const visit = school.visitAddress?.trim();
        const travel = travelPointById(schoolTravelPointId(school.id))?.address?.trim();
        const query = schoolMapLocation(school);
        let point =
          (visit ? await geocodeAddress(visit) : null) ??
          (travel && travel !== visit ? await geocodeAddress(travel) : null) ??
          (await geocodeAddress(query));
        if (!point) {
          const loc = parseSchoolLocation(school.location);
          point = await geocodeCityState(loc.city, loc.state);
        }
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

  const displayCoords = useMemo(() => {
    const pts = [...coordsById.entries()]
      .filter((entry): entry is [string, GeoPoint] => Boolean(entry[1]))
      .map(([id, point]) => ({ id, lat: point.lat, lng: point.lng }));
    return spreadCoincidentCoords(pts);
  }, [coordsById]);

  const nudges = useMemo(() => {
    const pts = [...displayCoords.entries()].map(([id, point]) => ({
      id,
      lat: point.lat,
      lng: point.lng,
    }));
    return computePinNudges(pts);
  }, [displayCoords]);

  const pointsById = useMemo(() => {
    const map = new Map<string, TripSchoolPoint>();
    for (const school of planned) {
      const coords = displayCoords.get(school.id) ?? coordsById.get(school.id);
      if (!coords) continue;
      const point = toTripSchoolPoint(school, coords, nudges.get(school.id) ?? 0);
      if (point) map.set(school.id, point);
    }
    return map;
  }, [planned, coordsById, displayCoords, nudges]);

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
    setActiveTripId(null);
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
    setActiveTripId(null);
  }

  const schoolsById = useMemo(() => new Map(schools.map((row) => [row.id, row])), [schools]);

  const mapParts = useMemo(() => {
    if (!orderedSchoolIds.length) return [];
    return tripMapRouteParts(
      {
        schoolIds: orderedSchoolIds,
        startAddress: ui.startAddress,
        endAddress: ui.endAddress,
      },
      schoolsById,
    );
  }, [orderedSchoolIds, ui.startAddress, ui.endAddress, schoolsById]);

  async function saveCurrentTrip() {
    if (!orderedSchoolIds.length) {
      setLibraryStatus("Pin at least one school before saving a trip.");
      return;
    }
    const name = tripNameDraft.trim();
    if (!name) {
      setLibraryStatus("Name this trip to save it.");
      return;
    }
    setLibraryBusy(true);
    setLibraryStatus("Saving…");
    const schoolNames = orderedSchoolIds.map(
      (id) => planned.find((row) => row.id === id)?.name ?? id,
    );
    const payload = {
      name,
      schoolIds: orderedSchoolIds,
      schoolNames,
      startAddress: ui.startAddress,
      endAddress: ui.endAddress,
    };
    try {
      const res = await fetch("/api/visit-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = (await res.json()) as { item?: SavedTrip };
        if (data.item) {
          setLibrary((prev) => [data.item!, ...prev.filter((row) => row.id !== data.item!.id)]);
          setActiveTripId(data.item.id);
          setTripNameDraft("");
          setLibraryStatus(`Saved “${data.item.name}”.`);
          setLibraryBusy(false);
          return;
        }
      }
    } catch {
      /* local fallback */
    }
    const local = createSavedTripLocal({
      ...payload,
      createdById: memberId,
      createdByName: memberName,
    });
    setLibrary((prev) => [local, ...prev.filter((row) => row.id !== local.id)]);
    setActiveTripId(local.id);
    setTripNameDraft("");
    setLibraryStatus(`Saved “${local.name}” on this device.`);
    setLibraryBusy(false);
  }

  function loadTrip(trip: SavedTrip) {
    setActiveTripId(trip.id);
    setStartDraft(trip.startAddress);
    setEndDraft(trip.endAddress);
    setUi({
      startAddress: trip.startAddress,
      endAddress: trip.endAddress,
      manualOrder: trip.schoolIds,
    });
    onLoadTripSchools(trip.schoolIds);
    setLibraryStatus(`Loaded “${trip.name}”.`);
  }

  async function removeTrip(trip: SavedTrip) {
    setLibraryBusy(true);
    try {
      const res = await fetch(`/api/visit-trips/${encodeURIComponent(trip.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
    } catch {
      deleteSavedTripLocal(trip.id);
    }
    setLibrary((prev) => prev.filter((row) => row.id !== trip.id));
    if (activeTripId === trip.id) setActiveTripId(null);
    setLibraryStatus(`Deleted “${trip.name}”.`);
    setLibraryBusy(false);
  }

  const workingTripDirty =
    planned.length > 0 ||
    Boolean(ui.manualOrder?.length) ||
    Boolean(activeTripId) ||
    ui.startAddress.trim() !== DEFAULT_VISIT_START_ADDRESS ||
    ui.endAddress.trim() !== DEFAULT_VISIT_END_ADDRESS;

  function startNewTrip() {
    if (planned.length > 0) {
      const pinLabel =
        planned.length === 1 ? "1 pinned school" : `${planned.length} pinned schools`;
      const ok = window.confirm(
        `Clear ${pinLabel} and start a new trip?\n\nSaved library trips stay. Pin schools on Colleges to build the next route.`,
      );
      if (!ok) return;
    } else if (workingTripDirty) {
      const ok = window.confirm("Reset start/end addresses and clear the working trip?");
      if (!ok) return;
    } else {
      setLibraryStatus("Already clear — pin schools on Colleges to start a trip.");
      return;
    }

    const fresh = defaultVisitPlanUiState();
    onLoadTripSchools([]);
    setUi(fresh);
    setStartDraft(fresh.startAddress);
    setEndDraft(fresh.endAddress);
    setStartPoint({ lat: KYLE_STUDENT.homeLat, lng: KYLE_STUDENT.homeLng });
    setEndPoint({ lat: KYLE_STUDENT.homeLat, lng: KYLE_STUDENT.homeLng });
    setCoordsById(new Map());
    setActiveSchoolId(null);
    setDragId(null);
    setActiveTripId(null);
    setTripNameDraft("");
    setGeocodeStatus("");
    setLibraryStatus("Working trip cleared. Pin schools on Colleges to build a new one.");
  }

  return (
    <section className="visit-plan-page">
      <header className="page-head visit-plan-head">
        <div>
          <div className="dateline">{dateline}</div>
          <h2>Visit Planning</h2>
          <p className="page-sub">
            Schools pinned for a visit on the Colleges list. We suggest a drive order; drag the
            list (or use the arrows) to change it. Save a named trip to the library, then open it
            in Google Maps for turn-by-turn directions.
          </p>
        </div>
        <button
          type="button"
          className="ghost-btn visit-plan-new-trip"
          disabled={libraryBusy}
          onClick={startNewTrip}
        >
          New trip
        </button>
      </header>

      <div className="visit-plan-library">
        <div className="visit-plan-library-head">
          <h3>Trip library</h3>
          <span className="visit-plan-library-count">
            {library.length} saved
          </span>
        </div>
        {library.length === 0 ? (
          <p className="visit-plan-library-empty">
            No saved trips yet. Build a route below, name it, and save.
          </p>
        ) : (
          <ul className="visit-plan-library-list">
            {library.map((trip) => (
              <li
                key={trip.id}
                className={`visit-plan-library-item${
                  trip.id === activeTripId ? " is-active" : ""
                }`}
              >
                <button
                  type="button"
                  className="visit-plan-library-open"
                  onClick={() => loadTrip(trip)}
                >
                  <b>{trip.name}</b>
                  <span>
                    {trip.schoolIds.length} stop
                    {trip.schoolIds.length === 1 ? "" : "s"}
                    {formatTripSavedWhen(trip.updatedAt)
                      ? ` · ${formatTripSavedWhen(trip.updatedAt)}`
                      : ""}
                  </span>
                  <span className="visit-plan-library-schools">
                    {formatTripSchoolSummary(trip)}
                  </span>
                </button>
                <div className="visit-plan-library-actions">
                  <LibraryMapsLinks trip={trip} schoolsById={schoolsById} />
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={libraryBusy}
                    onClick={() => void removeTrip(trip)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {libraryStatus ? <p className="visit-plan-status">{libraryStatus}</p> : null}
      </div>

      {!planned.length ? (
        <p className="trip-empty">
          No schools on the visit plan yet. On Colleges, click the pin beside a school name to add
          it — or open a trip from the library above.
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
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  optimizeRoute();
                  setActiveTripId(null);
                }}
              >
                Optimize route
              </button>
            </div>
          </div>
          {geocodeStatus ? <p className="visit-plan-status">{geocodeStatus}</p> : null}
          {tooMany ? (
            <p className="visit-plan-status">
              Optimized routing supports up to {VISIT_PLAN_MAX_SCHOOLS} schools. Unpin some, or
              drag a shorter subset after optimizing.
            </p>
          ) : null}

          <div className="trip-map-layout visit-plan-layout">
            <VisitPlanMap
              pointsById={pointsById}
              expectedSchoolIds={plannedIds}
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
          <div className="visit-plan-save">
            <label>
              <span className="trip-label trip-label-sm">Save trip as</span>
              <input
                type="text"
                value={tripNameDraft}
                onChange={(event) => setTripNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void saveCurrentTrip();
                  }
                }}
                placeholder="e.g. Mid-Atlantic spring"
                maxLength={80}
              />
            </label>
            <button
              type="button"
              className="ghost-btn"
              disabled={libraryBusy || !orderedSchoolIds.length}
              onClick={() => void saveCurrentTrip()}
            >
              Save to library
            </button>
            <button
              type="button"
              className="ghost-btn"
              disabled={libraryBusy}
              onClick={startNewTrip}
            >
              New trip
            </button>
            <div className="visit-plan-export">
              {mapParts.length === 1 ? (
                <a
                  className="visit-map-link"
                  href={mapParts[0]!.googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Google Maps
                </a>
              ) : (
                mapParts.map((part) => (
                  <a
                    key={part.label}
                    className="visit-map-link"
                    href={part.googleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {part.label} · Google Maps
                  </a>
                ))
              )}
            </div>
          </div>

          <p className="trip-foot">
            School-to-school times use the saved drive matrix when available; start/end legs are
            estimated from the map. Lines show visiting order, not turn-by-turn roads — use Google
            Maps for driving instructions.
          </p>
        </>
      )}
    </section>
  );
}

function LibraryMapsLinks({
  trip,
  schoolsById,
}: {
  trip: SavedTrip;
  schoolsById: Map<string, School>;
}) {
  const parts = tripMapRouteParts(trip, schoolsById);
  if (!parts.length) return null;
  return (
    <>
      {parts.map((part) => (
        <a
          key={`${trip.id}-${part.label}`}
          className="visit-map-link"
          href={part.googleUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {parts.length > 1 ? `${part.label} · Maps` : "Google Maps"}
        </a>
      ))}
    </>
  );
}
