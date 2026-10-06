// Shared date helpers. The app operates in Jason's timezone (Eastern), but
// timestamps are stored in UTC — so deriving a calendar day must convert to ET,
// otherwise a late-evening ET action rolls onto the next UTC day (e.g. an email
// sent 9pm ET shows as "tomorrow"). Use these anywhere a stored timestamp is
// turned into a day, or "today" is needed as a day.

export const APP_TZ = "America/New_York";

/** A timestamp (ISO string / ms / Date) → its Eastern calendar day, "YYYY-MM-DD". */
export function etYmd(input: string | number | Date = new Date()): string {
  return new Date(input).toLocaleDateString("en-CA", { timeZone: APP_TZ });
}

/** Today's Eastern calendar day, "YYYY-MM-DD". */
export function etToday(): string {
  return etYmd(new Date());
}

/**
 * Coming Friday (inclusive) for a YYYY-MM-DD calendar day. Weekend → next
 * Friday. Pure date-math (UTC noon) so Home / Queue / Drift agree regardless
 * of the server's local timezone.
 */
export function etEndOfWorkWeekYmd(todayYmd: string = etToday()): string {
  const [y, m, d] = todayYmd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const daysUntilFriday = (5 - dt.getUTCDay() + 7) % 7; // Fri = 5
  dt.setUTCDate(dt.getUTCDate() + daysUntilFriday);
  return dt.toISOString().slice(0, 10);
}

/** Whole calendar days between two YYYY-MM-DD strings (non-negative). */
export function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T12:00:00Z`);
  const b = Date.parse(`${toYmd}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Add (or subtract) whole calendar days to a YYYY-MM-DD string. */
export function addDaysYmd(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Universal JasonOS reporting week: Monday → Sunday.
 * Returns the Monday on or before `dateStr` (YYYY-MM-DD).
 */
export function mondayStartOfWeekYmd(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7; // Mon = 0 … Sun = 6
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

/** Monday–Sunday range containing `dateStr`. */
export function weekRangeMonSun(dateStr: string): { start: string; end: string } {
  const start = mondayStartOfWeekYmd(dateStr);
  return { start, end: addDaysYmd(start, 6) };
}

/**
 * Human label for a Mon–Sun week, e.g. "Monday 30 March – Sunday 5 April 2026".
 * Pass the Monday as weekStart and Sunday as weekEnd.
 */
export function formatMonSunWeekLabel(weekStart: string, weekEnd: string): string {
  const s = new Date(`${weekStart}T12:00:00Z`);
  const e = new Date(`${weekEnd}T12:00:00Z`);
  const sMonth = s.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const eMonth = e.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const sDay = s.getUTCDate();
  const eDay = e.getUTCDate();
  const sYear = s.getUTCFullYear();
  const eYear = e.getUTCFullYear();
  if (sMonth === eMonth && sYear === eYear) {
    return `Monday ${sDay} \u2013 Sunday ${eDay} ${eMonth} ${eYear}`;
  }
  if (sYear === eYear) {
    return `Monday ${sDay} ${sMonth} \u2013 Sunday ${eDay} ${eMonth} ${eYear}`;
  }
  return `Monday ${sDay} ${sMonth} ${sYear} \u2013 Sunday ${eDay} ${eMonth} ${eYear}`;
}

/**
 * Gmail `after:` needs YYYY/MM/DD. A unix timestamp is ignored or misread,
 * so Sent mail from this week never matches.
 */
export function gmailAfterSlashDate(
  daysBack: number,
  now: Date = new Date()
): string {
  const ms = now.getTime() - Math.max(1, daysBack) * 86_400_000;
  return etYmd(ms).replace(/-/g, "/");
}
