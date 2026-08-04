// Upsert Google Calendar events into jasonos.meetings for the contact Meetings tab.
// Kept out of the "use server" meetings module so outreach-sync can call it
// without a server-action ↔ server-action import.

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

type MeetingStatus = "scheduled" | "held" | "cancelled";

export interface CalendarMeetingUpsert {
  contactId: string;
  gcalEventId: string;
  scheduledAt: string;
  title: string | null;
  calendarUrl: string | null;
  status: MeetingStatus;
}

export interface UpsertCalendarMeetingsResult {
  inserted: number;
  updated: number;
  errors: string[];
}

/**
 * Upsert Google Calendar events onto jasonos.meetings so they appear in the
 * contact Meetings tab. Dedupes on (contact_id, gcal_event_id). Does not
 * clobber prep/debrief fields the user already filled in.
 */
export async function upsertMeetingsFromCalendar(
  rows: CalendarMeetingUpsert[]
): Promise<UpsertCalendarMeetingsResult> {
  const result: UpsertCalendarMeetingsResult = {
    inserted: 0,
    updated: 0,
    errors: [],
  };
  if (!rows.length) return result;
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return result;
  }

  const sb = createServiceRoleClient();
  const eventIds = Array.from(new Set(rows.map((r) => r.gcalEventId)));
  const contactIds = Array.from(new Set(rows.map((r) => r.contactId)));

  const { data: existingRows, error: preErr } = await sb
    .from("meetings")
    .select(
      "id,contact_id,gcal_event_id,status,debrief_notes,prep_goal,prep_notes,title"
    )
    .in("gcal_event_id", eventIds)
    .in("contact_id", contactIds);

  if (preErr) {
    result.errors.push(`pre-check: ${preErr.message}`);
    return result;
  }

  const existingByKey = new Map<string, Record<string, unknown>>();
  for (const row of existingRows ?? []) {
    const cid = row.contact_id as string;
    const gid = row.gcal_event_id as string | null;
    if (cid && gid) existingByKey.set(`${cid}::${gid}`, row);
  }

  const nowIso = new Date().toISOString();
  const toInsert: Record<string, unknown>[] = [];

  for (const row of rows) {
    const key = `${row.contactId}::${row.gcalEventId}`;
    const existing = existingByKey.get(key);
    if (!existing) {
      toInsert.push({
        contact_id: row.contactId,
        scheduled_at: row.scheduledAt,
        channel: "video",
        status: row.status,
        title: row.title,
        calendar_url: row.calendarUrl,
        gcal_event_id: row.gcalEventId,
        prep_goal: row.title,
        held_at: row.status === "held" ? row.scheduledAt : null,
        updated_at: nowIso,
      });
      continue;
    }

    const payload: Record<string, unknown> = {
      scheduled_at: row.scheduledAt,
      calendar_url: row.calendarUrl,
      updated_at: nowIso,
    };
    if (row.title) {
      payload.title = row.title;
      if (!(existing.prep_goal as string | null)) {
        payload.prep_goal = row.title;
      }
    }

    const existingStatus = (existing.status as MeetingStatus) ?? "scheduled";
    if (existingStatus === "scheduled" && row.status === "held") {
      payload.status = "held";
      payload.held_at = row.scheduledAt;
    } else if (row.status === "cancelled" && existingStatus !== "held") {
      payload.status = "cancelled";
    }

    const { error: updErr } = await sb
      .from("meetings")
      .update(payload)
      .eq("id", existing.id as string);
    if (updErr) {
      result.errors.push(`update ${key}: ${updErr.message}`);
    } else {
      result.updated += 1;
    }
  }

  if (toInsert.length) {
    const { data, error } = await sb.from("meetings").insert(toInsert).select("id");
    if (error) {
      result.errors.push(`insert: ${error.message}`);
    } else {
      result.inserted += data?.length ?? 0;
    }
  }

  return result;
}
