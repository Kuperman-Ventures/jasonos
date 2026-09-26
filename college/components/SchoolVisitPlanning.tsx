"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Car, ForkKnife } from "@phosphor-icons/react";
import type { CalendarEvent } from "@/lib/calendar-events";
import { INBOX_PARENT_ID, type PersistedProjectStep } from "@/lib/ingest";
import { memberOwnerId } from "@/lib/project-todos";
import type { ListPhaseId } from "@/lib/list-phases";
import type { School } from "@/lib/types";
import {
  buildVisitClusters,
  buildVisitTripMeta,
  schoolMapById,
  visitInterestKey,
  visitInterestLabel,
  type VisitCluster,
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
}: {
  school: School;
  here: boolean;
}) {
  const level = visitInterestKey(school.interestLevel);
  return (
    <span
      className={`visit-stop${here ? " here" : ""}`}
      data-level={level}
      title={`${school.name} · ${visitInterestLabel(school.interestLevel)}`}
    >
      <SchoolMark name={school.name} website={school.website} />
      <span>{school.name.replace(/\s*\([^)]*\)\s*/g, "").trim() || school.name}</span>
    </span>
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
  /** Live list schools used to build clusters (includes the current school). */
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

  const [included, setIncluded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    clusters.forEach((cluster, index) => {
      initial[cluster.id] = index < 2;
    });
    return initial;
  });
  const [toast, setToast] = useState<string | null>(null);

  const activeClusters = clusters.filter((cluster) => included[cluster.id]);
  const days = activeClusters.flatMap((cluster) => cluster.plan);
  const schoolIds = new Set(
    days.flat().map((slot) => slot.schoolId).filter((id): id is string => Boolean(id)),
  );

  function toggleCluster(id: string) {
    setIncluded((prev) => ({ ...prev, [id]: !prev[id] }));
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

      <div className="visit-clusters" aria-label="Trip clusters">
        {clusters.map((cluster) => (
          <ClusterBlock
            key={cluster.id}
            cluster={cluster}
            baseId={school.id}
            byId={byId}
            pressed={Boolean(included[cluster.id])}
            onToggle={() => toggleCluster(cluster.id)}
          />
        ))}
      </div>

      <div className="visit-legend">
        <span className="school-visit-label school-visit-label-sm">Kyle&apos;s interest</span>
        {LEGEND.map((item) => (
          <span key={item.key}>
            <span
              className="visit-legend-sw"
              data-level={item.key}
              aria-hidden="true"
            />
            {item.label}
          </span>
        ))}
        <span className="visit-legend-here">
          <span className="visit-legend-sw visit-legend-sw-here" aria-hidden="true" />
          This school
        </span>
      </div>

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
  onToggle,
}: {
  cluster: VisitCluster;
  baseId: string;
  byId: Map<string, School>;
  pressed: boolean;
  onToggle: () => void;
}) {
  const daysLabel =
    cluster.id === "same"
      ? "1 day"
      : `+${cluster.days} day${cluster.days === 1 ? "" : "s"}`;

  return (
    <div className="visit-cluster">
      <div className="visit-c-head">
        <div>
          <h3>{cluster.name}</h3>
          <p>{cluster.sub}</p>
        </div>
        <div className="visit-c-side">
          <span className="visit-c-days">{daysLabel}</span>
          <button
            type="button"
            className="visit-include"
            aria-pressed={pressed}
            onClick={onToggle}
          >
            {pressed ? "In trip ✓" : "Add to trip"}
          </button>
        </div>
      </div>
      <div className="visit-chain">
        {cluster.stops.map((stop) => {
          const row = byId.get(stop.schoolId);
          if (!row) return null;
          return (
            <span key={stop.schoolId} className="visit-chain-piece">
              {stop.driveFromPrev ? (
                <span className="visit-leg">{stop.driveFromPrev}</span>
              ) : null}
              <StopChip school={row} here={stop.schoolId === baseId} />
            </span>
          );
        })}
      </div>
      <span className="visit-c-note">{cluster.note}</span>
    </div>
  );
}
