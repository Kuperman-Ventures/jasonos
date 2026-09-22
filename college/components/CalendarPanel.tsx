"use client";

import { shortEventDate, type CalendarEvent } from "@/lib/calendar-events";
import { ownerLabel } from "@/lib/types";

export function CalendarPanel({
  events,
  dateline,
}: {
  events: CalendarEvent[];
  dateline: string;
}) {
  const sorted = [...events].sort((a, b) => {
    const aKey = a.date ?? a.createdAt;
    const bKey = b.date ?? b.createdAt;
    return aKey.localeCompare(bKey);
  });

  return (
    <div className="pm-panel calendar-panel">
      <header className="page-head" style={{ marginBottom: "var(--space-4)" }}>
        <div>
          <div className="dateline">{dateline}</div>
          <h3 className="dash-title">Calendar</h3>
        </div>
      </header>
      <p className="section-sub">
        Events land here from Ingest when you route a row (or an as-is upload) to Calendar. A full
        month grid comes later.
      </p>
      {!sorted.length ? (
        <p className="todo-empty">No calendar events yet. Add some from Ingest.</p>
      ) : (
        <ul className="calendar-event-list">
          {sorted.map((event) => (
            <li key={event.id} className="calendar-event">
              <div className="calendar-event-when">{shortEventDate(event.date)}</div>
              <div className="calendar-event-body">
                <strong>{event.title}</strong>
                <span>
                  Added by {ownerLabel(event.createdBy)}
                  {event.assetUrl ? " · has file" : ""}
                </span>
                {event.assetUrl?.match(/\.(png|jpe?g|webp|gif)(\?|$)/i) ||
                event.assetUrl?.startsWith("data:image") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="calendar-event-thumb" src={event.assetUrl} alt="" />
                ) : event.assetUrl ? (
                  <a href={event.assetUrl} target="_blank" rel="noreferrer">
                    Open file
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
