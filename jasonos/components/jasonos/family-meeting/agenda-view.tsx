import Link from "next/link";
import type { FamilyMeetingAgenda, FamilyMeetingEvent } from "@/lib/family-meeting/types";
import { FAMILY_MEETING_TIMEZONE } from "@/lib/family-meeting/weekend";

function formatEventTime(ev: FamilyMeetingEvent): { day: string; time: string } {
  const start = new Date(ev.startsAt);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: FAMILY_MEETING_TIMEZONE,
    weekday: "short",
  }).format(start);

  if (ev.allDay) {
    return { day, time: "All day" };
  }

  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: FAMILY_MEETING_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(start);

  return { day, time };
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
            <span>Weekend agenda</span>
          </div>
          <h1 className="fm-title">
            This weekend, <em>{agenda.weekendLabel}</em>
          </h1>
          <p className="fm-lede">
            Agenda built from the Family, Kat &amp; Jason, Kyle, and Wyatt
            calendars — what needs airtime before Monday.
          </p>
          <div className="fm-meta">
            <span className="fm-chip">
              <strong>{agenda.totalEvents}</strong> items
            </span>
            <span className="fm-chip">
              Fri 5pm → Sun night · {agenda.timezone.replace("_", " ")}
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
              calendars named Family, Kat &amp; Jason, Kyle, and Wyatt.
            </p>
          </div>
        ) : null}

        {agenda.error ? (
          <div className="fm-warn" role="alert">
            {agenda.error}
          </div>
        ) : null}

        {agenda.warnings.length ? (
          <div className="fm-warn">
            <strong>Calendar notes</strong>
            <ul>
              {agenda.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="fm-board">
          {agenda.groups.map((lane) => (
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
                <div className="fm-count">{lane.events.length}</div>
              </div>

              {lane.events.length === 0 ? (
                <p className="fm-empty">
                  {agenda.connected
                    ? "Nothing on this calendar for the weekend."
                    : "Events appear here once iCloud is connected."}
                </p>
              ) : (
                <div className="fm-events">
                  {lane.events.map((ev) => {
                    const { day, time } = formatEventTime(ev);
                    return (
                      <article key={ev.id} className="fm-event">
                        <div className="fm-event-time">
                          <span className="fm-event-day">{day}</span>
                          {time}
                        </div>
                        <div>
                          <h3 className="fm-event-title">{ev.title}</h3>
                          {ev.location ? (
                            <p className="fm-event-loc">{ev.location}</p>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
