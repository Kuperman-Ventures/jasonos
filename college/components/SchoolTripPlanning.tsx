"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { CalendarEvent } from "@/lib/calendar-events";
import { INBOX_PARENT_ID, type PersistedProjectStep } from "@/lib/ingest";
import { memberOwnerId } from "@/lib/project-todos";
import type { School } from "@/lib/types";
import { geocodeCityState, type GeoPoint } from "@/lib/visit-geo";
import { parseSchoolLocation, schoolMapById, shortSchoolName } from "@/lib/visit-planning";
import {
  HOME_CLIMATE,
  BOSTON_CLIMATE,
  KYLE_STUDENT,
  TRIP_INTEREST_LABEL,
  TRIP_INTEREST_ORDER,
  TRIP_WEEK_LABELS,
  buildTripClusters,
  climateForCityState,
  computePinNudges,
  defaultTripPlanState,
  flightBlurb,
  isoDate,
  readTripPlanState,
  resolveCompareClimate,
  schoolsInTripClusters,
  stubCampusCalendar,
  toTripSchoolPoint,
  tripDaysFromClusters,
  tripTitle,
  toggleClusterInTrip,
  weekDate,
  writeTripPlanState,
  type TripInterestKey,
  type TripPlanState,
  type TripSchoolPoint,
} from "@/lib/trip-planning";
import { SchoolMark } from "./SchoolMark";
import { TripWhenPanel } from "./trip/TripWhenPanel";
import { TripItineraryPanel } from "./trip/TripItineraryPanel";
import { TripClimatePanel } from "./trip/TripClimatePanel";
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
  const clusters = useMemo(
    () => buildTripClusters(school, listSchools),
    [school, listSchools],
  );
  const byId = useMemo(() => schoolMapById(listSchools), [listSchools]);

  const [subtab, setSubtab] = useState<TripSubtab>("nearby");
  const [plan, setPlan] = useState<TripPlanState>(() =>
    defaultTripPlanState(clusters[0] ? [clusters[0].id] : ["same"]),
  );
  const [activeClusterId, setActiveClusterId] = useState<string>(
    () => clusters[0]?.id ?? "same",
  );
  const [coordsById, setCoordsById] = useState<Map<string, GeoPoint | null>>(() => new Map());
  const [cmpId, setCmpId] = useState("home");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const stored = readTripPlanState(memberId, school.id);
    const available = new Set<string>(clusters.map((c) => c.id));
    if (stored) {
      const clusterIds = stored.clusterIds.filter((id) => available.has(id));
      setPlan({
        clusterIds: clusterIds.length
          ? clusterIds
          : defaultTripPlanState(clusters[0] ? [clusters[0].id] : ["same"]).clusterIds,
        weekIndex: stored.weekIndex,
      });
    } else {
      setPlan(defaultTripPlanState(clusters[0] ? [clusters[0].id] : ["same"]));
    }
    setActiveClusterId(clusters[0]?.id ?? "same");
    setSubtab("nearby");
  }, [memberId, school.id, clusters]);

  useEffect(() => {
    writeTripPlanState(memberId, school.id, plan);
  }, [memberId, school.id, plan]);

  useEffect(() => {
    const live = listSchools.filter((row) => !row.archived);
    const ids = new Set<string>([
      school.id,
      ...clusters.flatMap((c) => c.stops.map((s) => s.schoolId)),
      ...live.map((row) => row.id),
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
  }, [school.id, clusters, listSchools, byId]);

  const nudges = useMemo(() => {
    const pts = [...coordsById.entries()]
      .filter((entry): entry is [string, GeoPoint] => Boolean(entry[1]))
      .map(([id, point]) => ({ id, lat: point.lat, lng: point.lng }));
    return computePinNudges(pts);
  }, [coordsById]);

  const pointsById = useMemo(() => {
    const map = new Map<string, TripSchoolPoint>();
    for (const [id, coords] of coordsById) {
      const row = byId.get(id);
      if (!row || !coords) continue;
      const point = toTripSchoolPoint(row, coords, nudges.get(id) ?? 0);
      if (point) map.set(id, point);
    }
    return map;
  }, [coordsById, byId, nudges]);

  const tripSchoolIds = useMemo(
    () => schoolsInTripClusters(clusters, plan.clusterIds),
    [clusters, plan.clusterIds],
  );
  const tripDays = useMemo(
    () => tripDaysFromClusters(clusters, plan.clusterIds),
    [clusters, plan.clusterIds],
  );

  const calendars = useMemo(() => {
    const map = new Map<string, ReturnType<typeof stubCampusCalendar>>();
    for (const id of tripSchoolIds) {
      map.set(id, stubCampusCalendar(id));
    }
    return map;
  }, [tripSchoolIds]);

  const schoolPoint = coordsById.get(school.id) ?? null;
  const flight = useMemo(() => flightBlurb(schoolPoint), [schoolPoint]);

  const campusClimate = useMemo(() => {
    const loc = parseSchoolLocation(school.location);
    return climateForCityState(school.id, shortSchoolName(school.name), loc.city, loc.state);
  }, [school]);

  const inTripCount = plan.clusterIds.filter((id) =>
    clusters.some((c) => c.id === id),
  ).length;

  function setWeekIndex(weekIndex: number) {
    setPlan((prev) => ({ ...prev, weekIndex }));
  }

  function toggleCluster(clusterId: string) {
    setPlan((prev) => toggleClusterInTrip(prev, clusterId));
  }

  function sendToCalendar() {
    if (!tripDays.length) return;
    const owner = memberOwnerId(memberId);
    const createdAt = new Date().toISOString();
    const events: CalendarEvent[] = [];
    const todos: PersistedProjectStep[] = [];
    const todoSchoolIds = new Set<string>();

    tripDays.forEach((daySlots, dayIndex) => {
      const date = weekDate(plan.weekIndex, dayIndex);
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
      <div className="trip-kicker">
        <span className="trip-kicker-mark">
          <SchoolMark name={school.name} website={school.website} />
        </span>
        <b>{school.name}</b>
        <span className="trip-label">Trip planning</span>
      </div>

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
              clusters={clusters}
              pointsById={pointsById}
              clusterIds={plan.clusterIds}
              activeClusterId={activeClusterId}
              airport={{
                iata: flight.airport,
                lat: flight.lat,
                lng: flight.lng,
              }}
              onActiveCluster={setActiveClusterId}
              onToggleCluster={toggleCluster}
            />
            <TripNearbyList
              schoolId={school.id}
              clusters={clusters}
              pointsById={pointsById}
              clusterIds={plan.clusterIds}
              activeClusterId={activeClusterId}
              flight={flight.flight}
              areaLabel={parseSchoolLocation(school.location).label}
              onActiveCluster={setActiveClusterId}
              onToggleCluster={toggleCluster}
            />
          </div>
          <InterestLegend here />
          <p className="trip-foot">
            Lines show visiting order, not road routes. Double-click the map to see every cluster.
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
          onWeekIndex={setWeekIndex}
        />
      ) : null}

      {subtab === "itinerary" ? (
        <TripItineraryPanel
          title={tripTitle(school)}
          weekIndex={plan.weekIndex}
          weekLabel={TRIP_WEEK_LABELS[plan.weekIndex] ?? ""}
          schoolId={school.id}
          tripSchoolIds={tripSchoolIds}
          tripDays={tripDays}
          byId={byId}
          calendars={calendars}
          onGoWhen={() => setSubtab("when")}
          onSend={sendToCalendar}
        />
      ) : null}

      {subtab === "climate" ? (
        <TripClimatePanel
          campus={campusClimate}
          compareId={cmpId}
          compare={resolveCompareClimate(cmpId)}
          home={HOME_CLIMATE}
          boston={BOSTON_CLIMATE}
          onCompare={setCmpId}
        />
      ) : null}

      {subtab === "all" ? (
        <TripAllSchoolsPanel
          schoolId={school.id}
          listSchools={listSchools}
          coordsById={coordsById}
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
