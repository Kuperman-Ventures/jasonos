"use client";

import type { School } from "@/lib/types";
import type { VisitSlot } from "@/lib/visit-planning";
import { shortSchoolName } from "@/lib/visit-planning";
import {
  campusWeekState,
  formatWeekDate,
  weekDate,
  type CampusWeekInfo,
  type NearbySchoolRow,
  type TripWeekGrid,
} from "@/lib/trip-planning";
import { SchoolMark } from "../SchoolMark";

export function TripItineraryPanel({
  title,
  weekIndex,
  weekLabel,
  schoolId,
  tripSchoolIds,
  tripDays,
  nearbyPeers,
  byId,
  calendars,
  weekGrid,
  onGoWhen,
  onToggleSchool,
  onSend,
}: {
  title: string;
  weekIndex: number;
  weekLabel: string;
  schoolId: string;
  tripSchoolIds: string[];
  tripDays: VisitSlot[][];
  /** List peers within the 3-hour ring (for day-script membership). */
  nearbyPeers: NearbySchoolRow[];
  byId: Map<string, School>;
  calendars: Map<string, Record<number, CampusWeekInfo>>;
  weekGrid: TripWeekGrid;
  onGoWhen: () => void;
  onToggleSchool: (id: string) => void;
  onSend: () => void;
}) {
  const inTrip = new Set(tripSchoolIds);
  const bad = tripSchoolIds.filter(
    (id) => campusWeekState(calendars.get(id) ?? {}, weekIndex) !== "session",
  );
  const peerChoices = nearbyPeers.filter((row) => !row.isBase && !row.offList);

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

      <div className="trip-itin-schools">
        <span className="trip-label trip-label-sm">Schools on this day script</span>
        <div className="trip-itin-chips">
          <span className="trip-itin-chip on locked">
            {shortSchoolName(byId.get(schoolId)?.name ?? "This school")}
          </span>
          {peerChoices.map((peer) => {
            const selected = inTrip.has(peer.schoolId);
            return (
              <button
                key={peer.schoolId}
                type="button"
                className={`trip-itin-chip${selected ? " on" : ""}`}
                aria-pressed={selected}
                onClick={() => onToggleSchool(peer.schoolId)}
              >
                {shortSchoolName(peer.name)}
                <small>{peer.driveLabel}</small>
              </button>
            );
          })}
        </div>
        {!peerChoices.length ? (
          <p className="trip-itin-empty">
            No other list schools within 3 hours — this script is just the campus you’re
            viewing.
          </p>
        ) : (
          <p className="trip-itin-empty">
            Toggle nearby list schools to build the day script. For a multi-day family
            route map, use Visit Planning.
          </p>
        )}
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
                {formatWeekDate(weekDate(weekIndex, i, weekGrid), {
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
        <p className="trip-empty">Add a nearby school above to expand the day script.</p>
      )}
      <p className="trip-foot">Tour and info session times are placeholders until booked.</p>
    </div>
  );
}
