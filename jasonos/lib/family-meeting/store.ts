/**
 * Family Meeting editor persistence. Service-role / MCP-safe (no Next cookies).
 */
import { jasonosDb } from "@/lib/mcp/db";
import type {
  FamilyMeetingEdits,
  OccurrenceEdit,
  PresentationOverride,
  SeriesEdit,
} from "./edits";
import { dayKeyForEvent, todayKeyEt } from "./keys";
import type { FamilyMeetingEvent } from "./types";
import {
  FAMILY_MEETING_LOOKAHEAD_DAYS,
  FAMILY_MEETING_TIMEZONE,
  upcomingAgendaWindow,
  zonedLocalDate,
} from "./weekend";

function fail(error: { message: string }): never {
  throw new Error(error.message);
}

function ymdParts(dayKey: string): { year: number; month: number; day: number } {
  const [ys, ms, ds] = dayKey.split("-").map(Number);
  return { year: ys!, month: ms!, day: ds! };
}

function addDaysKey(dayKey: string, delta: number): string {
  const { year, month, day } = ymdParts(dayKey);
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-${String(utc.getUTCDate()).padStart(2, "0")}`;
}

/** Ensure open day blocks for the rolling two-week window; log past days. */
export async function syncFamilyMeetingDayBlocks(
  now: Date = new Date()
): Promise<{ today: string; openDays: string[]; loggedCount: number }> {
  const today = todayKeyEt(now);
  const window = upcomingAgendaWindow(now);
  const openDays: string[] = [];
  for (let i = 0; i < FAMILY_MEETING_LOOKAHEAD_DAYS; i++) {
    openDays.push(addDaysKey(window.startKey, i));
  }

  const db = jasonosDb();
  const rows = openDays.map((day_key) => ({
    day_key,
    status: "open" as const,
  }));
  const { error: upsertError } = await db
    .from("family_meeting_day_blocks")
    .upsert(rows, { onConflict: "day_key", ignoreDuplicates: false });
  if (upsertError) fail(upsertError);

  // Past open days → logged (after 11:59pm ET = once local date has moved on).
  const { data: pastOpen, error: pastError } = await db
    .from("family_meeting_day_blocks")
    .select("day_key")
    .eq("status", "open")
    .lt("day_key", today);
  if (pastError) fail(pastError);

  let loggedCount = 0;
  if (pastOpen?.length) {
    const { error: logError } = await db
      .from("family_meeting_day_blocks")
      .update({ status: "logged", logged_at: now.toISOString() })
      .in(
        "day_key",
        pastOpen.map((r) => r.day_key as string)
      );
    if (logError) fail(logError);
    loggedCount = pastOpen.length;
  }

  // Keep window days marked open even if previously logged somehow.
  const { error: reopenError } = await db
    .from("family_meeting_day_blocks")
    .update({ status: "open", logged_at: null })
    .in("day_key", openDays)
    .eq("status", "logged");
  if (reopenError) fail(reopenError);

  return { today, openDays, loggedCount };
}

export async function loadFamilyMeetingEdits(): Promise<FamilyMeetingEdits> {
  const db = jasonosDb();
  const [occ, ser] = await Promise.all([
    db
      .from("family_meeting_occurrence_edits")
      .select(
        "occurrence_key,series_key,group_id,day_key,title,starts_at,hidden,presentation"
      ),
    db
      .from("family_meeting_series_edits")
      .select("series_key,title,archived"),
  ]);
  if (occ.error) fail(occ.error);
  if (ser.error) fail(ser.error);
  return {
    occurrences: (occ.data ?? []) as OccurrenceEdit[],
    series: (ser.data ?? []) as SeriesEdit[],
  };
}

async function ensureDay(dayKey: string): Promise<void> {
  const { error } = await jasonosDb()
    .from("family_meeting_day_blocks")
    .upsert({ day_key: dayKey, status: "open" }, { onConflict: "day_key" });
  if (error) fail(error);
}

export async function upsertOccurrenceEdit(input: {
  event: FamilyMeetingEvent;
  hidden?: boolean;
  presentation?: PresentationOverride;
}): Promise<void> {
  const ev = input.event;
  const occurrence_key = ev.occurrenceKey!;
  const series_key = ev.seriesKey!;
  const day_key = ev.dayKey ?? dayKeyForEvent(ev.startsAt);
  await ensureDay(day_key);

  const db = jasonosDb();
  const { data: existing } = await db
    .from("family_meeting_occurrence_edits")
    .select("hidden,presentation")
    .eq("occurrence_key", occurrence_key)
    .maybeSingle();

  const row = {
    occurrence_key,
    series_key,
    group_id: ev.groupId,
    day_key,
    title: ev.title,
    starts_at: ev.startsAt,
    hidden: input.hidden ?? Boolean(existing?.hidden),
    presentation:
      input.presentation ??
      ((existing?.presentation as PresentationOverride | undefined) ?? "auto"),
  };

  const { error } = await db
    .from("family_meeting_occurrence_edits")
    .upsert(row, { onConflict: "occurrence_key" });
  if (error) fail(error);
}

/** Hide every known occurrence of a series in the current window + mark series archived. */
export async function archiveSeries(input: {
  seriesKey: string;
  title: string;
  events: FamilyMeetingEvent[];
}): Promise<void> {
  const db = jasonosDb();
  const { error: seriesError } = await db
    .from("family_meeting_series_edits")
    .upsert(
      {
        series_key: input.seriesKey,
        title: input.title,
        archived: true,
      },
      { onConflict: "series_key" }
    );
  if (seriesError) fail(seriesError);

  for (const ev of input.events) {
    if (ev.seriesKey !== input.seriesKey) continue;
    await upsertOccurrenceEdit({ event: ev, hidden: true });
  }
}

export async function unarchiveSeries(seriesKey: string): Promise<void> {
  const db = jasonosDb();
  const { error } = await db
    .from("family_meeting_series_edits")
    .upsert(
      { series_key: seriesKey, title: "", archived: false },
      { onConflict: "series_key" }
    );
  if (error) fail(error);
}

/** Promote/demote every occurrence of a series currently in the provided event list. */
export async function setSeriesPresentation(input: {
  seriesKey: string;
  presentation: PresentationOverride;
  events: FamilyMeetingEvent[];
}): Promise<void> {
  for (const ev of input.events) {
    if (ev.seriesKey !== input.seriesKey) continue;
    await upsertOccurrenceEdit({
      event: ev,
      presentation: input.presentation,
    });
  }
}

/** Friday 11:59pm ET freeze label for the print pack (week-ahead). Wireframe only for now. */
export function printFreezeLabel(now: Date = new Date()): {
  freezeFridayKey: string;
  freezeAtLabel: string;
} {
  const today = todayKeyEt(now);
  const { year, month, day } = ymdParts(today);
  const noon = zonedLocalDate(FAMILY_MEETING_TIMEZONE, year, month, day, 12, 0);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: FAMILY_MEETING_TIMEZONE,
    weekday: "short",
  }).format(noon);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dow = map[weekday] ?? 0;
  // This Friday if still Friday; otherwise the upcoming Friday.
  const friDelta = dow === 5 ? 0 : dow === 6 ? 6 : 5 - dow;
  const freezeFridayKey = addDaysKey(today, friDelta);
  return {
    freezeFridayKey,
    freezeAtLabel: `Fri ${freezeFridayKey} · 11:59pm ET`,
  };
}
