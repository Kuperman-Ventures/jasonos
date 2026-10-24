import Link from "next/link";
import { FamilyMeetingEventIcon } from "@/components/jasonos/family-meeting/event-icon";
import { splitAgendaLists } from "@/lib/family-meeting/collapse";
import { groupEventsByDay } from "@/lib/family-meeting/days";
import { discernEventIcon, locationForDisplay } from "@/lib/family-meeting/icons";
import type { FamilyMeetingAgenda, FamilyMeetingEvent } from "@/lib/family-meeting/types";
import { FAMILY_MEETING_TIMEZONE } from "@/lib/family-meeting/weekend";

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

export function FamilyMeetingAgendaView({ agenda }: { agenda: FamilyMeetingAgenda }) {
  return (
    <div className="fm-root">
      <div className="fm-shell">
        <header className="fm-hero">
          <div className="fm-kicker">
            <span className="fm-kicker-dot" aria-hidden />
            <span>Family Meeting</span>
            <span>·</span>
            <span>Next two weeks</span>
          </div>
          <h1 className="fm-title">
            Coming up, <em>{agenda.weekendLabel}</em>
          </h1>
          <p className="fm-lede">
            Agenda from the Kuperman Family, Kat &amp; Jason, Kyle, and Wyatt
            calendars — weekdays and weekends for the next two weeks.
          </p>
          <div className="fm-meta">
            <span className="fm-chip">
              <strong>{agenda.totalEvents}</strong> items
            </span>
            <span className="fm-chip">
              2 weeks · {agenda.timezone.replace("_", " ")}
            </span>
            {agenda.connected && agenda.appleIdMasked ? (
              <span className="fm-chip">
                iCloud <strong>{agenda.appleIdMasked}</strong>
              </span>
            ) : null}
          </div>
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
                                      <span className="fm-event-clock">{time}</span>
                                    </div>
                                    <div className="fm-event-copy">
                                      <h4 className="fm-event-title">
                                        {ev.title}
                                      </h4>
                                      {loc ? (
                                        <p className="fm-event-loc">{loc}</p>
                                      ) : null}
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
    </div>
  );
}
