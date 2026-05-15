"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  CADENCE_DAYS,
  nextTouchFromCadence,
  type CadenceInterval,
  type RelationshipType,
} from "@/lib/outreach/types";
import type { LogTouchChannel } from "@/lib/outreach/draft-types";

type ActionResult = { ok: true } | { ok: false; error: string };

function ensureConfigured(): ActionResult | null {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }
  return { ok: false, error: "Supabase service role is not configured." };
}

function revalidate() {
  revalidatePath("/outreach");
  revalidatePath("/outreach/queue");
  revalidatePath("/outreach/schedule");
  revalidatePath("/outreach/people");
  revalidatePath("/outreach/firms");
  // Keep legacy paths working until they redirect.
  revalidatePath("/reconnect");
  revalidatePath("/reconnect/contacts");
  revalidatePath("/communications");
}

// ---------------------------------------------------------------------------
// setRelationshipType — assign or clear the 6-bucket classification
// ---------------------------------------------------------------------------

export async function setRelationshipType(
  contactId: string,
  type: RelationshipType | null
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!contactId) return { ok: false, error: "contactId is required." };

  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("contacts")
    .update({ relationship_type: type })
    .eq("id", contactId);

  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// setCadence — change cadence rhythm; recompute next_touch_date from today
// when the rhythm changes (we don't carry forward a stale date).
// ---------------------------------------------------------------------------

export async function setCadence(
  contactId: string,
  cadence: CadenceInterval
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!contactId) return { ok: false, error: "contactId is required." };

  const sb = createServiceRoleClient();

  // Pull existing values so we only re-compute next_touch_date when the
  // cadence interval actually changes; otherwise preserve a manually-scheduled
  // future date.
  const { data: existing, error: readError } = await sb
    .from("contacts")
    .select("cadence_interval,next_touch_date,last_touch_date")
    .eq("id", contactId)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };
  if (!existing) return { ok: false, error: "Contact not found." };

  const priorCadence =
    (existing.cadence_interval as CadenceInterval | null) ?? "none";
  const priorNext = (existing.next_touch_date as string | null) ?? null;
  const cadenceChanged = priorCadence !== cadence;

  let nextTouchDate: string | null;
  if (cadence === "none") {
    nextTouchDate = priorNext; // keep any manually-set date even with no rhythm
  } else if (cadenceChanged) {
    // Anchor from last_touch_date if it exists, otherwise from today.
    const lastTouch = existing.last_touch_date as string | null;
    const anchor = lastTouch ? new Date(`${lastTouch}T00:00:00`) : new Date();
    nextTouchDate = nextTouchFromCadence(cadence, anchor);
  } else {
    nextTouchDate = priorNext ?? nextTouchFromCadence(cadence);
  }

  const { error } = await sb
    .from("contacts")
    .update({
      cadence_interval: cadence,
      next_touch_date: nextTouchDate,
    })
    .eq("id", contactId);

  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// toggleVip — flip the boolean VIP flag
// ---------------------------------------------------------------------------

export async function toggleVip(
  contactId: string,
  vip: boolean
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!contactId) return { ok: false, error: "contactId is required." };

  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("contacts")
    .update({ vip })
    .eq("id", contactId);

  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// logContactTouch — record a manual touch (in-person / phone / LinkedIn DM /
// meeting). Writes last_touch_date + last_touch_channel on the contact, then
// auto-advances next_touch_date based on the cadence. Mirrors to rr_touches
// when the contact links to a recruiter so the existing Communications
// timeline keeps populating.
// ---------------------------------------------------------------------------

export async function logContactTouch(input: {
  contactId: string;
  channel: LogTouchChannel;
  direction?: "outbound" | "inbound";
  brief?: string;
  /** Optional override; defaults to today. */
  touchedAtISO?: string;
}): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!input.contactId) return { ok: false, error: "contactId is required." };

  const sb = createServiceRoleClient();

  const touchedAt = input.touchedAtISO ?? new Date().toISOString();
  const touchedDate = touchedAt.split("T")[0];

  const { data: contact, error: readErr } = await sb
    .from("contacts")
    .select("id,cadence_interval,source_ids")
    .eq("id", input.contactId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!contact) return { ok: false, error: "Contact not found." };

  const cadence =
    (contact.cadence_interval as CadenceInterval | null) ?? "none";

  // Auto-advance next_touch_date when a cadence is set; for outbound touches
  // this is the standard "saw them, reschedule next reach". For inbound we
  // still advance — receiving a reply also resets the rhythm.
  let nextTouchDate: string | null = null;
  if (cadence !== "none") {
    const anchor = new Date(`${touchedDate}T00:00:00`);
    anchor.setDate(anchor.getDate() + CADENCE_DAYS[cadence]);
    nextTouchDate = anchor.toISOString().split("T")[0];
  }

  const updatePayload: Record<string, unknown> = {
    last_touch_date: touchedDate,
    last_touch_channel: input.channel,
  };
  if (nextTouchDate) updatePayload.next_touch_date = nextTouchDate;

  const { error: updateErr } = await sb
    .from("contacts")
    .update(updatePayload)
    .eq("id", input.contactId);
  if (updateErr) return { ok: false, error: updateErr.message };

  // Mirror to rr_touches for recruiter contacts so the existing timeline view
  // shows the manually-logged touch.
  const sourceIds = (contact.source_ids as Record<string, unknown> | null) ?? {};
  const recruiterId =
    typeof sourceIds.recruiter_pipeline_id === "string"
      ? sourceIds.recruiter_pipeline_id
      : null;
  if (recruiterId) {
    // Best-effort; ignore failures here so logging the touch on the contact
    // succeeds even if the rr_touches mirror has a transient issue.
    await sb
      .from("rr_touches")
      .insert({
        contact_id: recruiterId,
        channel: input.channel,
        direction: input.direction ?? "outbound",
        touched_at: touchedAt,
        brief: input.brief ?? null,
        source: "manual",
      })
      .then(
        () => undefined,
        (err) =>
          console.error("[outreach.logContactTouch.rr_touches.mirror]", err)
      );
  }

  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// snoozeContact — push the next_touch_date forward by N days (or to a specific
// date). Lightweight: doesn't change the cadence interval.
// ---------------------------------------------------------------------------

export async function snoozeContact(
  contactId: string,
  days: number
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!contactId) return { ok: false, error: "contactId is required." };

  const sb = createServiceRoleClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  today.setDate(today.getDate() + Math.max(1, Math.floor(days)));
  const nextDate = today.toISOString().split("T")[0];

  const { error } = await sb
    .from("contacts")
    .update({ next_touch_date: nextDate })
    .eq("id", contactId);

  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}
