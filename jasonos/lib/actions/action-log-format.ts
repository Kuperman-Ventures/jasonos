/**
 * Plain-language labels for Settings → Action Log.
 * ACTION_LOG_TZ must stay the same as APP_TZ in lib/dates.ts.
 */

export const ACTION_LOG_TZ = "America/New_York";

export interface ActionLogRow {
  id: string;
  acted_at: string;
  verb: string;
  area: string;
  subject: string;
  detail: string | null;
  actor: string;
}

const CADENCE_WORDS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  triweekly: "Every 3 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  none: "No cadence",
};

export function cadenceWords(interval: string): string {
  return CADENCE_WORDS[interval] ?? interval;
}

/** Eastern calendar day for a stored timestamp, "YYYY-MM-DD". */
export function actionLogDayKey(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString("en-CA", { timeZone: ACTION_LOG_TZ });
}

export function actionLogDayLabel(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleDateString("en-US", {
    timeZone: ACTION_LOG_TZ,
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function actionLogTimeLabel(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleTimeString("en-US", {
    timeZone: ACTION_LOG_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

/** A YYYY-MM-DD calendar day, shown as "Fri, Oct 30". No timezone shift. */
export function formatCalendarDay(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  return new Date(Date.UTC(y, m - 1, d, 16)).toLocaleDateString("en-US", {
    timeZone: ACTION_LOG_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatInstantDay(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleDateString("en-US", {
    timeZone: ACTION_LOG_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function snoozeDetail(days: number, untilYmd: string): string {
  const unit = days === 1 ? "day" : "days";
  return `${days} ${unit} · back ${formatCalendarDay(untilYmd)}`;
}

export function followUpDetail(days: number, dueYmd: string): string {
  const unit = days === 1 ? "day" : "days";
  return `${days} ${unit} · due ${formatCalendarDay(dueYmd)}`;
}

/** "until Fri, Oct 30" from either a calendar day or an instant. */
export function untilDetail(raw: string): string {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `until ${formatCalendarDay(value)}`;
  return `until ${formatInstantDay(value)}`;
}

export function actionLogHaystack(row: ActionLogRow): string {
  return [row.verb, row.area, row.subject, row.detail ?? "", row.actor]
    .join(" ")
    .toLowerCase();
}
