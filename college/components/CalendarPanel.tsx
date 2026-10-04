"use client";

import { useEffect, useMemo, useState } from "react";
import { UsersThree } from "@phosphor-icons/react";
import {
  removeCalendarEvent,
  shortEventDate,
  updateCalendarEvent,
  type CalendarEvent,
  type CalendarEventEdit,
} from "@/lib/calendar-events";
import {
  agendaForMeetingDate,
  familyMeetingCadenceLabel,
  familyMeetingsInMonth,
} from "@/lib/family-meeting";
import {
  PROCESS_SOURCE_LABEL,
  type ProcessCalendarEntry,
} from "@/lib/calendar-sources";
import type { ProjectTodo } from "@/lib/project-todos";

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

function isProcessEntry(event: CalendarEvent | ProcessCalendarEntry): event is ProcessCalendarEntry {
  return "source" in event && Boolean((event as ProcessCalendarEntry).source);
}

function ProcessEventRow({
  event,
  showWhen,
  onOpen,
}: {
  event: ProcessCalendarEntry;
  showWhen?: boolean;
  onOpen?: (event: ProcessCalendarEntry) => void;
}) {
  const label = PROCESS_SOURCE_LABEL[event.source];
  return (
    <li className="calendar-event is-readonly">
      {showWhen ? (
        <div className="calendar-event-when mono">{shortEventDate(event.date)}</div>
      ) : null}
      <div className="calendar-event-body">
        <span className="cal-source-label mono">{label}</span>
        {onOpen ? (
          <button type="button" className="cal-source-link" onClick={() => onOpen(event)}>
            <strong>{event.title}</strong>
          </button>
        ) : (
          <strong>{event.title}</strong>
        )}
      </div>
    </li>
  );
}

export function CalendarPanel({
  events,
  processEntries = [],
  familyTodos = [],
  dateline,
  focusDate,
  onChangeEvents,
  onOpenProcessEntry,
}: {
  events: CalendarEvent[];
  processEntries?: ProcessCalendarEntry[];
  familyTodos?: ProjectTodo[];
  dateline: string;
  /** When set (YYYY-MM-DD), open the month that contains this date. */
  focusDate?: string | null;
  onChangeEvents: (next: CalendarEvent[]) => void;
  onOpenProcessEntry?: (entry: ProcessCalendarEntry) => void;
}) {
  const [cursor, setCursor] = useState(
    () => cursorFromDate(focusDate) ?? initialCursor([...events, ...processEntries]),
  );
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

  const mergedEvents = useMemo(
    () => [...events, ...processEntries],
    [events, processEntries],
  );

  const familyMeetings = useMemo(
    () => familyMeetingsInMonth(year, monthIndex),
    [year, monthIndex],
  );
  const familyByDay = useMemo(() => {
    const map = new Map<string, (typeof familyMeetings)[number]>();
    for (const meeting of familyMeetings) map.set(meeting.date, meeting);
    return map;
  }, [familyMeetings]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of mergedEvents) {
      if (!event.date) continue;
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [mergedEvents]);

  const undated = mergedEvents.filter((event) => !event.date);
  const monthEvents = mergedEvents
    .filter((event) => event.date?.startsWith(`${year}-${pad2(monthIndex + 1)}`))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const selectedEvents = selectedKey ? byDay.get(selectedKey) ?? [] : [];
  const selectedMeeting = selectedKey ? familyByDay.get(selectedKey) ?? null : null;
  const selectedAgenda = selectedMeeting
    ? agendaForMeetingDate(selectedMeeting.date, familyTodos)
    : [];
  const monthHasFamily = familyMeetings.length > 0;

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

  function renderEvent(event: CalendarEvent | ProcessCalendarEntry, showWhen?: boolean) {
    if (isProcessEntry(event)) {
      return (
        <ProcessEventRow
          key={event.id}
          event={event}
          showWhen={showWhen}
          onOpen={onOpenProcessEntry}
        />
      );
    }
    return (
      <EventRow
        key={event.id}
        event={event}
        showWhen={showWhen}
        onChange={patchEvent}
        onDelete={deleteEvent}
      />
    );
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
          const family = familyByDay.get(key);
          const selected = selectedKey === key;
          const isToday = key === today;
          const marked = dayEvents.length > 0 || Boolean(family);
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              className={`cal-cell${marked ? " has-events" : ""}${family ? " has-family" : ""}${selected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
              aria-label={`${shortEventDate(key)}${isToday ? ", today" : ""}${family ? ", family meeting" : ""}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}` : ""}`}
              aria-pressed={selected}
              aria-current={isToday ? "date" : undefined}
              onClick={() => setSelectedKey(key)}
            >
              <span className="cal-day-row">
                <span className={`cal-day mono${isToday ? " is-today" : ""}`}>{cell.day}</span>
                {isToday ? <span className="cal-today-mark mono">Today</span> : null}
              </span>
              {marked ? (
                <span className="cal-dots" aria-hidden="true">
                  {family ? <i className="is-family" /> : null}
                  {dayEvents.slice(0, family ? 2 : 3).map((row) => (
                    <i key={row.id} />
                  ))}
                </span>
              ) : null}
              {family ? (
                <span className="cal-cell-title">Family meeting</span>
              ) : dayEvents[0] ? (
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
            {selectedMeeting ? (
              <div className="cal-family">
                <div className="cal-family-head">
                  <UsersThree size={20} weight="bold" aria-hidden="true" />
                  <div>
                    <strong>Family meeting</strong>
                    <span>
                      {selectedMeeting.phase === "exploration"
                        ? "Exploration"
                        : selectedMeeting.phase === "consideration"
                          ? "Consideration"
                          : "Applications"}{" "}
                      · {familyMeetingCadenceLabel(selectedMeeting.phase)}
                    </span>
                  </div>
                </div>
                {selectedAgenda.length ? (
                  <ul className="cal-agenda">
                    {selectedAgenda.map((item) => (
                      <li key={item.id}>
                        <span>{item.label}</span>
                        <span className="cal-agenda-acks">
                          {item.doneBy.length}/3 ready
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="todo-empty">No open family-meeting items on this agenda.</p>
                )}
              </div>
            ) : null}
            {!selectedEvents.length && !selectedMeeting ? (
              <p className="todo-empty">No events on this day.</p>
            ) : selectedEvents.length ? (
              <ul className="calendar-event-list">
                {selectedEvents.map((event) => renderEvent(event))}
              </ul>
            ) : null}
          </>
        ) : (
          <>
            <h4 className="cal-detail-heading">This month</h4>
            {!monthEvents.length && !monthHasFamily ? (
              <p className="todo-empty">No dated events in {monthLabel(year, monthIndex)}.</p>
            ) : (
              <>
                {familyMeetings.length ? (
                  <ul className="calendar-event-list cal-family-month">
                    {familyMeetings.map((meeting) => {
                      const agenda = agendaForMeetingDate(meeting.date, familyTodos);
                      return (
                        <li key={meeting.id} className="calendar-event">
                          <div className="calendar-event-when mono">{shortEventDate(meeting.date)}</div>
                          <div className="calendar-event-body">
                            <strong>Family meeting</strong>
                            <span>
                              {familyMeetingCadenceLabel(meeting.phase)}
                              {agenda.length
                                ? ` · ${agenda.length} agenda item${agenda.length === 1 ? "" : "s"}`
                                : ""}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {monthEvents.length ? (
              <ul className="calendar-event-list">
                {monthEvents.map((event) => renderEvent(event, true))}
              </ul>
                ) : null}
              </>
            )}
          </>
        )}
      </div>

      {undated.length ? (
        <div className="cal-undated">
          <h4 className="cal-detail-heading">Undated</h4>
          <ul className="calendar-event-list">
            {undated.map((event) => renderEvent(event, true))}
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
