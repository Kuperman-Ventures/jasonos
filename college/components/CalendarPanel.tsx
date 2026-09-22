"use client";

import { useEffect, useMemo, useState } from "react";
import { shortEventDate, type CalendarEvent } from "@/lib/calendar-events";
import { ownerLabel } from "@/lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function monthStart(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toKey(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function monthLabel(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function cursorFromDate(iso: string | null | undefined): { year: number; monthIndex: number } | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return null;
  return { year: y, monthIndex: m - 1 };
}

function initialCursor(events: CalendarEvent[]): { year: number; monthIndex: number } {
  const dated = events
    .map((event) => event.date)
    .filter((date): date is string => Boolean(date))
    .sort();
  const fromEvent = cursorFromDate(dated[0]);
  if (fromEvent) return fromEvent;
  const now = new Date();
  return { year: now.getFullYear(), monthIndex: now.getMonth() };
}

export function CalendarPanel({
  events,
  dateline,
  focusDate,
}: {
  events: CalendarEvent[];
  dateline: string;
  /** When set (YYYY-MM-DD), open the month that contains this date. */
  focusDate?: string | null;
}) {
  const [cursor, setCursor] = useState(() => cursorFromDate(focusDate) ?? initialCursor(events));
  const [selectedKey, setSelectedKey] = useState<string | null>(focusDate ?? null);
  const [subscribeHttps, setSubscribeHttps] = useState<string | null>(null);
  const [subscribeWebcal, setSubscribeWebcal] = useState<string | null>(null);
  const [subscribeStatus, setSubscribeStatus] = useState("");
  const [subscribeBusy, setSubscribeBusy] = useState(false);

  useEffect(() => {
    const next = cursorFromDate(focusDate);
    if (!next) return;
    setCursor(next);
    setSelectedKey(focusDate ?? null);
  }, [focusDate]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/calendar/subscribe");
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { httpsUrl?: string; webcalUrl?: string };
        if (cancelled) return;
        if (body.httpsUrl) setSubscribeHttps(body.httpsUrl);
        if (body.webcalUrl) setSubscribeWebcal(body.webcalUrl);
      } catch {
        /* subscribe block stays hidden until links load */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { year, monthIndex } = cursor;
  const start = monthStart(year, monthIndex);
  const startWeekday = start.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      if (!event.date) continue;
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);

  const undated = events.filter((event) => !event.date);
  const monthEvents = events
    .filter((event) => event.date?.startsWith(`${year}-${pad2(monthIndex + 1)}`))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const selectedEvents = selectedKey ? byDay.get(selectedKey) ?? [] : [];

  const cells: Array<{ key: string; day: number | null; inMonth: boolean }> = [];
  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({ key: `pad-${i}`, day: null, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: toKey(year, monthIndex, day), day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `trail-${cells.length}`, day: null, inMonth: false });
  }

  function shiftMonth(delta: number) {
    const next = new Date(year, monthIndex + delta, 1);
    setCursor({ year: next.getFullYear(), monthIndex: next.getMonth() });
    setSelectedKey(null);
  }

  async function copySubscribeLink() {
    if (!subscribeHttps) return;
    setSubscribeBusy(true);
    setSubscribeStatus("");
    try {
      await navigator.clipboard.writeText(subscribeHttps);
      setSubscribeStatus("Copied the subscribe link. Paste it in Apple Calendar, Google Calendar, or Outlook.");
    } catch {
      setSubscribeStatus("Could not copy — select the link below and copy it yourself.");
    } finally {
      setSubscribeBusy(false);
    }
  }

  return (
    <div className="pm-panel calendar-panel">
      <header className="page-head" style={{ marginBottom: "var(--space-4)" }}>
        <div>
          <div className="dateline">{dateline}</div>
          <h3 className="dash-title">Calendar</h3>
        </div>
      </header>
      <p className="section-sub">
        Month view of events from Ingest and from Notes via Make a calendar event.
      </p>

      {subscribeHttps ? (
        <div className="cal-subscribe">
          <div>
            <h4 className="cal-detail-heading">Subscribe on your phone or computer</h4>
            <p className="section-sub" style={{ margin: 0 }}>
              Add this feed in Apple Calendar, Google Calendar, or Outlook so household events show
              up on your own calendar and stay updated.
            </p>
          </div>
          <div className="cal-subscribe-actions">
            <button
              type="button"
              className="btn btn-primary compact"
              onClick={() => void copySubscribeLink()}
              disabled={subscribeBusy}
            >
              Copy subscribe link
            </button>
            {subscribeWebcal ? (
              <a className="btn btn-secondary compact" href={subscribeWebcal}>
                Open in calendar app
              </a>
            ) : null}
          </div>
          <p className="cal-subscribe-url mono">{subscribeHttps}</p>
          {subscribeStatus ? <p className="cal-subscribe-status">{subscribeStatus}</p> : null}
        </div>
      ) : null}

      <div className="cal-toolbar">
        <button type="button" className="btn btn-secondary compact" onClick={() => shiftMonth(-1)}>
          Previous
        </button>
        <h4 className="cal-month-label mono">{monthLabel(year, monthIndex)}</h4>
        <button type="button" className="btn btn-secondary compact" onClick={() => shiftMonth(1)}>
          Next
        </button>
      </div>

      <div className="cal-grid" role="grid" aria-label={`Calendar for ${monthLabel(year, monthIndex)}`}>
        {WEEKDAYS.map((label) => (
          <div key={label} className="cal-weekday mono" role="columnheader">
            {label}
          </div>
        ))}
        {cells.map((cell) => {
          if (!cell.inMonth || cell.day === null) {
            return <div key={cell.key} className="cal-cell is-pad" aria-hidden="true" />;
          }
          const key = cell.key;
          const dayEvents = byDay.get(key) ?? [];
          const selected = selectedKey === key;
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              className={`cal-cell${dayEvents.length ? " has-events" : ""}${selected ? " is-selected" : ""}`}
              aria-label={`${shortEventDate(key)}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}` : ""}`}
              aria-pressed={selected}
              onClick={() => setSelectedKey(key)}
            >
              <span className="cal-day mono">{cell.day}</span>
              {dayEvents.length ? (
                <span className="cal-dots" aria-hidden="true">
                  {dayEvents.slice(0, 3).map((event) => (
                    <i key={event.id} />
                  ))}
                </span>
              ) : null}
              {dayEvents[0] ? (
                <span className="cal-cell-title">{dayEvents[0].title}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="cal-day-detail">
        {selectedKey ? (
          <>
            <h4 className="cal-detail-heading">{shortEventDate(selectedKey)}</h4>
            {!selectedEvents.length ? (
              <p className="todo-empty">No events on this day.</p>
            ) : (
              <ul className="calendar-event-list">
                {selectedEvents.map((event) => (
                  <li key={event.id} className="calendar-event">
                    <div className="calendar-event-body">
                      <strong>{event.title}</strong>
                      <span>Added by {ownerLabel(event.createdBy)}</span>
                      {event.notes ? <p className="calendar-event-notes">{event.notes}</p> : null}
                      {event.assetUrl ? (
                        <a href={event.assetUrl} target="_blank" rel="noreferrer">
                          Open file
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <h4 className="cal-detail-heading">This month</h4>
            {!monthEvents.length ? (
              <p className="todo-empty">No dated events in {monthLabel(year, monthIndex)}.</p>
            ) : (
              <ul className="calendar-event-list">
                {monthEvents.map((event) => (
                  <li key={event.id} className="calendar-event">
                    <div className="calendar-event-when mono">{shortEventDate(event.date)}</div>
                    <div className="calendar-event-body">
                      <strong>{event.title}</strong>
                      <span>Added by {ownerLabel(event.createdBy)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {undated.length ? (
        <div className="cal-undated">
          <h4 className="cal-detail-heading">Undated</h4>
          <ul className="calendar-event-list">
            {undated.map((event) => (
              <li key={event.id} className="calendar-event">
                <div className="calendar-event-when mono">Undated</div>
                <div className="calendar-event-body">
                  <strong>{event.title}</strong>
                  <span>Added by {ownerLabel(event.createdBy)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
