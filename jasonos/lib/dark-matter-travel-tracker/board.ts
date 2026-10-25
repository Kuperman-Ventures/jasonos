import type { ItineraryItem, Trip } from "./types";

export function isUpcomingTrip(trip: Trip, today: string): boolean {
  if (trip.status === "done") return false;
  if (trip.status === "happening") return true;
  const end = trip.endDate ?? trip.startDate;
  if (!end) return true;
  return end >= today;
}

export function splitTrips(
  trips: Trip[],
  today: string
): { upcoming: Trip[]; past: Trip[] } {
  const upcoming: Trip[] = [];
  const past: Trip[] = [];
  for (const trip of trips) {
    if (isUpcomingTrip(trip, today)) upcoming.push(trip);
    else past.push(trip);
  }
  upcoming.sort(compareTrips);
  past.sort(compareTrips);
  return { upcoming, past };
}

function compareTrips(a: Trip, b: Trip): number {
  const aDate = a.startDate ?? a.endDate ?? "9999-12-31";
  const bDate = b.startDate ?? b.endDate ?? "9999-12-31";
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  return a.title.localeCompare(b.title);
}

export function sortItems(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => {
    const dayA = a.occursOn ?? "9999-12-31";
    const dayB = b.occursOn ?? "9999-12-31";
    if (dayA !== dayB) return dayA.localeCompare(dayB);
    const timeA = a.startTime ?? "99:99";
    const timeB = b.startTime ?? "99:99";
    if (timeA !== timeB) return timeA.localeCompare(timeB);
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title);
  });
}

export type DayGroup = {
  key: string;
  label: string;
  items: ItineraryItem[];
};

export function formatDayLabel(ymd: string): string {
  const date = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return ymd;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatTripDates(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return "Dates TBD";
  if (startDate && endDate && startDate === endDate) return formatDayLabel(startDate);
  if (startDate && endDate) {
    const start = new Date(`${startDate}T12:00:00Z`);
    const end = new Date(`${endDate}T12:00:00Z`);
    const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
    const startLabel = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: sameYear ? undefined : "numeric",
      timeZone: "UTC",
    }).format(start);
    const endLabel = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(end);
    return `${startLabel} – ${endLabel}`;
  }
  return formatDayLabel(startDate ?? endDate ?? "");
}

export function formatClock(startTime: string | null): string | null {
  if (!startTime) return null;
  const [hours, minutes] = startTime.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return startTime;
  const date = new Date(Date.UTC(2020, 0, 1, hours, minutes));
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function groupItemsByDay(items: ItineraryItem[]): DayGroup[] {
  const sorted = sortItems(items);
  const groups = new Map<string, ItineraryItem[]>();
  const unscheduled: ItineraryItem[] = [];
  for (const item of sorted) {
    if (!item.occursOn) {
      unscheduled.push(item);
      continue;
    }
    const list = groups.get(item.occursOn) ?? [];
    list.push(item);
    groups.set(item.occursOn, list);
  }
  const days: DayGroup[] = [...groups.entries()].map(([key, dayItems]) => ({
    key,
    label: formatDayLabel(key),
    items: dayItems,
  }));
  if (unscheduled.length) {
    days.push({
      key: "unscheduled",
      label: "Not on a day yet",
      items: unscheduled,
    });
  }
  return days;
}

export const STATUS_LABELS: Record<Trip["status"], string> = {
  idea: "Idea",
  planning: "Planning",
  booked: "Booked",
  happening: "On the trip",
  done: "Done",
};

export const KIND_LABELS: Record<ItineraryItem["kind"], string> = {
  flight: "Flight",
  stay: "Stay",
  transit: "Transit",
  activity: "Activity",
  meal: "Meal",
  note: "Note",
};
