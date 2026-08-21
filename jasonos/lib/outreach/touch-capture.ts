// Shared helpers for capturing touches into jasonos.contact_touches.
// Used by the Gmail / Calendar / HubSpot sync flows AND by logContactTouch
// for manual entries. Auto-advances the contact's last_touch_date /
// next_touch_date based on cadence_interval so every captured touch closes
// the loop with the cadence system.

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { etYmd } from "@/lib/dates";
import {
  CADENCE_DAYS,
  advanceCadenceStage,
  type CadenceInterval,
  type CadenceStage,
  type TouchObjective,
} from "@/lib/outreach/types";
import { appendSyncLog } from "@/lib/outreach/sync-log";

export type TouchChannel =
  | "email"
  | "calendar"
  | "linkedin"
  | "phone"
  | "call"
  | "video"
  | "in_person"
  | "coffee_chat"
  | "text"
  | "thank_you_note"
  | "value_sharing"
  | "other";

export type TouchDirection = "outbound" | "inbound";

export type TouchSource =
  | "gmail"
  | "gcal"
  | "hubspot"
  | "manual"
  | "rr_legacy"
  | "beeper";

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
  /**
   * Phase 5A: did this touch achieve its goal? Drives cadence_stage progression.
   * - "yes"     → advance cadence_stage one step
   * - "no"      → hold at current stage (default when not provided for sync)
   * - "neutral" → hold at current stage (casual check-in)
   */
  objective_achieved?: TouchObjective | null;
  /** Free-form post-touch note (what happened). */
  outcome?: string | null;
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

  // ---- Step 1: insert into contact_touches (dedup on source, external_id)
  // We split rows in two batches: rows with an external_id (need dedup) and
  // rows without (always insert; manual entries get a fresh row each time).
  //
  // Why not .upsert({ onConflict: "source,external_id" })? The unique index
  // `uniq_contact_touches_source_external_id` (see 0014_contact_touches.sql)
  // is *partial* — it only applies WHERE source IS NOT NULL AND external_id
  // IS NOT NULL. Postgres won't infer a partial unique index for ON CONFLICT
  // unless the same WHERE predicate is restated, and the Supabase client API
  // has no way to pass that predicate. Result: the upsert fails at runtime
  // with "no unique or exclusion constraint matching the ON CONFLICT
  // specification". We mirror the NOT EXISTS pre-check pattern used in the
  // 0014 backfill instead. The partial unique index stays as defense-in-depth
  // against two sync workers racing past the pre-check.

  const withDedup = touches.filter((t) => t.external_id);
  const noDedup = touches.filter((t) => !t.external_id);

  if (withDedup.length) {
    const sources = Array.from(
      new Set(
        withDedup
          .map((t) => t.source)
          .filter((s): s is TouchSource => Boolean(s))
      )
    );
    const externalIds = Array.from(
      new Set(
        withDedup
          .map((t) => t.external_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    // Pre-check: which (source, external_id) tuples already exist? The .in()
    // pair may match a small cross-product superset; we filter precisely in
    // JS below using a Set of `${source}::${external_id}` keys.
    const { data: existingRows, error: preErr } = await client
      .from("contact_touches")
      .select("source, external_id")
      .in("source", sources)
      .in("external_id", externalIds);

    if (preErr) {
      // Bail safely: without the pre-check we'd risk inserting duplicates
      // (the partial unique index can't catch us via ON CONFLICT here).
      result.errors.push(`pre-check: ${preErr.message}`);
    } else {
      const existingKeys = new Set<string>();
      for (const row of existingRows ?? []) {
        const src = row.source as string | null;
        const ext = row.external_id as string | null;
        if (src && ext) existingKeys.add(`${src}::${ext}`);
      }

      const newRows = withDedup.filter(
        (t) => !existingKeys.has(`${t.source}::${t.external_id}`)
      );
      result.duplicates += withDedup.length - newRows.length;

      if (newRows.length) {
        const { data, error } = await client
          .from("contact_touches")
          .insert(newRows)
          .select("id, contact_id");
        if (error) {
          result.errors.push(`insert(dedup): ${error.message}`);
        } else {
          result.inserted += data?.length ?? 0;
        }
      }
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

  let contactRows: Array<Record<string, unknown>> | null = null;
  {
    const read = await client
      .from("contacts")
      .select(
        "id, cadence_interval, last_touch_date, cadence_stage, next_touch_is_manual"
      )
      .in("id", contactIds);
    if (read.error && /next_touch_is_manual/i.test(read.error.message)) {
      const fallback = await client
        .from("contacts")
        .select("id, cadence_interval, last_touch_date, cadence_stage")
        .in("id", contactIds);
      if (fallback.error) {
        result.errors.push(`read contacts: ${fallback.error.message}`);
        return result;
      }
      contactRows = (fallback.data as Array<Record<string, unknown>>) ?? [];
    } else if (read.error) {
      result.errors.push(`read contacts: ${read.error.message}`);
      return result;
    } else {
      contactRows = (read.data as Array<Record<string, unknown>>) ?? [];
    }
  }

  await Promise.all(
    (contactRows ?? []).map(async (row) => {
      const newest = latestByContact.get(row.id as string);
      if (!newest) return;
      // Stamp the touch's Eastern calendar day (not UTC) so a late-evening ET
      // touch doesn't record as the next day.
      const newestDate = etYmd(newest);
      const existingLast = (row.last_touch_date as string | null) ?? null;
      // Only advance if this touch is newer than what's already stamped.
      if (existingLast && existingLast >= newestDate) return;

      const cadence =
        (row.cadence_interval as CadenceInterval | null) ?? "none";

      // Pick the latest touch input we wrote for this contact so we can
      // pull its channel + objective_achieved.
      const latestTouch = touches
        .filter((t) => t.contact_id === row.id)
        .reduce<ContactTouchInput | null>((acc, cur) => {
          if (!acc || acc.touched_at < cur.touched_at) return cur;
          return acc;
        }, null);

      const updatePayload: Record<string, unknown> = {
        last_touch_date: newestDate,
        last_touch_channel: latestTouch?.channel ?? null,
        // A new logged touch consumes any prior manual next-touch override;
        // cadence (or none) drives the next date from here.
        next_touch_is_manual: false,
      };

      if (cadence !== "none") {
        const anchor = new Date(`${newestDate}T00:00:00`);
        anchor.setDate(anchor.getDate() + CADENCE_DAYS[cadence]);
        updatePayload.next_touch_date = anchor.toISOString().split("T")[0];
      } else {
        // No rhythm scheduled — clear any leftover next-touch so they land in
        // "needs scheduling" instead of staying falsely overdue after a log.
        updatePayload.next_touch_date = null;
      }

      // Cadence stage progression. Three rules:
      //   1. If contact has no stage yet AND we just logged a touch → stamp 'initial'.
      //   2. If this touch is objective_achieved = 'yes' → advance one step.
      //   3. Otherwise leave the stage alone.
      const currentStage =
        (row.cadence_stage as CadenceStage | null) ?? null;
      const objective = latestTouch?.objective_achieved ?? null;

      if (objective === "yes") {
        updatePayload.cadence_stage = advanceCadenceStage(currentStage);
      } else if (!currentStage) {
        updatePayload.cadence_stage = "initial";
      }

      let { error: updErr } = await client
        .from("contacts")
        .update(updatePayload)
        .eq("id", row.id);
      if (updErr && /next_touch_is_manual/i.test(updErr.message)) {
        const { next_touch_is_manual: _drop, ...legacyPayload } = updatePayload;
        ({ error: updErr } = await client
          .from("contacts")
          .update(legacyPayload)
          .eq("id", row.id));
      }

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
 * Record a sync run's result into jasonos.outreach_sync_state (latest per
 * source) and append a row to jasonos.sync_log (full history).
 */
export async function recordSyncState(
  source: TouchSource,
  payload: Record<string, unknown>,
  runId?: string | null
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
  await appendSyncLog(source, payload, runId);
}
