"use client";

import { SchoolMark } from "../SchoolMark";
import {
  tripInterestLabel,
  type NearbySchoolRow,
  type TripSchoolPoint,
} from "@/lib/trip-planning";

export function TripNearbyList({
  schoolId,
  rows,
  pointsById,
  schoolIds,
  activeSchoolId,
  flight,
  areaLabel,
  onActiveSchool,
  onToggleSchool,
}: {
  schoolId: string;
  rows: NearbySchoolRow[];
  pointsById: Map<string, TripSchoolPoint>;
  schoolIds: string[];
  activeSchoolId: string;
  flight: string;
  areaLabel: string;
  onActiveSchool: (id: string) => void;
  onToggleSchool: (id: string) => void;
}) {
  const inTrip = new Set(schoolIds);
  const peerCount = rows.filter((row) => !row.isBase).length;

  return (
    <div className="trip-clist">
      <div className="trip-near-head">
        <b>Within a 3-hour drive</b>
        <span>
          {peerCount
            ? `${peerCount} other list school${peerCount === 1 ? "" : "s"} near ${areaLabel || "this campus"}. Tap to build a route.`
            : `No other list schools within 3 hours of ${areaLabel || "this campus"} yet.`}
        </span>
      </div>
      {rows.map((row) => {
        const point = pointsById.get(row.schoolId);
        const level = point?.interest ?? "none";
        const selected = inTrip.has(row.schoolId);
        return (
          <div
            key={row.schoolId}
            className={`trip-cl${row.schoolId === activeSchoolId ? " on" : ""}`}
            data-school={row.schoolId}
            tabIndex={0}
            role="button"
            onMouseEnter={() => onActiveSchool(row.schoolId)}
            onClick={() => onActiveSchool(row.schoolId)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onActiveSchool(row.schoolId);
              }
            }}
          >
            <div className="trip-cl-top">
              <b>{row.name}</b>
              <span className="trip-cl-days">{row.driveLabel}</span>
            </div>
            <span className="trip-cl-sub">
              {row.isBase
                ? "School you’re viewing — starts in the trip"
                : `${row.miles != null ? `${Math.round(row.miles)} mi · ` : ""}${tripInterestLabel(
                    level === "none" ? "" : level,
                  )}`}
            </span>
            <div className="trip-cl-bot">
              <div className="trip-cl-marks">
                <span
                  className={`trip-mk trip-mk-sm${level === "none" ? " none" : ""}`}
                  data-level={level}
                  style={
                    row.schoolId === schoolId
                      ? {
                          boxShadow:
                            "0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-text)",
                        }
                      : undefined
                  }
                >
                  {point ? (
                    <SchoolMark name={point.name} website={point.website} />
                  ) : (
                    "?"
                  )}
                </span>
              </div>
              <button
                type="button"
                className="trip-inc"
                aria-pressed={selected}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleSchool(row.schoolId);
                }}
              >
                {selected ? "In trip ✓" : "Add to trip"}
              </button>
            </div>
          </div>
        );
      })}
      <div className="trip-fly">
        <span className="trip-label trip-label-sm">Getting there</span>
        Fly {flight}. Drive times are from the saved school-to-school matrix.
      </div>
    </div>
  );
}
