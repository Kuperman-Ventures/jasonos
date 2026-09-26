"use client";

import type { School } from "@/lib/types";
import type { VisitSlot } from "@/lib/visit-planning";
import { shortSchoolName } from "@/lib/visit-planning";
import {
  campusWeekState,
  formatWeekDate,
  weekDate,
  type CampusWeekState,
} from "@/lib/trip-planning";
import { SchoolMark } from "../SchoolMark";

export function TripItineraryPanel({
  title,
  weekIndex,
  weekLabel,
  schoolId,
  tripSchoolIds,
  tripDays,
  byId,
  calendars,
  onGoWhen,
  onSend,
}: {
  title: string;
  weekIndex: number;
  weekLabel: string;
  schoolId: string;
  tripSchoolIds: string[];
  tripDays: VisitSlot[][];
  byId: Map<string, School>;
  calendars: Map<string, Record<number, CampusWeekState>>;
  onGoWhen: () => void;
  onSend: () => void;
}) {
  const bad = tripSchoolIds.filter(
    (id) => campusWeekState(calendars.get(id) ?? {}, weekIndex) !== "session",
  );

  return (
    <div className="trip-panel" role="tabpanel">
      <div className="trip-head-row">
        <div>
          <h2>{title}</h2>
          <p>
            Week of {weekLabel} · {tripSchoolIds.length} schools · {tripDays.length}{" "}
            {tripDays.length === 1 ? "day" : "days"}
          </p>
        </div>
        <button
          type="button"
          className="trip-btn-primary"
          disabled={!tripDays.length}
          onClick={onSend}
        >
          Send to Calendar
        </button>
      </div>

      {bad.length ? (
        <div className="trip-banner">
          <span>
            {bad
              .map((id) => {
                const row = byId.get(id);
                return row ? shortSchoolName(row.name) : id;
              })
              .join(", ")}{" "}
            {bad.length === 1 ? "is" : "are"} on break or in finals that week.
          </span>
          <button type="button" onClick={onGoWhen}>
            See When to go →
          </button>
        </div>
      ) : null}

      {tripDays.length ? (
        <div className="trip-days">
          {tripDays.map((items, i) => (
            <div key={i} className="trip-day">
              <span className="trip-label trip-label-sm">
                Day {i + 1} ·{" "}
                {formatWeekDate(weekDate(weekIndex, i), {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              {items.map((slot, j) => {
                const stop = slot.schoolId ? byId.get(slot.schoolId) : null;
                const kind =
                  slot.icon === "car" ? "DRIVE" : slot.icon === "meal" ? "MEAL" : null;
                return (
                  <div key={j} className="trip-slot">
                    <time>{slot.time}</time>
                    <div
                      className={`trip-box${
                        slot.schoolId === schoolId
                          ? " here"
                          : slot.schoolId
                            ? ""
                            : " gap"
                      }`}
                    >
                      {stop ? (
                        <span className="trip-mk">
                          <SchoolMark name={stop.name} website={stop.website} />
                        </span>
                      ) : kind ? (
                        <span className="trip-kind">{kind}</span>
                      ) : null}
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
        <p className="trip-empty">Add a cluster in Nearby to start a trip.</p>
      )}
      <p className="trip-foot">Tour and info session times are placeholders until booked.</p>
    </div>
  );
}
