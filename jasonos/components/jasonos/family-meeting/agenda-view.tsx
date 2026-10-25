"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FamilyMeetingIconPicker } from "@/components/jasonos/family-meeting/icon-picker";
import { splitAgendaLists } from "@/lib/family-meeting/collapse";
import { groupEventsByDay } from "@/lib/family-meeting/days";
import type { OccurrenceEdit, SeriesEdit } from "@/lib/family-meeting/edits";
import {
  discernEventIcon,
  locationForDisplay,
  resolveEventIcon,
} from "@/lib/family-meeting/icons";
import type {
  FamilyMeetingAgendaView,
  FamilyMeetingEvent,
} from "@/lib/family-meeting/types";
import { FAMILY_MEETING_TIMEZONE } from "@/lib/family-meeting/weekend";
import {
  archiveFamilyMeetingSeries,
  demoteFamilyMeetingSeries,
  freezeFamilyMeetingPrintNow,
  hideFamilyMeetingOccurrence,
  markFamilyMeetingHeadsUp,
  promoteFamilyMeetingSeries,
  resetFamilyMeetingPresentation,
  setFamilyMeetingSeriesIcon,
  unarchiveFamilyMeetingSeries,
  unhideFamilyMeetingOccurrenceKey,
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

export function FamilyMeetingAgendaView({
  agenda,
  hiddenEdits,
  archivedSeries,
  latestPrintPath,
}: {
  agenda: FamilyMeetingAgendaView;
  hiddenEdits: OccurrenceEdit[];
  archivedSeries: SeriesEdit[];
  latestPrintPath: string | null;
}) {
  const router = useRouter();
  const [undoOpen, setUndoOpen] = useState(false);
  const [iconPickerKey, setIconPickerKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const undoCount = hiddenEdits.length + archivedSeries.length;

  function run(
    label: string,
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>
  ) {
    setActionError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setActionError(`${label}: ${result.error}`);
    });
  }

  const printSheets = useMemo(
    () =>
      agenda.groups.map((lane) => ({
        id: lane.group.id,
        label:
          lane.group.id === "family" ? "Kuperman Family" : lane.group.label,
        accent: lane.group.accent,
      })),
    [agenda.groups]
  );

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
            Edit the board all week. Click any event icon to pick from the full
            set (or Auto). Friday 11:59pm ET freezes a print pack for Saturday
            through the next Sunday — four white letter sheets. Use Heads up for
            long-term reminders on every sheet.
          </p>
          <div className="fm-meta">
            <span className="fm-chip">
              <strong>{agenda.totalEvents}</strong> visible
            </span>
            <span className="fm-chip">{agenda.printFreezeLabel}</span>
            {agenda.connected && agenda.appleIdMasked ? (
              <span className="fm-chip">
                iCloud <strong>{agenda.appleIdMasked}</strong>
              </span>
            ) : null}
            <button
              type="button"
              className="fm-chip fm-chip-btn"
              disabled={pending}
              onClick={() =>
                run("Freeze print", async () => {
                  const r = await freezeFamilyMeetingPrintNow();
                  if (r.ok) {
                    router.push(r.printPath);
                    return { ok: true as const };
                  }
                  return r;
                })
              }
            >
              Freeze &amp; open print
            </button>
            {latestPrintPath ? (
              <Link href={latestPrintPath} className="fm-chip fm-chip-btn">
                Latest print pack
              </Link>
            ) : null}
            <button
              type="button"
              className="fm-chip fm-chip-btn"
              onClick={() => setUndoOpen((v) => !v)}
            >
              Hidden / archived{undoCount ? ` (${undoCount})` : ""}
            </button>
          </div>
          {pending ? <p className="fm-pending">Saving…</p> : null}
          {actionError ? (
            <p className="fm-action-error" role="alert">
              {actionError}
            </p>
          ) : null}
        </header>

        {undoOpen ? (
          <div className="fm-undo">
            <h2>Restore</h2>
            <p className="fm-undo-lede">
              Hide removes one showing (a later calendar date can come back).
              Archive removes the whole series until you restore it here.
            </p>
            <div className="fm-undo-cols">
              <div>
                <h3>Hidden showings</h3>
                {hiddenEdits.length === 0 ? (
                  <p className="fm-empty">None</p>
                ) : (
                  <ul>
                    {hiddenEdits.map((h) => (
                      <li key={h.occurrence_key}>
                        <span>
                          <strong>{h.title}</strong>
                          <em>
                            {" "}
                            · {h.day_key}
                          </em>
                        </span>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run("Unhide", () =>
                              unhideFamilyMeetingOccurrenceKey(
                                h.occurrence_key
                              )
                            )
                          }
                        >
                          Unhide
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3>Archived series</h3>
                {archivedSeries.length === 0 ? (
                  <p className="fm-empty">None</p>
                ) : (
                  <ul>
                    {archivedSeries.map((a) => (
                      <li key={a.series_key}>
                        <span>
                          <strong>{a.title || a.series_key}</strong>
                        </span>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run("Unarchive", () =>
                              unarchiveFamilyMeetingSeries(a.series_key)
                            )
                          }
                        >
                          Unarchive
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {!agenda.connected ? (
          <div className="fm-banner">
            <h2>Connect iCloud Calendar</h2>
            <p>
              These people-group calendars live on iCloud, not Google. In{" "}
              <Link href="/settings">Settings</Link>, add your Apple ID and an
              app-specific password, then reopen this page.
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
            const headsUps = lane.events.filter(
              (e) => e.presentation === "heads_up"
            );
            const rest = lane.events.filter(
              (e) => e.presentation !== "heads_up"
            );
            const { spotlight, routines } = splitAgendaLists(rest);
            const days = groupEventsByDay(spotlight);
            const displayCount =
              spotlight.length + routines.length + headsUps.length;
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
                    {headsUps.length ? (
                      <div className="fm-headsup">
                        <h3 className="fm-headsup-label">Long Term Heads Up</h3>
                        <ul>
                          {headsUps.map((ev) => {
                            const peers = seriesEvents(
                              lane.events,
                              ev.seriesKey ?? ""
                            );
                            return (
                              <li key={ev.id}>
                                <span>{ev.title}</span>
                                <div className="fm-event-actions">
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() =>
                                      run("Remove heads up", () =>
                                        resetFamilyMeetingPresentation({
                                          seriesKey: ev.seriesKey!,
                                          events: peers,
                                        })
                                      )
                                    }
                                  >
                                    Off print
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
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}

                    {days.length ? (
                      <div className="fm-days">
                        {days.map((day) => (
                          <div key={day.key} className="fm-day">
                            <h3 className="fm-day-head">
                              <span className="fm-day-weekday">
                                {day.weekday}
                              </span>
                              <span className="fm-day-date">{day.date}</span>
                            </h3>
                            <div className="fm-events">
                              {day.events.map((ev) => {
                                const time = formatEventClock(ev);
                                const autoIcon = discernEventIcon(
                                  ev.title,
                                  ev.location
                                );
                                const icon = resolveEventIcon(ev);
                                const loc = locationForDisplay(ev.location);
                                const peers = seriesEvents(
                                  lane.events,
                                  ev.seriesKey ?? ""
                                );
                                const seriesKey = ev.seriesKey!;
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
                                                seriesKey,
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
                                                seriesKey,
                                                events: peers,
                                              })
                                            )
                                          }
                                        >
                                          → Rhythm
                                        </button>
                                        <button
                                          type="button"
                                          disabled={pending}
                                          onClick={() =>
                                            run("Heads up", () =>
                                              markFamilyMeetingHeadsUp({
                                                seriesKey,
                                                events: peers,
                                              })
                                            )
                                          }
                                        >
                                          Heads up
                                        </button>
                                        {ev.presentation &&
                                        ev.presentation !== "auto" ? (
                                          <button
                                            type="button"
                                            disabled={pending}
                                            onClick={() =>
                                              run("Reset", () =>
                                                resetFamilyMeetingPresentation({
                                                  seriesKey,
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
                                    <FamilyMeetingIconPicker
                                      className="fm-event-icon"
                                      current={icon}
                                      autoId={autoIcon}
                                      open={iconPickerKey === seriesKey}
                                      onOpenChange={(open) =>
                                        setIconPickerKey(
                                          open ? seriesKey : null
                                        )
                                      }
                                      disabled={pending}
                                      onPick={(iconId) =>
                                        run("Icon", () =>
                                          setFamilyMeetingSeriesIcon({
                                            seriesKey,
                                            title: ev.title,
                                            iconId,
                                          })
                                        )
                                      }
                                    />
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
                            const sample = row.occurrences[0];
                            const autoIcon = discernEventIcon(row.title);
                            const icon = sample
                              ? resolveEventIcon(sample)
                              : autoIcon;
                            const meta = formatRoutineMeta(row);
                            const seriesKey =
                              sample?.seriesKey ?? row.key;
                            return (
                              <li
                                key={row.key}
                                className="fm-rhythm-row"
                                aria-label={`${row.title}. ${meta}`}
                              >
                                <FamilyMeetingIconPicker
                                  className="fm-rhythm-icon"
                                  current={icon}
                                  autoId={autoIcon}
                                  open={iconPickerKey === seriesKey}
                                  onOpenChange={(open) =>
                                    setIconPickerKey(open ? seriesKey : null)
                                  }
                                  disabled={pending}
                                  onPick={(iconId) =>
                                    run("Icon", () =>
                                      setFamilyMeetingSeriesIcon({
                                        seriesKey,
                                        title: row.title,
                                        iconId,
                                      })
                                    )
                                  }
                                />
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
                                      run("Heads up", () =>
                                        markFamilyMeetingHeadsUp({
                                          seriesKey,
                                          events: row.occurrences,
                                        })
                                      )
                                    }
                                  >
                                    Heads up
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

        <p className="fm-print-hint">
          Sheets at freeze:{" "}
          {printSheets.map((s) => s.label).join(" · ")}. Family events and Heads
          ups appear on every sheet; Kyle/Wyatt also land on Kat &amp; Jason.
        </p>
      </div>
    </div>
  );
}
