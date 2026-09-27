"use client";

import {
  calendarSystemLabel,
  campusCalendarForSchoolName,
  springBreakRangeLabel,
} from "@/lib/trip-planning";

export function TripCampusCalendarSection({ schoolName }: { schoolName: string }) {
  const record = campusCalendarForSchoolName(schoolName);
  if (!record) return null;

  const spring = springBreakRangeLabel(record);
  const sourceNote =
    record.status === "tentative"
      ? " (dates marked tentative by the school)"
      : "";

  return (
    <section className="trip-campus-cal" aria-labelledby="trip-campus-cal-h">
      <h2 id="trip-campus-cal-h">Calendar</h2>
      <ul className="trip-campus-cal-list">
        <li>Calendar system: {calendarSystemLabel(record.calendarSystem)}</li>
        {spring ? <li>Spring break 2027: {spring}</li> : null}
      </ul>
      <p className="trip-campus-cal-source">
        <a href={record.sourceUrl} target="_blank" rel="noreferrer">
          Official 2026-27 academic calendar
        </a>
        {sourceNote}
      </p>
      {record.notes ? <p className="trip-campus-cal-notes">{record.notes}</p> : null}
    </section>
  );
}
