import {
  CHRISTMAS_BREAK,
  EPIC_LOCAL_BLACKOUT_RANGES,
  type PassStanding,
} from "@/config/christmas";
import { addCalendarDays, formatPlainDate } from "@/lib/scoring/calendar";

export function eachDate(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    const next = addCalendarDays(cursor, 1);
    if (next === cursor) break;
    cursor = next;
  }
  return dates;
}

export function epicLocalBlackoutDates(): string[] {
  const dates: string[] = [];
  for (const range of EPIC_LOCAL_BLACKOUT_RANGES) {
    dates.push(...eachDate(range.start, range.end));
  }
  return dates;
}

export function christmasBreakDates(): string[] {
  return eachDate(CHRISTMAS_BREAK.start, CHRISTMAS_BREAK.end);
}

export function blackoutDatesInBreak(): string[] {
  const blocked = new Set(epicLocalBlackoutDates());
  return christmasBreakDates().filter((date) => blocked.has(date));
}

export function countPassDays(standing: PassStanding): { open: number; total: number } {
  const total = christmasBreakDates().length;
  if (standing === "off-pass") return { open: 0, total };
  if (standing === "open") return { open: total, total };
  const blocked = new Set(blackoutDatesInBreak());
  return { open: total - blocked.size, total };
}

export function passLabel(standing: PassStanding): string {
  const { open, total } = countPassDays(standing);
  if (standing === "off-pass") return "Not on the pass";
  if (standing === "open") return `All ${total} days`;
  return `${open} of ${total} days, blocked Dec 26-31`;
}

export function plainDate(iso: string): string {
  return formatPlainDate(iso);
}
