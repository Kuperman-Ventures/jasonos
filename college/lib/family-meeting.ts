/** Family meeting cadence and agenda for household to-dos. */

import type { CalendarEvent } from "@/lib/calendar-events";
import { currentListPhaseId, type ListPhaseId } from "@/lib/list-phases";
import { OWNERS, isOwner, type Owner } from "@/lib/types";

export const FAMILY_MEETING_KIND = "family_meeting" as const;
export type TodoKind = "normal" | typeof FAMILY_MEETING_KIND;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EXPLORATION_START = "2026-09-01";
const EXPLORATION_END = "2026-12-31";
const WEEKLY_START = "2027-01-01";
const FEED_MONTHS = 18;

export function isTodoKind(value: unknown): value is TodoKind {
  return value === "normal" || value === FAMILY_MEETING_KIND;
}

export function isFamilyMeetingKind(value: unknown): boolean {
  return value === FAMILY_MEETING_KIND;
}

export function normalizeDoneBy(raw: unknown): Owner[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<Owner>();
  for (const value of raw) {
    if (typeof value === "string" && isOwner(value)) seen.add(value);
  }
  return OWNERS.map((owner) => owner.id).filter((id) => seen.has(id));
}

export function familyMeetingFullyDone(doneBy: readonly Owner[]): boolean {
  return OWNERS.every((owner) => doneBy.includes(owner.id));
}

export function toggleFamilyMeetingAck(
  doneBy: readonly Owner[],
  viewer: Owner,
  checked: boolean,
): Owner[] {
  const next = new Set(normalizeDoneBy(doneBy));
  if (checked) next.add(viewer);
  else next.delete(viewer);
  return OWNERS.map((owner) => owner.id).filter((id) => next.has(id));
}

export function isoDay(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function localFromIso(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDaysIso(iso: string, days: number): string {
  const date = localFromIso(iso);
  date.setDate(date.getDate() + days);
  return isoDay(date);
}

/** First Sunday on or after the given local day. */
export function sundayOnOrAfter(iso: string): string {
  const date = localFromIso(iso);
  const offset = (7 - date.getDay()) % 7;
  date.setDate(date.getDate() + offset);
  return isoDay(date);
}

export function familyMeetingIntervalDays(phase: ListPhaseId): 7 | 14 {
  return phase === "exploration" ? 14 : 7;
}

export function familyMeetingCadenceLabel(phase: ListPhaseId): string {
  return phase === "exploration" ? "every two weeks" : "weekly";
}

/**
 * Sundays: every 14 days in Exploration (from 6 Sep 2026), then weekly
 * from the first Sunday of Consideration (3 Jan 2027) through Applications.
 */
export function familyMeetingDates(fromIso: string, toIso: string): string[] {
  if (!ISO_DATE.test(fromIso) || !ISO_DATE.test(toIso) || fromIso > toIso) return [];
  const out: string[] = [];

  let biweekly = sundayOnOrAfter(EXPLORATION_START);
  while (biweekly <= EXPLORATION_END && biweekly <= toIso) {
    if (biweekly >= fromIso) out.push(biweekly);
    biweekly = addDaysIso(biweekly, 14);
  }

  let weekly = sundayOnOrAfter(WEEKLY_START);
  while (weekly <= toIso) {
    if (weekly >= fromIso) out.push(weekly);
    weekly = addDaysIso(weekly, 7);
  }

  return out;
}

export function isFamilyMeetingDate(iso: string): boolean {
  if (!ISO_DATE.test(iso)) return false;
  return familyMeetingDates(iso, iso).includes(iso);
}

/** Today if today is a meeting Sunday; otherwise the next one. */
export function nextFamilyMeetingDate(now: Date = new Date()): string {
  const today = isoDay(now);
  const dates = familyMeetingDates(today, addDaysIso(today, 21));
  return dates[0] ?? sundayOnOrAfter(today);
}

export function familyMeetingPhaseForDate(iso: string): ListPhaseId {
  return currentListPhaseId(localFromIso(iso));
}

export type FamilyMeetingOccurrence = {
  id: string;
  date: string;
  title: string;
  cadence: "weekly" | "biweekly";
  phase: ListPhaseId;
};

export function familyMeetingOccurrence(date: string): FamilyMeetingOccurrence {
  const phase = familyMeetingPhaseForDate(date);
  return {
    id: `family-meeting-${date}`,
    date,
    title: "Family meeting",
    cadence: phase === "exploration" ? "biweekly" : "weekly",
    phase,
  };
}

export function familyMeetingsInMonth(year: number, monthIndex: number): FamilyMeetingOccurrence[] {
  const start = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const endDate = new Date(year, monthIndex + 1, 0);
  const end = isoDay(endDate);
  return familyMeetingDates(start, end).map(familyMeetingOccurrence);
}

export type FamilyAgendaItem = {
  id: string;
  label: string;
  doneBy: Owner[];
  done: boolean;
};

/**
 * Open items sit on the next upcoming meeting. Fully done items stay on the
 * meeting date stamped as their due date.
 */
export function agendaForMeetingDate<T extends FamilyAgendaItem>(
  date: string,
  items: T[],
  now: Date = new Date(),
): T[] {
  const next = nextFamilyMeetingDate(now);
  return items.filter((item) => {
    if (!item.done) return date === next;
    return false;
  });
}

export function familyMeetingCalendarEvents(
  now: Date = new Date(),
  months = FEED_MONTHS,
): CalendarEvent[] {
  const start = addDaysIso(isoDay(now), -30);
  const endDate = new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
  const end = isoDay(endDate);
  return familyMeetingDates(start, end).map((date) => {
    const occurrence = familyMeetingOccurrence(date);
    const phase = occurrence.phase;
    const cadence = familyMeetingCadenceLabel(phase);
    return {
      id: occurrence.id,
      title: occurrence.title,
      date,
      startTime: null,
      endTime: null,
      notes: `${phase === "exploration" ? "Exploration" : phase === "consideration" ? "Consideration" : "Applications"} · ${cadence}`,
      createdAt: `${date}T12:00:00.000Z`,
      createdBy: "jason" as Owner,
      sourceId: null,
      assetUrl: null,
      assetPath: null,
      schoolId: null,
      sourceNoteId: null,
    };
  });
}
