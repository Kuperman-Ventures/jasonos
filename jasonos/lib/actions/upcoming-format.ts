/**
 * Waiting-list labels for Settings → Action Log.
 * SCHEDULED_TZ must stay the same as APP_TZ in lib/dates.ts.
 */

export const SCHEDULED_TZ = "America/New_York";

export interface UpcomingItem {
  id: string;
  /** Eastern calendar day the item comes back, or null when no day was stored. */
  dueOn: string | null;
  area: string;
  subject: string;
  detail: string | null;
  href: string | null;
}

export interface UpcomingGroup {
  key: string;
  label: string;
  rows: UpcomingItem[];
}

/**
 * A stored date or timestamp → YYYY-MM-DD.
 * Date-only values and midnight UTC stay on that calendar day. A real
 * timestamp is converted to Eastern.
 */
export function scheduledDay(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const dateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
  if (dateOnly) return dateOnly[1];
  const midnight = /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.0+)?(?:Z|\+00:00)?$/.exec(trimmed);
  if (midnight) return midnight[1];
  const t = Date.parse(trimmed);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString("en-CA", { timeZone: SCHEDULED_TZ });
}

function nextYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

function daysLate(dueOn: string, today: string): number {
  const a = Date.parse(`${dueOn}T12:00:00Z`);
  const b = Date.parse(`${today}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function longDay(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  return new Date(Date.UTC(y, m - 1, d, 16)).toLocaleDateString("en-US", {
    timeZone: SCHEDULED_TZ,
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function upcomingGroupKey(dueOn: string | null, today: string): string {
  if (!dueOn) return "none";
  if (dueOn < today) return "overdue";
  return dueOn;
}

export function upcomingGroupLabel(dueOn: string | null, today: string): string {
  if (!dueOn) return "No date";
  if (dueOn < today) return "Overdue";
  if (dueOn === today) return "Today";
  if (dueOn === nextYmd(today)) return "Tomorrow";
  return longDay(dueOn);
}

/** Short line on the row itself, so an overdue item still shows its day. */
export function upcomingRowWhen(dueOn: string | null, today: string): string {
  if (!dueOn) return "No date";
  if (dueOn < today) {
    const late = daysLate(dueOn, today);
    const unit = late === 1 ? "day" : "days";
    return `${late} ${unit} overdue`;
  }
  if (dueOn === today) return "Today";
  if (dueOn === nextYmd(today)) return "Tomorrow";
  return longDay(dueOn);
}

export function compareUpcoming(a: UpcomingItem, b: UpcomingItem): number {
  const ad = a.dueOn ?? "9999-99-99";
  const bd = b.dueOn ?? "9999-99-99";
  if (ad !== bd) return ad < bd ? -1 : 1;
  return a.area.localeCompare(b.area) || a.subject.localeCompare(b.subject);
}

export function groupUpcoming(items: readonly UpcomingItem[], today: string): UpcomingGroup[] {
  const sorted = [...items].sort(compareUpcoming);
  const order: string[] = [];
  const byKey = new Map<string, UpcomingItem[]>();
  for (const item of sorted) {
    const key = upcomingGroupKey(item.dueOn, today);
    const list = byKey.get(key);
    if (list) list.push(item);
    else {
      byKey.set(key, [item]);
      order.push(key);
    }
  }
  return order.map((key) => {
    const rows = byKey.get(key) ?? [];
    return {
      key,
      label: upcomingGroupLabel(rows[0]?.dueOn ?? null, today),
      rows,
    };
  });
}

export function upcomingHaystack(item: UpcomingItem, today: string): string {
  return [item.area, item.subject, item.detail ?? "", upcomingRowWhen(item.dueOn, today)]
    .join(" ")
    .toLowerCase();
}
