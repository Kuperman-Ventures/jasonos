const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function parseIsoDate(iso: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`Bad date ${iso}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** Weekday of the calendar date. 0 is Sunday. Independent of the server timezone. */
export function weekdayIndex(iso: string): number {
  const { y, m, d } = parseIsoDate(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isSaturday(iso: string): boolean {
  return weekdayIndex(iso) === 6;
}

export function addCalendarDays(iso: string, days: number): string {
  const { y, m, d } = parseIsoDate(iso);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  const month = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc.getUTCDate()).padStart(2, "0");
  return `${utc.getUTCFullYear()}-${month}-${day}`;
}

export function todayInNewYork(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}

export function formatPlainDate(iso: string): string {
  const { m, d } = parseIsoDate(iso);
  const month = MONTHS[m - 1] ?? "";
  return `${WEEKDAYS[weekdayIndex(iso)]} ${month} ${d}`;
}

export function formatPillDate(iso: string): string {
  const { d } = parseIsoDate(iso);
  return `${WEEKDAYS[weekdayIndex(iso)]} ${d}`;
}
