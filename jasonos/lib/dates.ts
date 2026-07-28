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
