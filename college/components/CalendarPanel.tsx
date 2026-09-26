"use client";

import { useEffect, useMemo, useState } from "react";
import {
  removeCalendarEvent,
  shortEventDate,
  updateCalendarEvent,
  type CalendarEvent,
  type CalendarEventEdit,
} from "@/lib/calendar-events";
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

function todayKey(now = new Date()): string {
  return toKey(now.getFullYear(), now.getMonth(), now.getDate());
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

function EventRow({
  event,
  showWhen,
  onChange,
  onDelete,
}: {
  event: CalendarEvent;
  showWhen?: boolean;
  onChange: (id: string, patch: CalendarEventEdit) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [titleDraft, setTitleDraft] = useState(event.title);
  const [dateDraft, setDateDraft] = useState(event.date ?? "");
  const [notesDraft, setNotesDraft] = useState(event.notes);

  useEffect(() => {
    setEditing(false);
    setConfirmDelete(false);
    setTitleDraft(event.title);
    setDateDraft(event.date ?? "");
    setNotesDraft(event.notes);
  }, [event.id, event.title, event.date, event.notes]);

  function save() {
    onChange(event.id, {
      title: titleDraft,
      date: dateDraft.trim() || null,
      notes: notesDraft,
    });
    setEditing(false);
  }

  return (
    <li className="calendar-event">
      {showWhen ? (
        <div className="calendar-event-when mono">{shortEventDate(event.date)}</div>
      ) : null}
      <div className="calendar-event-body">
        {editing ? (
          <div className="cal-event-edit">
            <label className="cal-event-edit-field">
              <span className="label">Title</span>
              <input
                className="field"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
              />
            </label>
            <label className="cal-event-edit-field">
              <span className="label">Date</span>
              <input
                className="field"
                type="date"
                value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
              />
            </label>
            <label className="cal-event-edit-field">
              <span className="label">Notes</span>
              <textarea
                className="field"
                rows={3}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
              />
            </label>
            <div className="cal-event-edit-actions">
              <button type="button" className="btn btn-primary compact" onClick={save}>
                Save
              </button>
              <button
                type="button"
                className="btn btn-secondary compact"
                onClick={() => {
                  setEditing(false);
                  setTitleDraft(event.title);
                  setDateDraft(event.date ?? "");
                  setNotesDraft(event.notes);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <strong>{event.title}</strong>
            <span>Added by {ownerLabel(event.createdBy)}</span>
            {event.notes ? <p className="calendar-event-notes">{event.notes}</p> : null}
            {event.assetUrl ? (
              <a href={event.assetUrl} target="_blank" rel="noreferrer">
                Open file
              </a>
            ) : null}
            <div className="cal-event-row-actions">
              <button
                type="button"
                className="btn btn-secondary compact"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              {confirmDelete ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary compact"
                    onClick={() => onDelete(event.id)}
                  >
                    Delete event
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost compact"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Keep
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost compact"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </li>
  );
}

export function CalendarPanel({
  events,
  dateline,
  focusDate,
  onChangeEvents,
}: {
  events: CalendarEvent[];
  dateline: string;
  /** When set (YYYY-MM-DD), open the month that contains this date. */
  focusDate?: string | null;
  onChangeEvents: (next: CalendarEvent[]) => void;
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
  const today = todayKey();
  const viewingTodayMonth =
    year === Number(today.slice(0, 4)) && monthIndex === Number(today.slice(5, 7)) - 1;
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

  function goToday() {
    const now = new Date();
    const key = todayKey(now);
    setCursor({ year: now.getFullYear(), monthIndex: now.getMonth() });
    setSelectedKey(key);
  }

  function patchEvent(id: string, patch: CalendarEventEdit) {
    const next = updateCalendarEvent(events, id, patch);
    onChangeEvents(next);
    const updated = next.find((row) => row.id === id);
    if (updated?.date) {
      const nextCursor = cursorFromDate(updated.date);
      if (nextCursor) {
        setCursor(nextCursor);
        setSelectedKey(updated.date);
      }
    } else if (updated && !updated.date) {
      setSelectedKey(null);
    }
  }

  function deleteEvent(id: string) {
    onChangeEvents(removeCalendarEvent(events, id));
  }

  async function copySubscribeLink() {
    if (!subscribeHttps) return;
    setSubscribeBusy(true);
    setSubscribeStatus("");
    try {
      await navigator.clipboard.writeText(subscribeHttps);
      setSubscribeStatus(
        "Copied the subscribe link. Paste it in Apple Calendar, Google Calendar, or Outlook.",
      );
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

      <div className="cal-toolbar">
        <button type="button" className="btn btn-secondary compact" onClick={() => shiftMonth(-1)}>
          Previous
        </button>
        <div className="cal-toolbar-center">
          <h4 className="cal-month-label mono">{monthLabel(year, monthIndex)}</h4>
          <button
            type="button"
            className={`btn compact cal-today-jump${viewingTodayMonth ? " is-current" : " btn-secondary"}`}
            onClick={goToday}
            aria-current={viewingTodayMonth ? "date" : undefined}
          >
            Today
          </button>
        </div>
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
          const isToday = key === today;
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              className={`cal-cell${dayEvents.length ? " has-events" : ""}${selected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
              aria-label={`${shortEventDate(key)}${isToday ? ", today" : ""}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}` : ""}`}
              aria-pressed={selected}
              aria-current={isToday ? "date" : undefined}
              onClick={() => setSelectedKey(key)}
            >
              <span className="cal-day-row">
                <span className={`cal-day mono${isToday ? " is-today" : ""}`}>{cell.day}</span>
                {isToday ? <span className="cal-today-mark mono">Today</span> : null}
              </span>
              {dayEvents.length ? (
                <span className="cal-dots" aria-hidden="true">
                  {dayEvents.slice(0, 3).map((row) => (
                    <i key={row.id} />
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
                  <EventRow
                    key={event.id}
                    event={event}
                    onChange={patchEvent}
                    onDelete={deleteEvent}
                  />
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
                  <EventRow
                    key={event.id}
                    event={event}
                    showWhen
                    onChange={patchEvent}
                    onDelete={deleteEvent}
                  />
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
              <EventRow
                key={event.id}
                event={event}
                showWhen
                onChange={patchEvent}
                onDelete={deleteEvent}
              />
            ))}
          </ul>
        </div>
      ) : null}

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
    </div>
  );
}
