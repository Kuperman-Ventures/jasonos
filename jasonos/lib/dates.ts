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
