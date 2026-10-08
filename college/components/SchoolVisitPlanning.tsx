"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  Car,
  ForkKnife,
  MapTrifold,
} from "@phosphor-icons/react";
import type { CalendarEvent } from "@/lib/calendar-events";
import { formatDriveDuration } from "@/lib/drive-matrix";
import { INBOX_PARENT_ID, type PersistedProjectStep } from "@/lib/ingest";
import { memberOwnerId } from "@/lib/project-todos";
import type { ListPhaseId } from "@/lib/list-phases";
import type { School } from "@/lib/types";
import {
  VISIT_FILTER_LEVELS,
  anyFilterLevelOn,
  buildMapRouteParts,
  buildTripFromSelection,
  buildVisitClusters,
  buildVisitTripMeta,
  defaultVisitInterestFilter,
  defaultVisitStartId,
  filterVisitClusters,
  matrixLegEstimator,
  nearbySchoolStats,
  readStoredVisitFilter,
  schoolMapById,
  schoolMapLocation,
  shortSchoolName,
  travelPointMapLabel,
  visitEndpointOptions,
  visitInterestKey,
  visitInterestLabel,
  withDynamicClusterLegs,
  writeStoredVisitFilter,
  type VisitCluster,
  type VisitInterestFilter,
  type VisitInterestKey,
} from "@/lib/visit-planning";
import { SchoolMark } from "./SchoolMark";

const LEGEND: { key: VisitInterestKey; label: string }[] = [
  { key: "top", label: "Top choice" },
  { key: "high", label: "High interest" },
  { key: "moderate", label: "Moderate interest" },
  { key: "safety", label: "Safety / backup" },
  { key: "none", label: "Interest not set" },
];

function StopChip({
  school,
  here,
  selected,
  onToggle,
}: {
  school: School;
  here: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const level = visitInterestKey(school.interestLevel);
  return (
    <button
      type="button"
      className={`visit-stop${here ? " here" : ""}${selected ? " in-trip" : ""}`}
      data-level={level}
      aria-pressed={selected}
      title={`${school.name} · ${visitInterestLabel(school.interestLevel)}${
        selected ? " · In trip" : " · Tap to add to trip"
      }`}
      onClick={onToggle}
    >
      <SchoolMark name={school.name} website={school.website} />
      <span>{shortSchoolName(school.name)}</span>
    </button>
  );
}

function MapLinkList({
  parts,
  className,
}: {
  parts: ReturnType<typeof buildMapRouteParts>;
  className?: string;
}) {
  if (parts.length === 0) return null;
  if (parts.length === 1) {
    const part = parts[0]!;
    return (
      <div className={className}>
        <a href={part.googleUrl} target="_blank" rel="noopener noreferrer">
          Google Maps
        </a>
        <a href={part.appleUrl} target="_blank" rel="noopener noreferrer">
          Apple Maps
        </a>
      </div>
    );
  }
  return (
    <div className={className}>
      {parts.map((part) => (
        <span key={part.label} className="visit-map-part">
          <span>{part.label}:</span>
          <a href={part.googleUrl} target="_blank" rel="noopener noreferrer">
            Google Maps
          </a>
          <a href={part.appleUrl} target="_blank" rel="noopener noreferrer">
            Apple Maps
          </a>
        </span>
      ))}
    </div>
  );
}

function formatTotalDrive(minutes: number): string {
  if (minutes <= 0) return "";
  if (minutes < 60) return `${minutes} min driving`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours} hr driving` : `${hours} hr ${rem} min driving`;
}

export function SchoolVisitPlanning({
  school,
  listSchools,
  listPhaseId,
  processPhaseLabel,
  memberId,
  onSendVisitPlan,
}: {
  school: School;
  listSchools: School[];
  listPhaseId: ListPhaseId;
  processPhaseLabel: string | null;
  memberId: string;
  onSendVisitPlan: (payload: {
    events: CalendarEvent[];
    todos: PersistedProjectStep[];
  }) => void;
}) {
  const clusters = useMemo(
    () => buildVisitClusters(school, listSchools),
    [school, listSchools],
  );
  const byId = useMemo(() => schoolMapById(listSchools), [listSchools]);
  const trip = useMemo(
    () => buildVisitTripMeta(school, listPhaseId, processPhaseLabel),
    [school, listPhaseId, processPhaseLabel],
  );
  const endpointOptions = useMemo(() => visitEndpointOptions(school), [school]);
  const estimateLeg = useMemo(() => matrixLegEstimator(), []);

  const [filter, setFilter] = useState<VisitInterestFilter>(defaultVisitInterestFilter);
  /** Schools in the trip (individual selection). */
  const [tripIds, setTripIds] = useState<string[]>([school.id]);
  const [startId, setStartId] = useState(() => defaultVisitStartId(school));
  const [endChoice, setEndChoice] = useState<string>("__same__");
  const [toast, setToast] = useState<string | null>(null);

  const endId = endChoice === "__same__" ? startId : endChoice;

  useEffect(() => {
    setFilter(readStoredVisitFilter());
  }, []);

  useEffect(() => {
    // Reset trip + endpoints when navigating between school records.
    setTripIds([school.id]);
    setStartId(defaultVisitStartId(school));
    setEndChoice("__same__");
  }, [school.id]);

  // Keep start/end valid if region airports change.
  useEffect(() => {
    const allowed = new Set(endpointOptions.map((opt) => opt.id));
    if (!allowed.has(startId)) setStartId(defaultVisitStartId(school));
    if (endChoice !== "__same__" && !allowed.has(endChoice)) setEndChoice("__same__");
  }, [endpointOptions, startId, endChoice, school]);

  const filterOn = anyFilterLevelOn(filter);
  const filteredClusters = useMemo(
    () => (filterOn ? filterVisitClusters(clusters, school, byId, filter) : []),
    [clusters, school, byId, filter, filterOn],
  );

  useEffect(() => {
    const visible = new Set(
      filteredClusters.flatMap((cluster) => cluster.stops.map((stop) => stop.schoolId)),
    );
    setTripIds((prev) => {
      const next = prev.filter((id) => visible.has(id));
      // Keep the current school when it is still visible.
      if (visible.has(school.id) && !next.includes(school.id) && prev.includes(school.id)) {
        next.unshift(school.id);
      }
      return next;
    });
  }, [filteredClusters, school.id]);

  const displayClusters = useMemo(
    () =>
      filteredClusters.map((cluster) => withDynamicClusterLegs(cluster, byId, estimateLeg)),
    [filteredClusters, byId, estimateLeg],
  );

  const tripPlan = useMemo(
    () =>
      buildTripFromSelection(school, filteredClusters, tripIds, byId, {
        startId,
        endId,
        estimateLeg,
      }),
    [school, filteredClusters, tripIds, byId, startId, endId, estimateLeg],
  );

  const stats = nearbySchoolStats(clusters, filteredClusters, school.id);
  const allLevelsOn = VISIT_FILTER_LEVELS.every((key) => filter[key]);
  const days = tripPlan.days;
  const schoolCount = tripPlan.orderedIds.length;

  const mapOrigin = travelPointMapLabel(startId);
  const mapEnd = travelPointMapLabel(endId);

  const routeParts = useMemo(() => {
    const locations = tripPlan.orderedIds
      .map((id) => byId.get(id))
      .filter((row): row is School => Boolean(row))
      .map(schoolMapLocation);
    return buildMapRouteParts(locations, mapOrigin, mapEnd);
  }, [tripPlan.orderedIds, byId, mapOrigin, mapEnd]);

  function setFilterLevel(key: VisitInterestKey, on: boolean) {
    setFilter((prev) => {
      const next = { ...prev, [key]: on };
      writeStoredVisitFilter(next);
      return next;
    });
  }

  function showAllLevels() {
    const next = defaultVisitInterestFilter();
    writeStoredVisitFilter(next);
    setFilter(next);
  }

  function toggleTripSchool(id: string) {
    setTripIds((prev) => {
      if (prev.includes(id)) return prev.filter((row) => row !== id);
      // Adding a peer also keeps the current school on the trip when visible.
      const next = [...prev, id];
      if (id !== school.id && !next.includes(school.id)) next.unshift(school.id);
      return next;
    });
  }

  function toggleClusterAll(cluster: VisitCluster) {
    const ids = cluster.stops.map((stop) => stop.schoolId);
    const allOn = ids.every((id) => tripIds.includes(id));
    setTripIds((prev) => {
      if (allOn) return prev.filter((id) => !ids.includes(id));
      const next = [...prev];
      for (const id of ids) {
        if (!next.includes(id)) next.push(id);
      }
      return next;
    });
  }

  function clearTrip() {
    setTripIds([]);
  }

  function send() {
    if (!days.length) return;
    const owner = memberOwnerId(memberId);
    const createdAt = new Date().toISOString();
    const events: CalendarEvent[] = [];
    const todos: PersistedProjectStep[] = [];
    const todoSchoolIds = new Set<string>();

    days.forEach((daySlots, dayIndex) => {
      const date = new Date(`${trip.start}T12:00:00`);
      date.setDate(date.getDate() + dayIndex);
      const iso = date.toISOString().slice(0, 10);
      for (const slot of daySlots) {
        if (!slot.schoolId) continue;
        const stop = byId.get(slot.schoolId);
        events.push({
          id: `visit-${Math.random().toString(36).slice(2, 10)}`,
          title: slot.title,
          date: iso,
          startTime: slot.time.length === 4 ? `0${slot.time}` : slot.time,
          endTime: null,
          notes: "From Visit planning",
          createdAt,
          createdBy: owner,
          sourceId: "visit-plan",
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
            sourceId: "visit-plan",
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

  function dayLabel(index: number): string {
    const date = new Date(`${trip.start}T12:00:00`);
    date.setDate(date.getDate() + index);
    return `Day ${index + 1} · ${date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })}`;
  }

  function dayMapParts(dayIndex: number) {
    const slots = days[dayIndex] ?? [];
    const locations = slots
      .map((slot) => (slot.schoolId ? byId.get(slot.schoolId) : null))
      .filter((row): row is School => Boolean(row))
      .map(schoolMapLocation);
    const origin = dayIndex === 0 ? mapOrigin : null;
    const end = dayIndex === days.length - 1 ? mapEnd : null;
    return buildMapRouteParts(locations, origin, end);
  }

  const driveSummary = formatTotalDrive(tripPlan.totalDriveMinutes);
  const milesSummary =
    tripPlan.totalMiles != null && Number.isFinite(tripPlan.totalMiles)
      ? `${tripPlan.totalMiles} mi`
      : "";

  return (
    <section className="school-visit">
      <div className="school-visit-header">
        <div className="school-visit-kicker">
          <span className="school-visit-mark">
            <SchoolMark name={school.name} website={school.website} />
          </span>
          <b>{school.name}</b>
          <span className="school-visit-label">Visit planning</span>
        </div>
      </div>

      {!filterOn ? (
        <p className="visit-empty">Select at least one interest level.</p>
      ) : (
        <div className="visit-clusters" aria-label="Trip clusters">
          {displayClusters.map((cluster) => {
            const ids = cluster.stops.map((stop) => stop.schoolId);
            const allOn = ids.length > 0 && ids.every((id) => tripIds.includes(id));
            const someOn = ids.some((id) => tripIds.includes(id));
            return (
              <ClusterBlock
                key={cluster.id}
                cluster={cluster}
                baseId={school.id}
                byId={byId}
                allOn={allOn}
                someOn={someOn}
                tripIds={tripIds}
                onToggleAll={() => toggleClusterAll(cluster)}
                onToggleSelect={toggleTripSchool}
              />
            );
          })}
        </div>
      )}

      <div
        className="visit-legend visit-filter"
        role="group"
        aria-label="Filter by Kyle's interest"
      >
        <span className="school-visit-label school-visit-label-sm">Kyle&apos;s interest</span>
        {LEGEND.map((item) => (
          <button
            key={item.key}
            type="button"
            className="visit-filter-toggle"
            aria-pressed={filter[item.key]}
            onClick={() => setFilterLevel(item.key, !filter[item.key])}
          >
            <span className="visit-legend-sw" data-level={item.key} aria-hidden="true" />
            {item.label}
          </button>
        ))}
        <span className="visit-legend-here">
          <span className="visit-legend-sw visit-legend-sw-here" aria-hidden="true" />
          This school
        </span>
        <span className="visit-filter-count" aria-live="polite">
          Showing {stats.showing} of {stats.total}
          {!allLevelsOn ? (
            <>
              {" · "}
              <button type="button" className="visit-show-all" onClick={showAllLevels}>
                Show all
              </button>
            </>
          ) : null}
        </span>
      </div>

      {filterOn ? (
        <section className="visit-itinerary" aria-labelledby="visit-trip-title">
          <div className="visit-it-head">
            <div>
              <h2 id="visit-trip-title">{trip.name}</h2>
              <p>
                {trip.window} · {schoolCount} school{schoolCount === 1 ? "" : "s"} ·{" "}
                {days.length} day{days.length === 1 ? "" : "s"}
                {driveSummary ? ` · ${driveSummary}` : ""}
                {milesSummary ? ` · ${milesSummary}` : ""}
              </p>
            </div>
            <button
              type="button"
              className="visit-send"
              disabled={!days.length || tripPlan.tooMany}
              onClick={send}
            >
              <CalendarPlus size={18} weight="duotone" aria-hidden="true" />
              Send to Calendar
            </button>
          </div>

          {schoolCount > 0 ? (
            <div className="visit-map-row" aria-live="polite">
              <div className="visit-endpoints" role="group" aria-label="Trip start and end">
                <label>
                  Start
                  <select
                    value={startId}
                    onChange={(event) => setStartId(event.target.value)}
                  >
                    {endpointOptions.map((opt) => (
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
                    onChange={(event) => setEndChoice(event.target.value)}
                  >
                    <option value="__same__">Same as start</option>
                    {endpointOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="visit-route-actions">
                {routeParts.length === 1 ? (
                  <>
                    <a
                      className="visit-map-link"
                      href={routeParts[0]!.googleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapTrifold size={16} weight="duotone" aria-hidden="true" />
                      Google Maps
                    </a>
                    <a
                      className="visit-map-link"
                      href={routeParts[0]!.appleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapTrifold size={16} weight="duotone" aria-hidden="true" />
                      Apple Maps
                    </a>
                  </>
                ) : (
                  routeParts.map((part) => (
                    <span key={part.label} className="visit-map-part">
                      <span>{part.label}:</span>
                      <a href={part.googleUrl} target="_blank" rel="noopener noreferrer">
                        Google Maps
                      </a>
                      <a href={part.appleUrl} target="_blank" rel="noopener noreferrer">
                        Apple Maps
                      </a>
                    </span>
                  ))
                )}
                <button type="button" className="visit-clear" onClick={clearTrip}>
                  Clear trip
                </button>
              </div>
            </div>
          ) : null}

          {tripPlan.tooMany ? (
            <p className="visit-long-warn">
              Select 12 or fewer schools to plan a route.
            </p>
          ) : null}

          {tripPlan.longDriveLegs.length > 0 ? (
            <ul className="visit-long-warns" aria-label="Long drive warnings">
              {tripPlan.longDriveLegs.map((leg) => (
                <li key={`${leg.fromName}|${leg.toName}`}>
                  Long drive — {leg.fromName} to {leg.toName}:{" "}
                  {formatDriveDuration(leg.minutes)}. Consider splitting across two days.
                </li>
              ))}
            </ul>
          ) : null}

          {tripPlan.incomplete ? (
            <p className="visit-long-warn">
              Some drive times are missing from the stored matrix for this route.
            </p>
          ) : null}

          {days.length ? (
            <div className="visit-days">
              {days.map((slots, dayIndex) => (
                <div className="visit-day" key={`day-${dayIndex}`}>
                  <span className="school-visit-label school-visit-label-sm">
                    {dayLabel(dayIndex)}
                  </span>
                  <MapLinkList parts={dayMapParts(dayIndex)} className="visit-day-maps" />
                  {slots.map((slot, slotIndex) => {
                    const stop = slot.schoolId ? byId.get(slot.schoolId) : null;
                    const here = slot.schoolId === school.id;
                    return (
                      <div className="visit-slot" key={`${dayIndex}-${slotIndex}`}>
                        <time>{slot.time}</time>
                        <div
                          className={`visit-box${here ? " here" : ""}${
                            !slot.schoolId ? " gap" : ""
                          }${slot.longDrive ? " long-drive" : ""}`}
                        >
                          {stop ? (
                            <SchoolMark name={stop.name} website={stop.website} />
                          ) : slot.icon === "car" ? (
                            <Car size={18} weight="duotone" aria-hidden="true" />
                          ) : (
                            <ForkKnife size={18} weight="duotone" aria-hidden="true" />
                          )}
                          <div>
                            <b>{slot.title}</b>
                            {slot.sub ? <small>{slot.sub}</small> : null}
                            {slot.longDrive ? (
                              <small className="visit-slot-long">
                                Long drive — consider splitting across two days.
                              </small>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <p className="visit-empty">Add schools above to start a trip.</p>
          )}
          <p className="visit-foot">
            Tour and info session times are placeholders until booked. Drive times are from
            the stored Google Routes matrix.
          </p>
        </section>
      ) : null}

      {toast ? (
        <div className="visit-toast" role="status">
          {toast}
        </div>
      ) : null}
    </section>
  );
}

function ClusterBlock({
  cluster,
  baseId,
  byId,
  allOn,
  someOn,
  tripIds,
  onToggleAll,
  onToggleSelect,
}: {
  cluster: VisitCluster;
  baseId: string;
  byId: Map<string, School>;
  allOn: boolean;
  someOn: boolean;
  tripIds: string[];
  onToggleAll: () => void;
  onToggleSelect: (id: string) => void;
}) {
  const daysLabel =
    cluster.id === "same"
      ? "1 day"
      : `+${cluster.days} day${cluster.days === 1 ? "" : "s"}`;
  const peers = cluster.stops.filter((stop) => stop.schoolId !== baseId);
  const emptyPeers = peers.length === 0;

  return (
    <div className="visit-cluster">
      <div className="visit-c-head">
        <div>
          <h3>{cluster.name}</h3>
          <p>{cluster.sub}</p>
        </div>
        <div className="visit-c-side">
          <span className="visit-c-days">{daysLabel}</span>
          {!emptyPeers ? (
            <button
              type="button"
              className="visit-include"
              aria-pressed={allOn || someOn}
              data-partial={someOn && !allOn ? "true" : undefined}
              onClick={onToggleAll}
            >
              {allOn || someOn ? "In trip ✓" : "Add to trip"}
            </button>
          ) : null}
        </div>
      </div>
      {emptyPeers ? (
        <p className="visit-chain-empty">
          No schools at these interest levels in this range.
        </p>
      ) : (
        <>
          <div className="visit-chain">
            {cluster.stops.map((stop) => {
              const row = byId.get(stop.schoolId);
              if (!row) return null;
              const inTrip = tripIds.includes(stop.schoolId);
              return (
                <span key={stop.schoolId} className="visit-chain-piece">
                  {stop.driveFromPrev ? (
                    <span
                      className={`visit-leg${stop.longDrive ? " long-drive" : ""}`}
                      title={
                        stop.longDrive
                          ? "Long drive — consider splitting across two days."
                          : undefined
                      }
                    >
                      {stop.driveFromPrev}
                    </span>
                  ) : null}
                  <StopChip
                    school={row}
                    here={stop.schoolId === baseId}
                    selected={inTrip}
                    onToggle={() => onToggleSelect(stop.schoolId)}
                  />
                </span>
              );
            })}
          </div>
          {cluster.note ? <span className="visit-c-note">{cluster.note}</span> : null}
        </>
      )}
    </div>
  );
}
