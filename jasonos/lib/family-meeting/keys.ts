import { normalizeRoutineTitle } from "./routine";
import type { FamilyMeetingEvent } from "./types";
import { FAMILY_MEETING_TIMEZONE } from "./weekend";

/** Series identity: calendar UID when present, else normalized title. */
export function seriesKeyForEvent(ev: Pick<FamilyMeetingEvent, "uid" | "title">): string {
  const uid = (ev.uid || "").trim().toLowerCase();
  if (uid) return `uid:${uid}`;
  return `title:${normalizeRoutineTitle(ev.title)}`;
}

/** One concrete showing (series + start instant). */
export function occurrenceKeyForEvent(
  ev: Pick<FamilyMeetingEvent, "uid" | "title" | "startsAt">
): string {
  return `${seriesKeyForEvent(ev)}|${ev.startsAt}`;
}

/** America/New_York calendar day YYYY-MM-DD for an event start. */
export function dayKeyForEvent(
  startsAt: string,
  timeZone: string = FAMILY_MEETING_TIMEZONE
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(startsAt));
}

export function todayKeyEt(
  now: Date = new Date(),
  timeZone: string = FAMILY_MEETING_TIMEZONE
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
