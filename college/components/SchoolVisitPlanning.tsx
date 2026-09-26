"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  Car,
  CheckCircle,
  ForkKnife,
  MapTrifold,
} from "@phosphor-icons/react";
import type { CalendarEvent } from "@/lib/calendar-events";
import { INBOX_PARENT_ID, type PersistedProjectStep } from "@/lib/ingest";
import { memberOwnerId } from "@/lib/project-todos";
import type { ListPhaseId } from "@/lib/list-phases";
import type { School } from "@/lib/types";
import {
  VISIT_FILTER_LEVELS,
  anyFilterLevelOn,
  buildMapRouteParts,
  buildVisitClusters,
  buildVisitTripMeta,
  defaultVisitInterestFilter,
  filterVisitClusters,
  nearbySchoolStats,
  readStoredVisitFilter,
  schoolMapById,
  schoolMapLocation,
  shortSchoolName,
  visitInterestKey,
  visitInterestLabel,
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
  { key: "none", label: "Not on list" },
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
      className={`visit-stop${here ? " here" : ""}`}
      data-level={level}
      aria-pressed={selected}
      title={`${school.name} · ${visitInterestLabel(school.interestLevel)}`}
      onClick={onToggle}
    >
      <SchoolMark name={school.name} website={school.website} />
      <span>{shortSchoolName(school.name)}</span>
      {selected ? (
        <CheckCircle size={16} weight="duotone" aria-label="Selected" />
      ) : null}
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

  const [filter, setFilter] = useState<VisitInterestFilter>(defaultVisitInterestFilter);
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [startFrom, setStartFrom] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setFilter(readStoredVisitFilter());
  }, []);

  useEffect(() => {
    setIncluded((prev) => {
      const next: Record<string, boolean> = {};
      clusters.forEach((cluster, index) => {
        next[cluster.id] = prev[cluster.id] ?? index < 2;
      });
      return next;
    });
  }, [clusters]);

  const filterOn = anyFilterLevelOn(filter);
  const filteredClusters = useMemo(
    () => (filterOn ? filterVisitClusters(clusters, school, byId, filter) : []),
    [clusters, school, byId, filter, filterOn],
  );

  useEffect(() => {
    // Drop selection for schools hidden by the filter
    const visible = new Set(
      filteredClusters.flatMap((cluster) => cluster.stops.map((stop) => stop.schoolId)),
    );
    setSelectedIds((prev) => prev.filter((id) => visible.has(id)));
  }, [filteredClusters]);

  const stats = nearbySchoolStats(clusters, filteredClusters, school.id);
  const allLevelsOn = VISIT_FILTER_LEVELS.every((key) => filter[key]);

  const activeClusters = filteredClusters.filter((cluster) => included[cluster.id]);
  const days = activeClusters.flatMap((cluster) => cluster.plan);
  const schoolIds = new Set(
    days.flat().map((slot) => slot.schoolId).filter((id): id is string => Boolean(id)),
  );

  const selectedOrdered = useMemo(() => {
    const order: string[] = [];
    for (const cluster of filteredClusters) {
      for (const stop of cluster.stops) {
        if (selectedIds.includes(stop.schoolId) && !order.includes(stop.schoolId)) {
          order.push(stop.schoolId);
        }
      }
    }
    return order;
  }, [filteredClusters, selectedIds]);

  const routeParts = useMemo(() => {
    const locations = selectedOrdered
      .map((id) => byId.get(id))
      .filter((row): row is School => Boolean(row))
      .map(schoolMapLocation);
    return buildMapRouteParts(locations, startFrom.trim() || null);
  }, [selectedOrdered, byId, startFrom]);

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

  function toggleCluster(id: string) {
    setIncluded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id],
    );
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
    const origin = dayIndex === 0 ? startFrom.trim() || null : null;
    return buildMapRouteParts(locations, origin);
  }

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
          Showing {stats.showing} of {stats.total} nearby schools
          {!allLevelsOn ? (
            <>
              {" "}
              <button type="button" className="visit-show-all" onClick={showAllLevels}>
                Show all
              </button>
            </>
          ) : null}
        </span>
      </div>

      {!filterOn ? (
        <p className="visit-empty">Select at least one interest level.</p>
      ) : (
        <>
          <div className="visit-clusters" aria-label="Trip clusters">
            {filteredClusters.map((cluster) => (
              <ClusterBlock
                key={cluster.id}
                cluster={cluster}
                baseId={school.id}
                byId={byId}
                pressed={Boolean(included[cluster.id])}
                selectedIds={selectedIds}
                onToggleInclude={() => toggleCluster(cluster.id)}
                onToggleSelect={toggleSelected}
              />
            ))}
          </div>

          {selectedOrdered.length > 0 ? (
            <div className="visit-route-bar">
              <div className="visit-route-meta">
                <strong>
                  {selectedOrdered.length} school
                  {selectedOrdered.length === 1 ? "" : "s"} selected
                </strong>
                <span className="visit-route-path">
                  {selectedOrdered
                    .map((id) => shortSchoolName(byId.get(id)?.name ?? id))
                    .join(" → ")}
                </span>
              </div>
              <label className="visit-start-from">
                <span>Start from</span>
                <input
                  type="text"
                  value={startFrom}
                  placeholder="Current location"
                  onChange={(event) => setStartFrom(event.target.value)}
                />
              </label>
              <div className="visit-route-actions">
                {routeParts.length === 1 ? (
                  <>
                    <a
                      className="btn btn-secondary visit-map-btn"
                      href={routeParts[0]!.googleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapTrifold size={18} weight="duotone" aria-hidden="true" />
                      Open in Google Maps
                    </a>
                    <a
                      className="btn btn-secondary visit-map-btn"
                      href={routeParts[0]!.appleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapTrifold size={18} weight="duotone" aria-hidden="true" />
                      Open in Apple Maps
                    </a>
                  </>
                ) : (
                  routeParts.map((part) => (
                    <span key={part.label} className="visit-map-part-btns">
                      <span className="school-visit-label school-visit-label-sm">{part.label}</span>
                      <a
                        className="btn btn-secondary visit-map-btn"
                        href={part.googleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MapTrifold size={18} weight="duotone" aria-hidden="true" />
                        Google Maps
                      </a>
                      <a
                        className="btn btn-secondary visit-map-btn"
                        href={part.appleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MapTrifold size={18} weight="duotone" aria-hidden="true" />
                        Apple Maps
                      </a>
                    </span>
                  ))
                )}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setSelectedIds([])}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}

          <section className="visit-itinerary" aria-labelledby="visit-trip-title">
            <div className="visit-it-head">
              <div>
                <h2 id="visit-trip-title">{trip.name}</h2>
                <p>
                  {trip.window} · {schoolIds.size} school{schoolIds.size === 1 ? "" : "s"} ·{" "}
                  {days.length} day{days.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                className="visit-send"
                disabled={!days.length}
                onClick={send}
              >
                <CalendarPlus size={18} weight="duotone" aria-hidden="true" />
                Send to Calendar
              </button>
            </div>

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
                            }`}
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
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <p className="visit-empty">Add a cluster above to start a trip.</p>
            )}
            <p className="visit-foot">
              Tour and info session times are placeholders until booked. Drive times need a maps
              source — legs show place only for now.
            </p>
          </section>
        </>
      )}

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
  pressed,
  selectedIds,
  onToggleInclude,
  onToggleSelect,
}: {
  cluster: VisitCluster;
  baseId: string;
  byId: Map<string, School>;
  pressed: boolean;
  selectedIds: string[];
  onToggleInclude: () => void;
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
              aria-pressed={pressed}
              onClick={onToggleInclude}
            >
              {pressed ? "In trip ✓" : "Add to trip"}
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
              return (
                <span key={stop.schoolId} className="visit-chain-piece">
                  {stop.driveFromPrev ? (
                    <span className="visit-leg">{stop.driveFromPrev}</span>
                  ) : null}
                  <StopChip
                    school={row}
                    here={stop.schoolId === baseId}
                    selected={selectedIds.includes(stop.schoolId)}
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
