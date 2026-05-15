// Shared helpers for capturing touches into jasonos.contact_touches.
// Used by the Gmail / Calendar / HubSpot sync flows AND by logContactTouch
// for manual entries. Auto-advances the contact's last_touch_date /
// next_touch_date based on cadence_interval so every captured touch closes
// the loop with the cadence system.

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { CADENCE_DAYS, type CadenceInterval } from "@/lib/outreach/types";

export type TouchChannel =
  | "email"
  | "calendar"
  | "linkedin"
  | "phone"
  | "in_person"
  | "other";

export type TouchDirection = "outbound" | "inbound";

export type TouchSource = "gmail" | "gcal" | "hubspot" | "manual" | "rr_legacy";

export interface ContactTouchInput {
  contact_id: string;
  channel: TouchChannel;
  direction: TouchDirection;
  touched_at: string; // ISO timestamp
  source: TouchSource;
  external_id?: string | null;
  brief?: string | null;
  subject?: string | null;
  thread_url?: string | null;
}

export interface InsertTouchesResult {
  inserted: number;
  duplicates: number;
  /** Map of contact_id → latest outbound touched_at we wrote for them. */
  cadenceUpdates: number;
  errors: string[];
}

/**
 * Insert a batch of touches into jasonos.contact_touches, dedupe on
 * (source, external_id), and auto-advance each touched contact's
 * last_touch_date + next_touch_date when a cadence_interval is set.
 *
 * Returns counts so callers can report sync results.
 */
export async function insertContactTouches(
  touches: ContactTouchInput[]
): Promise<InsertTouchesResult> {
  const client = createServiceRoleClient();
  const result: InsertTouchesResult = {
    inserted: 0,
    duplicates: 0,
    cadenceUpdates: 0,
    errors: [],
  };
  if (!touches.length) return result;

  // ---- Step 1: upsert into contact_touches (dedup on source, external_id)
  // We upsert in two batches: rows with an external_id (use ON CONFLICT) and
  // rows without (always insert). For the simple case we use a single upsert.

  const withDedup = touches.filter((t) => t.external_id);
  const noDedup = touches.filter((t) => !t.external_id);

  if (withDedup.length) {
    const { data, error } = await client
      .from("contact_touches")
      .upsert(withDedup, {
        onConflict: "source,external_id",
        ignoreDuplicates: true,
      })
      .select("id, contact_id");
    if (error) {
      result.errors.push(`upsert(dedup): ${error.message}`);
    } else {
      result.inserted += data?.length ?? 0;
      result.duplicates += withDedup.length - (data?.length ?? 0);
    }
  }

  if (noDedup.length) {
    const { data, error } = await client
      .from("contact_touches")
      .insert(noDedup)
      .select("id, contact_id");
    if (error) {
      result.errors.push(`insert(no-dedup): ${error.message}`);
    } else {
      result.inserted += data?.length ?? 0;
    }
  }

  if (!result.inserted) return result;

  // ---- Step 2: figure out which contacts had a NEW touch (latest per
  // contact) so we advance their cadence.
  // We rely on the inserted rows; for duplicates we don't re-advance.

  // Build map: contact_id -> latest touched_at among rows we just inserted
  const latestByContact = new Map<string, string>();
  for (const t of touches) {
    const prev = latestByContact.get(t.contact_id);
    if (!prev || prev < t.touched_at) {
      latestByContact.set(t.contact_id, t.touched_at);
    }
  }

  // ---- Step 3: pull current cadence_interval per contact, then update
  // last_touch_date / last_touch_channel / next_touch_date in one update
  // statement per contact (small batches usually, <10 contacts).

  const contactIds = Array.from(latestByContact.keys());
  if (!contactIds.length) return result;

  const { data: contactRows, error: readErr } = await client
    .from("contacts")
    .select("id, cadence_interval, last_touch_date")
    .in("id", contactIds);

  if (readErr) {
    result.errors.push(`read contacts: ${readErr.message}`);
    return result;
  }

  await Promise.all(
    (contactRows ?? []).map(async (row) => {
      const newest = latestByContact.get(row.id as string);
      if (!newest) return;
      const newestDate = newest.split("T")[0];
      const existingLast = (row.last_touch_date as string | null) ?? null;
      // Only advance if this touch is newer than what's already stamped.
      if (existingLast && existingLast >= newestDate) return;

      const cadence =
        (row.cadence_interval as CadenceInterval | null) ?? "none";

      // Pick the channel from the latest touch we wrote for this contact.
      const latestTouch = touches
        .filter((t) => t.contact_id === row.id)
        .reduce<ContactTouchInput | null>((acc, cur) => {
          if (!acc || acc.touched_at < cur.touched_at) return cur;
          return acc;
        }, null);

      const updatePayload: Record<string, unknown> = {
        last_touch_date: newestDate,
        last_touch_channel: latestTouch?.channel ?? null,
      };

      if (cadence !== "none") {
        const anchor = new Date(`${newestDate}T00:00:00`);
        anchor.setDate(anchor.getDate() + CADENCE_DAYS[cadence]);
        updatePayload.next_touch_date = anchor.toISOString().split("T")[0];
      }

      const { error: updErr } = await client
        .from("contacts")
        .update(updatePayload)
        .eq("id", row.id);

      if (updErr) {
        result.errors.push(`advance ${row.id}: ${updErr.message}`);
      } else {
        result.cadenceUpdates += 1;
      }
    })
  );

  return result;
}

/**
 * Record a sync run's result into jasonos.outreach_sync_state.
 */
export async function recordSyncState(
  source: TouchSource,
  payload: Record<string, unknown>
): Promise<void> {
  const client = createServiceRoleClient();
  await client
    .from("outreach_sync_state")
    .upsert(
      {
        source,
        last_synced_at: new Date().toISOString(),
        last_result: payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source" }
    )
    .then(
      () => undefined,
      (err) => console.error("[outreach.recordSyncState]", err)
    );
}
