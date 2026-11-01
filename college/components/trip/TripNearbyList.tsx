"use client";

import { useMemo } from "react";
import { SchoolMark } from "../SchoolMark";
import {
  NEARBY_BAND_DEFS,
  NEARBY_DRIVE_MAX_MINUTES,
  filterNearbyByMaxMinutes,
  groupNearbyByBand,
  tripInterestLabel,
  type NearbyAirportRow,
  type NearbySchoolRow,
  type TripSchoolPoint,
} from "@/lib/trip-planning";
import { shortSchoolName } from "@/lib/visit-planning";

export function TripNearbyList({
  schoolId,
  schoolName,
  rows,
  pointsById,
  schoolIds,
  activeSchoolId,
  maxMinutes,
  onMaxMinutes,
  airports,
  areaLabel,
  onActiveSchool,
  onToggleSchool,
}: {
  schoolId: string;
  schoolName: string;
  rows: NearbySchoolRow[];
  pointsById: Map<string, TripSchoolPoint>;
  schoolIds: string[];
  activeSchoolId: string;
  maxMinutes: number;
  onMaxMinutes: (minutes: number) => void;
  airports: NearbyAirportRow[];
  areaLabel: string;
  onActiveSchool: (id: string) => void;
  onToggleSchool: (id: string) => void;
}) {
  const inTrip = new Set(schoolIds);
  const hubName = shortSchoolName(schoolName);
  const visible = useMemo(
    () => filterNearbyByMaxMinutes(rows, maxMinutes),
    [rows, maxMinutes],
  );
  const base = visible.find((row) => row.isBase) ?? null;
  const sections = useMemo(() => groupNearbyByBand(visible), [visible]);
  const listPeers = visible.filter((row) => !row.isBase && !row.offList);
  const offList = visible.filter((row) => row.offList);
  const peerCount = listPeers.length;
  const radiusLabel =
    maxMinutes >= NEARBY_DRIVE_MAX_MINUTES
      ? "3 hours"
      : maxMinutes >= 120
        ? "2 hours"
        : "1 hour";

  return (
    <div className="trip-clist">
      <div className="trip-near-head">
        <b>From {hubName}</b>
        <span>
          {peerCount
            ? `${peerCount} other list school${peerCount === 1 ? "" : "s"} near ${
                areaLabel || "this campus"
              }. Distances are drive time from here.`
            : `No other list schools within ${radiusLabel} of ${
                areaLabel || "this campus"
              } yet.`}
        </span>
      </div>

      <div className="trip-near-rings" role="group" aria-label="Drive-time radius">
        {NEARBY_BAND_DEFS.map((band) => {
          const pressed = maxMinutes === band.maxMinutes;
          return (
            <button
              key={band.id}
              type="button"
              className={`trip-near-ring${pressed ? " on" : ""}`}
              aria-pressed={pressed}
              onClick={() => onMaxMinutes(band.maxMinutes)}
            >
              {band.label}
            </button>
          );
        })}
      </div>

      {base ? (
        <NearbyRow
          row={base}
          point={pointsById.get(base.schoolId)}
          schoolId={schoolId}
          selected={inTrip.has(base.schoolId)}
          active={base.schoolId === activeSchoolId}
          onActiveSchool={onActiveSchool}
          onToggleSchool={onToggleSchool}
        />
      ) : null}

      {sections.map((section) => {
        const listRows = section.rows.filter((row) => !row.offList);
        if (!listRows.length) return null;
        return (
          <div key={section.id} className="trip-near-section">
            <div className="trip-near-section-head">
              <span>{section.label}</span>
              <span>{listRows.length}</span>
            </div>
            {listRows.map((row) => (
              <NearbyRow
                key={row.schoolId}
                row={row}
                point={pointsById.get(row.schoolId)}
                schoolId={schoolId}
                selected={inTrip.has(row.schoolId)}
                active={row.schoolId === activeSchoolId}
                onActiveSchool={onActiveSchool}
                onToggleSchool={onToggleSchool}
              />
            ))}
          </div>
        );
      })}

      {offList.length ? (
        <div className="trip-near-section trip-near-offlist">
          <div className="trip-near-section-head">
            <span>Also in this pocket</span>
            <span>{offList.length}</span>
          </div>
          <p className="trip-near-offlist-note">
            Nearby in our drive data, not on your list yet.
          </p>
          {offList.map((row) => (
            <div key={row.schoolId} className="trip-cl trip-cl-off">
              <div className="trip-cl-top">
                <b>{row.name}</b>
                <span className="trip-cl-days">{row.driveLabel}</span>
              </div>
              <span className="trip-cl-sub">
                {row.miles != null ? `${Math.round(row.miles)} mi · ` : ""}
                Not on list
              </span>
              {row.sameDayHint ? (
                <span className="trip-cl-pair">{row.sameDayHint}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {airports.length ? (
        <div className="trip-near-airports">
          <span className="trip-label trip-label-sm">Airports near campus</span>
          {airports.map((airport) => (
            <div key={airport.iata} className="trip-near-airport">
              <b>
                {airport.iata} · {airport.city}
              </b>
              <span>
                ~{airport.miles} mi · {airport.name}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NearbyRow({
  row,
  point,
  schoolId,
  selected,
  active,
  onActiveSchool,
  onToggleSchool,
}: {
  row: NearbySchoolRow;
  point: TripSchoolPoint | undefined;
  schoolId: string;
  selected: boolean;
  active: boolean;
  onActiveSchool: (id: string) => void;
  onToggleSchool: (id: string) => void;
}) {
  const level = point?.interest ?? "none";
  return (
    <div
      className={`trip-cl${active ? " on" : ""}${row.isBase ? " trip-cl-hub" : ""}`}
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
          ? "You’re here — campus hub for this view"
          : `${row.miles != null ? `${Math.round(row.miles)} mi · ` : ""}${tripInterestLabel(
              level === "none" ? "" : level,
            )}`}
      </span>
      {row.sameDayHint ? <span className="trip-cl-pair">{row.sameDayHint}</span> : null}
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
          className="trip-inc trip-inc-quiet"
          aria-pressed={selected}
          onClick={(event) => {
            event.stopPropagation();
            onToggleSchool(row.schoolId);
          }}
        >
          {selected ? "In loop ✓" : "Add to loop"}
        </button>
      </div>
    </div>
  );
}
