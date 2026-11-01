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
  activeSchoolId,
  maxMinutes,
  onMaxMinutes,
  handoffIds,
  onToggleHandoff,
  onOpenVisitPlanning,
  airports,
  areaLabel,
  onActiveSchool,
}: {
  schoolId: string;
  schoolName: string;
  rows: NearbySchoolRow[];
  pointsById: Map<string, TripSchoolPoint>;
  activeSchoolId: string;
  maxMinutes: number;
  onMaxMinutes: (minutes: number) => void;
  handoffIds: string[];
  onToggleHandoff: (id: string) => void;
  onOpenVisitPlanning: () => void;
  airports: NearbyAirportRow[];
  areaLabel: string;
  onActiveSchool: (id: string) => void;
}) {
  const handoff = new Set(handoffIds);
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
  const handoffCount = handoffIds.length;

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
          active={base.schoolId === activeSchoolId}
          included={handoff.has(base.schoolId)}
          includeLocked
          onActiveSchool={onActiveSchool}
          onToggleHandoff={onToggleHandoff}
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
                active={row.schoolId === activeSchoolId}
                included={handoff.has(row.schoolId)}
                onActiveSchool={onActiveSchool}
                onToggleHandoff={onToggleHandoff}
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

      <div className="trip-near-handoff">
        <button
          type="button"
          className="trip-btn-primary"
          onClick={onOpenVisitPlanning}
        >
          Open in Visit Planning
          {handoffCount > 1 ? ` · ${handoffCount}` : ""}
        </button>
        <span>
          Pins {hubName}
          {handoffCount > 1 ? ` and ${handoffCount - 1} nearby` : ""} for the family trip
          map. Day scripts stay on Itinerary.
        </span>
      </div>

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
  active,
  included,
  includeLocked,
  onActiveSchool,
  onToggleHandoff,
}: {
  row: NearbySchoolRow;
  point: TripSchoolPoint | undefined;
  schoolId: string;
  active: boolean;
  included: boolean;
  includeLocked?: boolean;
  onActiveSchool: (id: string) => void;
  onToggleHandoff: (id: string) => void;
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
        <label
          className={`trip-near-include${includeLocked ? " locked" : ""}`}
          onClick={(event) => event.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={included}
            disabled={includeLocked}
            onChange={() => onToggleHandoff(row.schoolId)}
          />
          <span>{includeLocked ? "Always included" : "Include"}</span>
        </label>
      </div>
    </div>
  );
}
