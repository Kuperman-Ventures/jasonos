"use client";

import type { School } from "@/lib/types";
import {
  KYLE_STUDENT,
  TRIP_WEEK_LABELS,
  TRIP_WEEK_WEATHER,
  campusWeekState,
  formatWeekDate,
  isBestFitWeek,
  kyleBreakCellLabel,
  weekDate,
  type CampusWeekState,
} from "@/lib/trip-planning";
import { shortSchoolName } from "@/lib/visit-planning";
import { SchoolMark } from "../SchoolMark";

const WHY: Record<"break" | "finals", string> = {
  break: "on spring break. Campus will be quiet, and many offices run limited tours.",
  finals: "in finals. Tours often pause and students won't have time to talk.",
};

export function TripWhenPanel({
  weekIndex,
  tripSchoolIds,
  byId,
  calendars,
  tripDayCount,
  weatherLabel,
  onWeekIndex,
}: {
  weekIndex: number;
  tripSchoolIds: string[];
  byId: Map<string, School>;
  calendars: Map<string, Record<number, CampusWeekState>>;
  tripDayCount: number;
  weatherLabel: string;
  onWeekIndex: (index: number) => void;
}) {
  const best = TRIP_WEEK_LABELS.map((_, i) =>
    isBestFitWeek(
      i,
      KYLE_STUDENT.breaks,
      tripSchoolIds.map((id) =>
        campusWeekState(calendars.get(id) ?? {}, i),
      ),
    ),
  );
  const wx = TRIP_WEEK_WEATHER[weekIndex] ?? ["—", ""];
  const end = weekDate(weekIndex, Math.max(tripDayCount, 1) - 1);
  const warns = tripSchoolIds.filter(
    (id) => campusWeekState(calendars.get(id) ?? {}, weekIndex) !== "session",
  );
  const kyleOff = KYLE_STUDENT.breaks.includes(weekIndex);
  const bestIndex = best.indexOf(true);

  return (
    <div className="trip-panel" role="tabpanel">
      <div className="trip-head-row">
        <div>
          <h2>When to go</h2>
          <p>
            Week of {TRIP_WEEK_LABELS[weekIndex]} · {tripSchoolIds.length} schools
          </p>
        </div>
        <div className="trip-wx">
          <span className="trip-label trip-label-sm">
            {weatherLabel}, {formatWeekDate(weekDate(weekIndex))}–
            {formatWeekDate(end)}
          </span>
          <b>{wx[0]}</b>
          <span>{wx[1] === "dry" ? "rain unlikely" : wx[1]}</span>
        </div>
      </div>

      {!tripSchoolIds.length ? (
        <p className="trip-empty">Add a cluster in Nearby to see its calendars.</p>
      ) : (
        <>
          <div className="trip-wk">
            <span />
            {TRIP_WEEK_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                className={`trip-ch${i === weekIndex ? " sel" : ""}${best[i] ? " best" : ""}`}
                data-wk={i}
                aria-pressed={i === weekIndex}
                onClick={() => onWeekIndex(i)}
              >
                <b>{label}</b>
                <span>{best[i] ? "best fit" : "week"}</span>
              </button>
            ))}

            <div className="trip-rh">
              {KYLE_STUDENT.name} <small>{KYLE_STUDENT.school}</small>
            </div>
            {TRIP_WEEK_LABELS.map((_, i) => {
              const off = KYLE_STUDENT.breaks.includes(i);
              return (
                <button
                  key={`kyle-${i}`}
                  type="button"
                  className={`trip-cell ${off ? "kbreak" : "kschool"}${
                    i === weekIndex ? " col-sel" : ""
                  }`}
                  title={off ? kyleBreakCellLabel(i) : undefined}
                  onClick={() => onWeekIndex(i)}
                >
                  {off ? kyleBreakCellLabel(i) : "School"}
                </button>
              );
            })}

            {tripSchoolIds.flatMap((id) => {
              const row = byId.get(id);
              const cal = calendars.get(id) ?? {};
              return [
                <div key={`rh-${id}`} className="trip-rh">
                  {row ? (
                    <span className="trip-mk trip-mk-sm">
                      <SchoolMark name={row.name} website={row.website} />
                    </span>
                  ) : null}
                  {row ? shortSchoolName(row.name) : id}
                </div>,
                ...TRIP_WEEK_LABELS.map((_, i) => {
                  const st = campusWeekState(cal, i);
                  const label =
                    st === "session" ? "Classes" : st === "break" ? "Break" : "Finals";
                  return (
                    <button
                      key={`${id}-${i}`}
                      type="button"
                      className={`trip-cell ${st}${i === weekIndex ? " col-sel" : ""}`}
                      onClick={() => onWeekIndex(i)}
                    >
                      {label}
                    </button>
                  );
                }),
              ];
            })}

            <div className="trip-rh">
              <small>{weatherLabel} weather</small>
            </div>
            {TRIP_WEEK_WEATHER.map(([temp, rain], i) => (
              <div key={`wx-${i}`} className="trip-cell wxc">
                {temp}
                <br />
                {rain}
              </div>
            ))}
          </div>

          <div className="trip-verdict">
            <div>
              <h3>
                {warns.length
                  ? `${warns.length} ${
                      warns.length === 1 ? "school needs" : "schools need"
                    } a different week`
                  : "Every campus is in session"}
              </h3>
              <ul className="trip-vlist">
                {(warns.length ? warns : tripSchoolIds).map((id) => {
                  const row = byId.get(id);
                  const st = campusWeekState(calendars.get(id) ?? {}, weekIndex);
                  const ok = st === "session";
                  return (
                    <li key={id}>
                      <span className={`trip-st ${ok ? "ok" : "warn"}`}>
                        {ok ? "✓" : "!"}
                      </span>
                      <span>
                        <b>{row ? shortSchoolName(row.name) : id}</b>
                        {ok
                          ? " in session"
                          : ` is ${WHY[st as "break" | "finals"]}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <h3>{KYLE_STUDENT.name}</h3>
              <ul className="trip-vlist">
                <li>
                  <span className={`trip-st ${kyleOff ? "ok" : "warn"}`}>
                    {kyleOff ? "✓" : "!"}
                  </span>
                  <span>
                    {kyleOff
                      ? "On break. No school days missed."
                      : `School week. The trip would miss ${Math.min(
                          tripDayCount,
                          5,
                        )} days of class.`}
                  </span>
                </li>
                {!best[weekIndex] && bestIndex >= 0 ? (
                  <li>
                    <span className="trip-st ok">→</span>
                    <span>
                      Best fit:{" "}
                      <button
                        type="button"
                        className="trip-link"
                        onClick={() => onWeekIndex(bestIndex)}
                      >
                        week of {TRIP_WEEK_LABELS[bestIndex]}
                      </button>
                    </span>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </>
      )}
      <p className="trip-foot">Click any week to move the trip. The itinerary follows.</p>
    </div>
  );
}
