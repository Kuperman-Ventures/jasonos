"use client";

import { SchoolMark } from "../SchoolMark";
import {
  tripInterestLabel,
  type TripCluster,
  type TripSchoolPoint,
} from "@/lib/trip-planning";

export function TripNearbyList({
  schoolId,
  clusters,
  pointsById,
  clusterIds,
  activeClusterId,
  flight,
  areaLabel,
  onActiveCluster,
  onToggleCluster,
}: {
  schoolId: string;
  clusters: TripCluster[];
  pointsById: Map<string, TripSchoolPoint>;
  clusterIds: string[];
  activeClusterId: string;
  flight: string;
  areaLabel: string;
  onActiveCluster: (id: string) => void;
  onToggleCluster: (id: string) => void;
}) {
  const inTrip = new Set(clusterIds);

  return (
    <div className="trip-clist">
      {clusters.map((cluster) => {
        const daysLabel =
          cluster.id === "same"
            ? "1 day"
            : `+${cluster.days} ${cluster.days === 1 ? "day" : "days"}`;
        return (
          <div
            key={cluster.id}
            className={`trip-cl${cluster.id === activeClusterId ? " on" : ""}`}
            data-cl={cluster.id}
            tabIndex={0}
            role="button"
            onMouseEnter={() => onActiveCluster(cluster.id)}
            onClick={() => onActiveCluster(cluster.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onActiveCluster(cluster.id);
              }
            }}
          >
            <div className="trip-cl-top">
              <b>{cluster.name}</b>
              <span className="trip-cl-days">{daysLabel}</span>
            </div>
            <span className="trip-cl-sub">
              {cluster.sub}
              {cluster.note ? `. ${cluster.note}` : ""}
            </span>
            <div className="trip-cl-bot">
              <div className="trip-cl-marks">
                {cluster.stops.map((stop) => {
                  const point = pointsById.get(stop.schoolId);
                  const level = point?.interest ?? "none";
                  return (
                    <span
                      key={stop.schoolId}
                      className={`trip-mk trip-mk-sm${level === "none" ? " none" : ""}`}
                      data-level={level}
                      title={`${point?.name ?? stop.schoolId} · ${tripInterestLabel(
                        level === "none" ? "" : level,
                      )}`}
                      style={
                        stop.schoolId === schoolId
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
                  );
                })}
              </div>
              <button
                type="button"
                className="trip-inc"
                aria-pressed={inTrip.has(cluster.id)}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleCluster(cluster.id);
                }}
              >
                {inTrip.has(cluster.id) ? "In trip ✓" : "Add to trip"}
              </button>
            </div>
          </div>
        );
      })}
      <div className="trip-fly">
        <span className="trip-label trip-label-sm">Getting there</span>
        Fly {flight}. Base near {areaLabel}; every cluster starts within a drive of it.
      </div>
    </div>
  );
}
