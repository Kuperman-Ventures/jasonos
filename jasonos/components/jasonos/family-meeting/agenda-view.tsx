"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { FamilyMeetingEventIcon } from "@/components/jasonos/family-meeting/event-icon";
import { splitAgendaLists } from "@/lib/family-meeting/collapse";
import { groupEventsByDay } from "@/lib/family-meeting/days";
import { discernEventIcon, locationForDisplay } from "@/lib/family-meeting/icons";
import type {
  FamilyMeetingAgenda,
  FamilyMeetingEvent,
} from "@/lib/family-meeting/types";
import { FAMILY_MEETING_TIMEZONE } from "@/lib/family-meeting/weekend";
import {
  archiveFamilyMeetingSeries,
  demoteFamilyMeetingSeries,
  hideFamilyMeetingOccurrence,
  promoteFamilyMeetingSeries,
  resetFamilyMeetingPresentation,
} from "@/lib/server-actions/family-meeting";

function formatEventClock(ev: FamilyMeetingEvent): string {
  if (ev.allDay) return "All day";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: FAMILY_MEETING_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ev.startsAt));
}

function formatRoutineMeta(parts: {
  weekdayLabel: string;
  timeLabel: string | null;
  dateLabels: string[];
  allDay: boolean;
}): string {
  const when = parts.timeLabel
    ? `${parts.weekdayLabel} · ${parts.timeLabel}`
    : parts.weekdayLabel;
  const dates =
    parts.dateLabels.length <= 2
      ? parts.dateLabels.join(" & ")
      : `${parts.dateLabels[0]} +${parts.dateLabels.length - 1}`;
  return `${when} · ${dates}`;
}

function seriesEvents(
  laneEvents: FamilyMeetingEvent[],
  seriesKey: string
): FamilyMeetingEvent[] {
  return laneEvents.filter((e) => e.seriesKey === seriesKey);
}

export function FamilyMeetingAgendaView({ agenda }: { agenda: FamilyMeetingAgenda }) {
  const [printOpen, setPrintOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const printSheets = useMemo(
    () =>
      agenda.groups.map((lane) => ({
        id: lane.group.id,
        label:
          lane.group.id === "family"
            ? "Kuperman Family"
            : lane.group.label,
        accent: lane.group.accent,
      })),
    [agenda.groups]
  );

  function run(label: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setActionError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setActionError(`${label}: ${result.error}`);
    });
  }

  return (
    <div className="fm-root">
      <div className="fm-shell">
        <header className="fm-hero">
          <div className="fm-kicker">
            <span className="fm-kicker-dot" aria-hidden />
            <span>Family Meeting</span>
            <span>·</span>
            <span>Editor · next two weeks</span>
          </div>
          <h1 className="fm-title">
            Coming up, <em>{agenda.weekendLabel}</em>
          </h1>
          <p className="fm-lede">
            Edit the Kuperman Family, Kat &amp; Jason, Kyle, and Wyatt boards.
            Hide one showing, archive a whole series, or move items between
            spotlight and weekly rhythm. Print sheets freeze Friday 11:59pm ET.
          </p>
          <div className="fm-meta">
            <span className="fm-chip">
              <strong>{agenda.totalEvents}</strong> visible
            </span>
            <span className="fm-chip">
              2 weeks · {agenda.timezone.replace("_", " ")}
            </span>
            {agenda.connected && agenda.appleIdMasked ? (
              <span className="fm-chip">
                iCloud <strong>{agenda.appleIdMasked}</strong>
              </span>
            ) : null}
            {agenda.loggedDayCount > 0 ? (
              <span className="fm-chip">
                Logged <strong>{agenda.loggedDayCount}</strong> past day
                {agenda.loggedDayCount === 1 ? "" : "s"}
              </span>
            ) : null}
            <button
              type="button"
              className="fm-chip fm-chip-btn"
              onClick={() => setPrintOpen(true)}
            >
              Print 4 sheets
            </button>
          </div>
          {pending ? <p className="fm-pending">Saving…</p> : null}
          {actionError ? (
            <p className="fm-action-error" role="alert">
              {actionError}
            </p>
          ) : null}
        </header>

        {!agenda.connected ? (
          <div className="fm-banner">
            <h2>Connect iCloud Calendar</h2>
            <p>
              These people-group calendars live on iCloud, not Google. In{" "}
              <Link href="/settings">Settings</Link>, add your Apple ID and an
              app-specific password, then reopen this page. JasonOS will match
              calendars named Kuperman Family, Kat &amp; Jason, Kyle, and Wyatt.
            </p>
          </div>
        ) : null}

        {agenda.error ? (
          <div className="fm-warn" role="alert">
            {agenda.error}
          </div>
        ) : null}

        <div className="fm-board">
          {agenda.groups.map((lane) => {
            const { spotlight, routines } = splitAgendaLists(lane.events);
            const days = groupEventsByDay(spotlight);
            const displayCount = spotlight.length + routines.length;
            return (
              <section
                key={lane.group.id}
                className="fm-lane"
                style={{ ["--lane-accent" as string]: lane.group.accent }}
                aria-label={lane.group.label}
              >
                <div className="fm-lane-head">
                  <div>
                    <h2 className="fm-lane-label">{lane.group.label}</h2>
                    <p className="fm-lane-sub">
                      {lane.calendarName
                        ? `Calendar · ${lane.calendarName}`
                        : agenda.connected
                          ? "No matching calendar yet"
                          : "Waiting on iCloud"}
                    </p>
                  </div>
                  <div className="fm-count">{displayCount}</div>
                </div>

                {lane.events.length === 0 ? (
                  <p className="fm-empty">
                    {agenda.connected
                      ? "Nothing on this calendar in the next two weeks."
                      : "Events appear here once iCloud is connected."}
                  </p>
                ) : (
                  <>
                    {days.length ? (
                      <div className="fm-days">
                        {days.map((day) => (
                          <div key={day.key} className="fm-day">
                            <h3 className="fm-day-head">
                              <span className="fm-day-weekday">{day.weekday}</span>
                              <span className="fm-day-date">{day.date}</span>
                            </h3>
                            <div className="fm-events">
                              {day.events.map((ev) => {
                                const time = formatEventClock(ev);
                                const icon = discernEventIcon(
                                  ev.title,
                                  ev.location
                                );
                                const loc = locationForDisplay(ev.location);
                                const peers = seriesEvents(
                                  lane.events,
                                  ev.seriesKey ?? ""
                                );
                                return (
                                  <article
                                    key={ev.id}
                                    className="fm-event"
                                    aria-label={`${day.weekday} ${day.date}, ${time}: ${ev.title}`}
                                  >
                                    <div
                                      className="fm-event-when"
                                      aria-label={time}
                                    >
                                      <span className="fm-event-clock">
                                        {time}
                                      </span>
                                    </div>
                                    <div className="fm-event-copy">
                                      <h4 className="fm-event-title">
                                        {ev.title}
                                      </h4>
                                      {loc ? (
                                        <p className="fm-event-loc">{loc}</p>
                                      ) : null}
                                      <div className="fm-event-actions">
                                        <button
                                          type="button"
                                          disabled={pending}
                                          onClick={() =>
                                            run("Hide", () =>
                                              hideFamilyMeetingOccurrence(ev)
                                            )
                                          }
                                        >
                                          Hide
                                        </button>
                                        <button
                                          type="button"
                                          disabled={pending}
                                          onClick={() =>
                                            run("Archive", () =>
                                              archiveFamilyMeetingSeries({
                                                seriesKey: ev.seriesKey!,
                                                title: ev.title,
                                                events: peers,
                                              })
                                            )
                                          }
                                        >
                                          Archive
                                        </button>
                                        <button
                                          type="button"
                                          disabled={pending}
                                          onClick={() =>
                                            run("Demote", () =>
                                              demoteFamilyMeetingSeries({
                                                seriesKey: ev.seriesKey!,
                                                events: peers,
                                              })
                                            )
                                          }
                                        >
                                          → Rhythm
                                        </button>
                                        {ev.presentation &&
                                        ev.presentation !== "auto" ? (
                                          <button
                                            type="button"
                                            disabled={pending}
                                            onClick={() =>
                                              run("Reset", () =>
                                                resetFamilyMeetingPresentation({
                                                  seriesKey: ev.seriesKey!,
                                                  events: peers,
                                                })
                                              )
                                            }
                                          >
                                            Auto
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                    <span className="fm-event-icon" aria-hidden>
                                      <FamilyMeetingEventIcon id={icon} />
                                    </span>
                                  </article>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {routines.length ? (
                      <div className="fm-rhythm">
                        <h3 className="fm-rhythm-label">Weekly rhythm</h3>
                        <ul className="fm-rhythm-list">
                          {routines.map((row) => {
                            const icon = discernEventIcon(row.title);
                            const meta = formatRoutineMeta(row);
                            const seriesKey =
                              row.occurrences[0]?.seriesKey ?? row.key;
                            return (
                              <li
                                key={row.key}
                                className="fm-rhythm-row"
                                aria-label={`${row.title}. ${meta}`}
                              >
                                <span className="fm-rhythm-icon" aria-hidden>
                                  <FamilyMeetingEventIcon id={icon} />
                                </span>
                                <span className="fm-rhythm-title">
                                  {row.title}
                                </span>
                                <span className="fm-rhythm-meta">{meta}</span>
                                <div className="fm-rhythm-actions">
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() =>
                                      run("Promote", () =>
                                        promoteFamilyMeetingSeries({
                                          seriesKey,
                                          events: row.occurrences,
                                        })
                                      )
                                    }
                                  >
                                    Promote
                                  </button>
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() =>
                                      run("Hide", async () => {
                                        for (const occ of row.occurrences) {
                                          const r =
                                            await hideFamilyMeetingOccurrence(
                                              occ
                                            );
                                          if (!r.ok) return r;
                                        }
                                        return { ok: true as const };
                                      })
                                    }
                                    title="Hide these showings; later calendar dates can reappear"
                                  >
                                    Hide
                                  </button>
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() =>
                                      run("Archive", () =>
                                        archiveFamilyMeetingSeries({
                                          seriesKey,
                                          title: row.title,
                                          events: row.occurrences,
                                        })
                                      )
                                    }
                                  >
                                    Archive
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                  </>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {printOpen ? (
        <div
          className="fm-print-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Print four sheets"
        >
          <div className="fm-print-panel">
            <div className="fm-print-panel-head">
              <div>
                <h2>Print pack · wireframe</h2>
                <p>
                  Four letter pages (one lane each). Content freezes at{" "}
                  <strong>{agenda.printFreezeLabel}</strong> and covers the
                  immediate week ahead. Layout guidance comes next.
                </p>
              </div>
              <button
                type="button"
                className="fm-chip fm-chip-btn"
                onClick={() => setPrintOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="fm-print-sheets">
              {printSheets.map((sheet, i) => (
                <article
                  key={sheet.id}
                  className="fm-print-sheet"
                  style={{ ["--lane-accent" as string]: sheet.accent }}
                >
                  <header>
                    <span className="fm-print-sheet-num">Page {i + 1}</span>
                    <h3>{sheet.label}</h3>
                  </header>
                  <div className="fm-print-sheet-body">
                    <p>PDF sheet placeholder</p>
                    <ul>
                      <li>Day-grouped spotlight events</li>
                      <li>Weekly rhythm block</li>
                      <li>Frozen Fri 11:59pm ET · week ahead</li>
                    </ul>
                  </div>
                </article>
              ))}
            </div>
            <p className="fm-print-footnote">
              Export to PDF is stubbed — editor edits above already persist and
              will feed this pack in the next phase.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
