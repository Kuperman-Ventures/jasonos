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
import type { FamilyMeetingIconId } from "./icons";
import { dayKeyForEvent, todayKeyEt } from "./keys";
import type { FamilyMeetingPrintPackPayload } from "./print-pack";
import { freezeFridayKeyFor } from "./print-window";
import type { FamilyMeetingEvent } from "./types";
import {
  FAMILY_MEETING_LOOKAHEAD_DAYS,
  upcomingAgendaWindow,
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
      .select("series_key,title,archived,icon_id"),
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

async function readSeriesRow(seriesKey: string): Promise<{
  title: string;
  archived: boolean;
  icon_id: string | null;
} | null> {
  const { data, error } = await jasonosDb()
    .from("family_meeting_series_edits")
    .select("title,archived,icon_id")
    .eq("series_key", seriesKey)
    .maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  return {
    title: (data.title as string) ?? "",
    archived: Boolean(data.archived),
    icon_id: (data.icon_id as string | null) ?? null,
  };
}

/** Hide every known occurrence of a series in the current window + mark series archived. */
export async function archiveSeries(input: {
  seriesKey: string;
  title: string;
  events: FamilyMeetingEvent[];
}): Promise<void> {
  const db = jasonosDb();
  const existing = await readSeriesRow(input.seriesKey);
  const { error: seriesError } = await db
    .from("family_meeting_series_edits")
    .upsert(
      {
        series_key: input.seriesKey,
        title: input.title,
        archived: true,
        icon_id: existing?.icon_id ?? null,
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
  const existing = await readSeriesRow(seriesKey);
  const { error } = await db
    .from("family_meeting_series_edits")
    .upsert(
      {
        series_key: seriesKey,
        title: existing?.title ?? "",
        archived: false,
        icon_id: existing?.icon_id ?? null,
      },
      { onConflict: "series_key" }
    );
  if (error) fail(error);
  // Clear occurrence hides that archive applied for this series.
  const { error: hideError } = await db
    .from("family_meeting_occurrence_edits")
    .update({ hidden: false })
    .eq("series_key", seriesKey);
  if (hideError) fail(hideError);
}

/** Set or clear (null) the icon override for a series. */
export async function setSeriesIcon(input: {
  seriesKey: string;
  title: string;
  iconId: FamilyMeetingIconId | null;
}): Promise<void> {
  const db = jasonosDb();
  const existing = await readSeriesRow(input.seriesKey);
  const { error } = await db.from("family_meeting_series_edits").upsert(
    {
      series_key: input.seriesKey,
      title: input.title || existing?.title || "",
      archived: existing?.archived ?? false,
      icon_id: input.iconId,
    },
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

/** Friday 11:59pm ET freeze label for the print pack. */
export function printFreezeLabel(now: Date = new Date()): {
  freezeFridayKey: string;
  freezeAtLabel: string;
} {
  const freezeFridayKey = freezeFridayKeyFor(now);
  return {
    freezeFridayKey,
    freezeAtLabel: `Fri ${freezeFridayKey} · 11:59pm ET`,
  };
}

export async function listHiddenOccurrences(): Promise<OccurrenceEdit[]> {
  const { data, error } = await jasonosDb()
    .from("family_meeting_occurrence_edits")
    .select(
      "occurrence_key,series_key,group_id,day_key,title,starts_at,hidden,presentation"
    )
    .eq("hidden", true)
    .order("starts_at", { ascending: true });
  if (error) fail(error);
  return (data ?? []) as OccurrenceEdit[];
}

export async function listArchivedSeries(): Promise<SeriesEdit[]> {
  const { data, error } = await jasonosDb()
    .from("family_meeting_series_edits")
    .select("series_key,title,archived,icon_id")
    .eq("archived", true)
    .order("title", { ascending: true });
  if (error) fail(error);
  return (data ?? []) as SeriesEdit[];
}

export async function unhideOccurrenceKey(occurrenceKey: string): Promise<void> {
  const { error } = await jasonosDb()
    .from("family_meeting_occurrence_edits")
    .update({ hidden: false })
    .eq("occurrence_key", occurrenceKey);
  if (error) fail(error);
}

export async function savePrintPack(input: {
  freezeFriday: string;
  payload: FamilyMeetingPrintPackPayload;
}): Promise<{ id: string; created: boolean }> {
  const db = jasonosDb();
  const { data: existing } = await db
    .from("family_meeting_print_packs")
    .select("id")
    .eq("freeze_friday", input.freezeFriday)
    .maybeSingle();
  if (existing?.id) {
    const { error } = await db
      .from("family_meeting_print_packs")
      .update({
        range_start: input.payload.rangeStart,
        range_end: input.payload.rangeEnd,
        label: input.payload.label,
        payload: input.payload,
      })
      .eq("id", existing.id);
    if (error) fail(error);
    return { id: existing.id as string, created: false };
  }
  const { data, error } = await db
    .from("family_meeting_print_packs")
    .insert({
      freeze_friday: input.freezeFriday,
      range_start: input.payload.rangeStart,
      range_end: input.payload.rangeEnd,
      label: input.payload.label,
      payload: input.payload,
    })
    .select("id")
    .single();
  if (error) fail(error);
  return { id: data.id as string, created: true };
}

export async function getLatestPrintPack(): Promise<{
  id: string;
  freeze_friday: string;
  label: string;
  payload: FamilyMeetingPrintPackPayload;
} | null> {
  const { data, error } = await jasonosDb()
    .from("family_meeting_print_packs")
    .select("id,freeze_friday,label,payload")
    .order("freeze_friday", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  return {
    id: data.id as string,
    freeze_friday: data.freeze_friday as string,
    label: data.label as string,
    payload: data.payload as FamilyMeetingPrintPackPayload,
  };
}

export async function getPrintPackById(id: string): Promise<{
  id: string;
  freeze_friday: string;
  label: string;
  payload: FamilyMeetingPrintPackPayload;
} | null> {
  const { data, error } = await jasonosDb()
    .from("family_meeting_print_packs")
    .select("id,freeze_friday,label,payload")
    .eq("id", id)
    .maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  return {
    id: data.id as string,
    freeze_friday: data.freeze_friday as string,
    label: data.label as string,
    payload: data.payload as FamilyMeetingPrintPackPayload,
  };
}

export async function markPrintPackEmailed(id: string): Promise<void> {
  const { error } = await jasonosDb()
    .from("family_meeting_print_packs")
    .update({ emailed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) fail(error);
}
