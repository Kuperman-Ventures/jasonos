import type { FamilyMeetingEvent } from "./types";
import { FAMILY_MEETING_TIMEZONE } from "./weekend";

function localDayKey(
  iso: string,
  timeZone: string = FAMILY_MEETING_TIMEZONE
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Normalize titles so "Change cats' water" ≈ "change cats water". */
export function normalizeRoutineTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Mark week-to-week repeats so the agenda can render them quietly.
 * An item is a routine when the same series UID shows up on 2+ days, or the
 * same normalized title does (covers chores entered as separate events).
 */
export function markRoutineEvents(
  events: FamilyMeetingEvent[],
  timeZone: string = FAMILY_MEETING_TIMEZONE
): FamilyMeetingEvent[] {
  const uidDays = new Map<string, Set<string>>();
  const titleDays = new Map<string, Set<string>>();

  for (const ev of events) {
    const day = localDayKey(ev.startsAt, timeZone);
    const uid = (ev.uid || "").trim().toLowerCase();
    if (uid) {
      const set = uidDays.get(uid) ?? new Set();
      set.add(day);
      uidDays.set(uid, set);
    }
    const titleKey = normalizeRoutineTitle(ev.title);
    if (titleKey) {
      const set = titleDays.get(titleKey) ?? new Set();
      set.add(day);
      titleDays.set(titleKey, set);
    }
  }

  return events.map((ev) => {
    const uid = (ev.uid || "").trim().toLowerCase();
    const titleKey = normalizeRoutineTitle(ev.title);
    const routine =
      (uid !== "" && (uidDays.get(uid)?.size ?? 0) >= 2) ||
      (titleKey !== "" && (titleDays.get(titleKey)?.size ?? 0) >= 2);
    if (ev.routine === routine) return ev;
    return { ...ev, routine };
  });
}
