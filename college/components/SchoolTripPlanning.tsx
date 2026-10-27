"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { CalendarEvent } from "@/lib/calendar-events";
import { INBOX_PARENT_ID, type PersistedProjectStep } from "@/lib/ingest";
import { memberOwnerId } from "@/lib/project-todos";
import type { School } from "@/lib/types";
import { geocodeCityState, type GeoPoint } from "@/lib/visit-geo";
import {
  buildTripFromSelection,
  defaultVisitStartId,
  parseSchoolLocation,
  schoolMapById,
  shortSchoolName,
} from "@/lib/visit-planning";
import {
  KYLE_STUDENT,
  TRIP_INTEREST_LABEL,
  TRIP_INTEREST_ORDER,
  buildNearbyDriveSchools,
  climateForCityState,
  computePinNudges,
  defaultTripPlanState,
  flightBlurb,
  isoDate,
  preferredTripSeason,
  readTripPlanState,
  resolveCompareClimate,
  buildCampusCalendar,
  toTripSchoolPoint,
  tripTitle,
  tripWeekGridForSeason,
  toggleSchoolInTrip,
  weekDate,
  writeTripPlanState,
  type TripInterestKey,
  type TripPlanState,
  type TripSchoolPoint,
  type TripSeasonId,
} from "@/lib/trip-planning";
import { travelModeForSchool } from "@/lib/drive-matrix";
import { TripWhenPanel } from "./trip/TripWhenPanel";
import { TripItineraryPanel } from "./trip/TripItineraryPanel";
import { TripClimatePanel } from "./trip/TripClimatePanel";
import { TripCampusCalendarSection } from "./trip/TripCampusCalendarSection";
import { TripAllSchoolsPanel } from "./trip/TripAllSchoolsPanel";
import { TripNearbyList } from "./trip/TripNearbyList";

const TripNearbyMap = dynamic(
  () => import("./trip/TripNearbyMap").then((mod) => mod.TripNearbyMap),
  {
    ssr: false,
    loading: () => <div className="trip-vmap trip-vmap-loading" aria-hidden="true" />,
  },
);

type TripSubtab = "nearby" | "when" | "itinerary" | "climate" | "all";

export function SchoolTripPlanning({
  school,
  listSchools,
  memberId,
  onSendVisitPlan,
}: {
  school: School;
  listSchools: School[];
  memberId: string;
  onSendVisitPlan: (payload: {
    events: CalendarEvent[];
    todos: PersistedProjectStep[];
  }) => void;
}) {
  const byId = useMemo(() => schoolMapById(listSchools), [listSchools]);
  const peerRows = useMemo(
    () => listSchools.filter((row) => !row.archived).map((row) => ({ id: row.id, name: row.name })),
    [listSchools],
  );
  const nearbyRows = useMemo(
    () => buildNearbyDriveSchools(school, listSchools),
    [school, listSchools],
  );
  const nearbyIdSet = useMemo(
    () => new Set(nearbyRows.map((row) => row.schoolId)),
    [nearbyRows],
  );

  const [subtab, setSubtab] = useState<TripSubtab>("nearby");
  const [plan, setPlan] = useState<TripPlanState>(() =>
    defaultTripPlanState([school.id], "fall"),
  );
  const [activeSchoolId, setActiveSchoolId] = useState<string>(school.id);
  const [coordsById, setCoordsById] = useState<Map<string, GeoPoint | null>>(() => new Map());
  const [cmpId, setCmpId] = useState("home");
  const [toast, setToast] = useState<string | null>(null);

  const endpointId = useMemo(() => defaultVisitStartId(school), [school]);

  // Reload plan + land on Nearby only when switching school or member.
  useEffect(() => {
    const stored = readTripPlanState(memberId, school.id);
    if (stored) {
      const schoolIds = stored.schoolIds.filter((id) => nearbyIdSet.has(id) || id === school.id);
      setPlan({
        schoolIds: schoolIds.length ? schoolIds : [school.id],
        weekIndex: stored.weekIndex,
        season: stored.season,
      });
    } else {
      setPlan(defaultTripPlanState([school.id], "fall"));
    }
    setActiveSchoolId(school.id);
    setSubtab("nearby");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- school/member switch only
  }, [memberId, school.id]);

  // Drop schools that leave the 3-hour ring when the list rebuilds.
  useEffect(() => {
    setPlan((prev) => {
      const nextIds = prev.schoolIds.filter((id) => nearbyIdSet.has(id) || id === school.id);
      if (
        nextIds.length === prev.schoolIds.length &&
        nextIds.every((id, i) => id === prev.schoolIds[i])
      ) {
        return prev;
      }
      return { ...prev, schoolIds: nextIds.length ? nextIds : [school.id] };
    });
    setActiveSchoolId((prev) => (nearbyIdSet.has(prev) ? prev : school.id));
  }, [nearbyIdSet, school.id]);

  useEffect(() => {
    writeTripPlanState(memberId, school.id, plan);
  }, [memberId, school.id, plan]);

  const tripPlan = useMemo(
    () =>
      buildTripFromSelection(school, [], plan.schoolIds, byId, {
        startId: endpointId,
        endId: endpointId,
      }),
    [school, plan.schoolIds, byId, endpointId],
  );

  const tripSchoolIds = tripPlan.orderedIds;
  const tripDays = tripPlan.days;

  const season = useMemo<TripSeasonId>(() => {
    const ids = tripSchoolIds.length ? tripSchoolIds : [school.id];
    const modes = ids.map((id) => travelModeForSchool(id, peerRows));
    return preferredTripSeason(modes);
  }, [tripSchoolIds, school.id, peerRows]);

  const weekGrid = useMemo(() => tripWeekGridForSeason(season), [season]);
  const drivePriority = season === "fall";

  useEffect(() => {
    setPlan((prev) => {
      if (prev.season === season) return prev;
      return {
        ...prev,
        season,
        weekIndex: weekGrid.defaultWeekIndex,
      };
    });
  }, [season, weekGrid.defaultWeekIndex]);

  useEffect(() => {
    const ids = new Set<string>([
      school.id,
      ...nearbyRows.map((row) => row.schoolId),
      ...listSchools.filter((row) => !row.archived).map((row) => row.id),
    ]);
    let cancelled = false;
    void (async () => {
      const next = new Map(coordsById);
      let changed = false;
      for (const id of ids) {
        if (next.has(id)) continue;
        const row = byId.get(id) ?? (id === school.id ? school : null);
        if (!row) continue;
        const loc = parseSchoolLocation(row.location);
        const point = await geocodeCityState(loc.city, loc.state);
        if (cancelled) return;
        next.set(id, point);
        changed = true;
      }
      if (changed && !cancelled) setCoordsById(new Map(next));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school.id, nearbyRows, listSchools, byId]);

  const nudges = useMemo(() => {
    const pts = [...coordsById.entries()]
      .filter((entry): entry is [string, GeoPoint] => Boolean(entry[1]))
      .map(([id, point]) => ({ id, lat: point.lat, lng: point.lng }));
    return computePinNudges(pts);
  }, [coordsById]);

  const nearbyPointsById = useMemo(() => {
    const map = new Map<string, TripSchoolPoint>();
    for (const row of nearbyRows) {
      const coords = coordsById.get(row.schoolId);
      const schoolRow = byId.get(row.schoolId);
      if (!schoolRow || !coords) continue;
      const point = toTripSchoolPoint(schoolRow, coords, nudges.get(row.schoolId) ?? 0);
      if (point) map.set(row.schoolId, point);
    }
    return map;
  }, [nearbyRows, coordsById, byId, nudges]);

  const allCoordsById = coordsById;

  const calendars = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildCampusCalendar>>();
    for (const id of tripSchoolIds) {
      const row = byId.get(id);
      if (!row) continue;
      map.set(id, buildCampusCalendar(row.name, weekGrid));
    }
    return map;
  }, [tripSchoolIds, byId, weekGrid]);

  const schoolPoint = coordsById.get(school.id) ?? null;
  const flight = useMemo(() => flightBlurb(schoolPoint), [schoolPoint]);

  const campusClimate = useMemo(() => {
    const loc = parseSchoolLocation(school.location);
    const short = shortSchoolName(school.name);
    const display =
      loc.city && short.toLowerCase().endsWith(`, ${loc.city.toLowerCase()}`)
        ? short.slice(0, -(loc.city.length + 2)).trim()
        : short;
    return climateForCityState(school.id, display, loc.city, loc.state);
  }, [school]);

  const routeLegs = useMemo(() => {
    const ordered = tripPlan.orderedIds;
    const labels: (string | null)[] = [];
    for (let i = 1; i < ordered.length; i += 1) {
      const stop = tripPlan.stops.find((row) => row.schoolId === ordered[i]);
      labels.push(stop?.driveFromPrev ?? null);
    }
    return labels;
  }, [tripPlan]);

  const inTripCount = plan.schoolIds.length;

  function setWeekIndex(weekIndex: number) {
    setPlan((prev) => ({ ...prev, weekIndex }));
  }

  function toggleSchool(id: string) {
    setPlan((prev) => toggleSchoolInTrip(prev, id, school.id));
  }

  function sendToCalendar() {
    if (!tripDays.length) return;
    const owner = memberOwnerId(memberId);
    const createdAt = new Date().toISOString();
    const events: CalendarEvent[] = [];
    const todos: PersistedProjectStep[] = [];
    const todoSchoolIds = new Set<string>();

    tripDays.forEach((daySlots, dayIndex) => {
      const date = weekDate(plan.weekIndex, dayIndex, weekGrid);
      const iso = isoDate(date);
      for (const slot of daySlots) {
        if (!slot.schoolId) continue;
        const stop = byId.get(slot.schoolId);
        events.push({
          id: `trip-${Math.random().toString(36).slice(2, 10)}`,
          title: slot.title,
          date: iso,
          startTime: slot.time.length === 4 ? `0${slot.time}` : slot.time,
          endTime: null,
          notes: "From Trip planning",
          createdAt,
          createdBy: owner,
          sourceId: "trip-plan",
          assetUrl: null,
          assetPath: null,
          schoolId: slot.schoolId,
          sourceNoteId: null,
        });
        if (!todoSchoolIds.has(slot.schoolId)) {
          todoSchoolIds.add(slot.schoolId);
          todos.push({
            id: `todo-${Math.random().toString(36).slice(2, 10)}`,
            label: `Book ${stop?.name ?? "school"} tour`,
            owner,
            assignedBy: owner,
            parentId: INBOX_PARENT_ID,
            dueDate: iso,
            startDate: null,
            endDate: null,
            sourceId: "trip-plan",
            createdAt,
            schoolId: slot.schoolId,
          });
        }
      }
    });

    onSendVisitPlan({ events, todos });
    setToast(`${events.length} visit${events.length === 1 ? "" : "s"} sent to Calendar`);
    window.setTimeout(() => setToast(null), 2400);
  }

  const subtabs: { id: TripSubtab; label: string; count?: string }[] = [
    {
      id: "nearby",
      label: "Nearby",
      count: inTripCount ? `${inTripCount} in trip` : undefined,
    },
    { id: "when", label: "When to go" },
    {
      id: "itinerary",
      label: "Itinerary",
      count: tripDays.length
        ? `${tripDays.length} ${tripDays.length === 1 ? "day" : "days"}`
        : undefined,
    },
    { id: "climate", label: "Climate" },
    {
      id: "all",
      label: "All schools",
      count: String(listSchools.filter((s) => !s.archived).length),
    },
  ];

  return (
    <section className="school-trip">
      <div className="school-pm-subtabs" role="tablist" aria-label="Trip planning sections">
        {subtabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className="school-pm-subtab"
            aria-selected={subtab === tab.id}
            onClick={() => setSubtab(tab.id)}
          >
            <span>{tab.label}</span>
            {tab.count ? <span className="school-pm-count">{tab.count}</span> : null}
          </button>
        ))}
      </div>

      {subtab === "nearby" ? (
        <div className="trip-panel" role="tabpanel">
          <div className="trip-map-layout">
            <TripNearbyMap
              schoolId={school.id}
              pointsById={nearbyPointsById}
              schoolIds={plan.schoolIds}
              routeOrder={tripPlan.orderedIds}
              routeLegs={routeLegs}
              activeSchoolId={activeSchoolId}
              airport={{
                iata: flight.airport,
                lat: flight.lat,
                lng: flight.lng,
              }}
              onActiveSchool={setActiveSchoolId}
              onToggleSchool={toggleSchool}
            />
            <TripNearbyList
              schoolId={school.id}
              rows={nearbyRows}
              pointsById={nearbyPointsById}
              schoolIds={plan.schoolIds}
              activeSchoolId={activeSchoolId}
              flight={flight.flight}
              areaLabel={parseSchoolLocation(school.location).label}
              onActiveSchool={setActiveSchoolId}
              onToggleSchool={toggleSchool}
            />
          </div>
          <InterestLegend here />
          <p className="trip-foot">
            Select schools within 3 hours to build a drive route. Lines show visiting order, not
            turn-by-turn roads. Double-click the map to see every nearby school.
          </p>
        </div>
      ) : null}

      {subtab === "when" ? (
        <TripWhenPanel
          weekIndex={plan.weekIndex}
          tripSchoolIds={tripSchoolIds}
          byId={byId}
          calendars={calendars}
          tripDayCount={tripDays.length}
          weatherLabel={parseSchoolLocation(school.location).city || "Campus"}
          grid={weekGrid}
          drivePriority={drivePriority}
          onWeekIndex={setWeekIndex}
        />
      ) : null}

      {subtab === "itinerary" ? (
        <TripItineraryPanel
          title={tripTitle(school)}
          weekIndex={plan.weekIndex}
          weekLabel={weekGrid.weekLabels[plan.weekIndex] ?? ""}
          schoolId={school.id}
          tripSchoolIds={tripSchoolIds}
          tripDays={tripDays}
          byId={byId}
          calendars={calendars}
          weekGrid={weekGrid}
          onGoWhen={() => setSubtab("when")}
          onSend={sendToCalendar}
        />
      ) : null}

      {subtab === "climate" ? (
        <>
          <TripClimatePanel
            campus={campusClimate}
            compareId={cmpId}
            compare={resolveCompareClimate(cmpId)}
            onCompare={setCmpId}
          />
          <TripCampusCalendarSection schoolName={school.name} />
        </>
      ) : null}

      {subtab === "all" ? (
        <TripAllSchoolsPanel
          schoolId={school.id}
          listSchools={listSchools}
          coordsById={allCoordsById}
        />
      ) : null}

      {toast ? (
        <div className="trip-toast" role="status">
          {toast}
        </div>
      ) : null}
    </section>
  );
}

function InterestLegend({ here }: { here?: boolean }) {
  return (
    <div className="trip-legend">
      <span className="trip-label trip-label-sm">{KYLE_STUDENT.name}&apos;s interest</span>
      {TRIP_INTEREST_ORDER.map((key) => (
        <span key={key}>
          <span
            className={`trip-sw${key === "none" ? " trip-sw-none" : ""}`}
            data-level={key}
          />
          {TRIP_INTEREST_LABEL[key as TripInterestKey]}
        </span>
      ))}
      {here ? (
        <span className="trip-legend-here">
          <span className="trip-sw trip-sw-here" />
          This school
        </span>
      ) : null}
    </div>
  );
}
