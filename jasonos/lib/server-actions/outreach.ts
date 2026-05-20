"use server";

import { revalidatePath } from "next/cache";
import {
  createPublicServiceRoleClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import {
  RELATIONSHIP_TYPE_META,
  nextTouchFromCadence,
  type CadenceInterval,
  type CadenceStage,
  type ContactIntent,
  type RelationshipType,
  type TouchObjective,
} from "@/lib/outreach/types";
import type { LogTouchChannel } from "@/lib/outreach/draft-types";
import type { OutreachPerson } from "@/lib/outreach/data";
import {
  insertContactTouches,
  type TouchChannel,
} from "@/lib/outreach/touch-capture";

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

  // Phase 5A: when classifying a contact for the first time, apply the
  // relationship type's default cadence if no cadence has been set yet.
  // This avoids the gotcha of "classified them as Operator Peer but they
  // never appear in the queue because cadence is still none."
  const updatePayload: Record<string, unknown> = { relationship_type: type };

  if (type) {
    const { data: existing, error: readError } = await sb
      .from("contacts")
      .select("cadence_interval,last_touch_date")
      .eq("id", contactId)
      .maybeSingle();

    if (readError) return { ok: false, error: readError.message };

    const currentCadence =
      (existing?.cadence_interval as CadenceInterval | null) ?? "none";

    if (currentCadence === "none") {
      const defaultCadence = RELATIONSHIP_TYPE_META[type].defaultCadence;
      if (defaultCadence !== "none") {
        updatePayload.cadence_interval = defaultCadence;
        const lastTouch = (existing?.last_touch_date as string | null) ?? null;
        const anchor = lastTouch
          ? new Date(`${lastTouch}T00:00:00`)
          : new Date();
        updatePayload.next_touch_date = nextTouchFromCadence(
          defaultCadence,
          anchor
        );
      }
    }
  }

  const { error } = await sb
    .from("contacts")
    .update(updatePayload)
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
// setContactIntent — pin a contact to a queue column (warm/specific/cold) or
// clear it (null) so the queue-buckets derivation rules decide. Backed by
// migration 0017.
// ---------------------------------------------------------------------------

export async function setContactIntent(
  contactId: string,
  intent: ContactIntent | null
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!contactId) return { ok: false, error: "contactId is required." };

  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("contacts")
    .update({ intent })
    .eq("id", contactId);

  if (error) {
    if (/\bintent\b/i.test(error.message) || /\bcontact_intent\b/i.test(error.message)) {
      return {
        ok: false,
        error:
          "Intent column is missing — run migration 0017_contact_intent.sql, then try again.",
      };
    }
    return { ok: false, error: error.message };
  }

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
  /** Phase 5A: did this touch achieve its goal? */
  objectiveAchieved?: TouchObjective | null;
  /** Phase 5A: free-form post-touch outcome. */
  outcome?: string | null;
}): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!input.contactId) return { ok: false, error: "contactId is required." };

  const touchedAt = input.touchedAtISO ?? new Date().toISOString();

  // Insert into the canonical jasonos.contact_touches table; this also
  // auto-advances last_touch_date + next_touch_date + cadence_stage.
  const result = await insertContactTouches([
    {
      contact_id: input.contactId,
      channel: input.channel as TouchChannel,
      direction: input.direction ?? "outbound",
      touched_at: touchedAt,
      source: "manual",
      brief: input.brief?.trim() || null,
      objective_achieved: input.objectiveAchieved ?? null,
      outcome: input.outcome?.trim() || null,
    },
  ]);

  if (result.errors.length) {
    return { ok: false, error: result.errors.join("; ") };
  }

  // Mirror to rr_touches for recruiter contacts so the existing legacy
  // Communications timeline view continues to render manual touches.
  const sb = createServiceRoleClient();
  const { data: contact } = await sb
    .from("contacts")
    .select("source_ids")
    .eq("id", input.contactId)
    .maybeSingle();

  const sourceIds = (contact?.source_ids as Record<string, unknown> | null) ?? {};
  const recruiterId =
    typeof sourceIds.recruiter_pipeline_id === "string"
      ? sourceIds.recruiter_pipeline_id
      : null;
  if (recruiterId) {
    await sb
      .from("rr_touches")
      .insert({
        contact_id: recruiterId,
        channel: input.channel,
        direction: input.direction ?? "outbound",
        touched_at: touchedAt,
        brief: input.brief?.trim() || null,
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

// ---------------------------------------------------------------------------
// getOutreachContactByRecruiterId — resolve the jasonos.contacts row that
// links to a given rr_recruiters.id via source_ids.recruiter_pipeline_id.
//
// Used by the OutreachModal so recruiter-pipeline contacts can ALSO surface
// the unified Recent Context / Draft Assist / Log Touch sections (which key
// off jasonos.contacts.id, not rr_recruiters.id).
// ---------------------------------------------------------------------------

export async function getOutreachContactByRecruiterId(
  recruiterId: string
): Promise<OutreachPerson | null> {
  if (!recruiterId) return null;
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }

  const sb = createServiceRoleClient();
  const fullColumns = `id,name,emails,linkedin_url,title,vip,tags,
     relationship_type,cadence_interval,cadence_stage,intent,next_touch_date,
     last_touch_date,last_touch_channel`;
  const noIntentColumns = `id,name,emails,linkedin_url,title,vip,tags,
     relationship_type,cadence_interval,cadence_stage,next_touch_date,
     last_touch_date,last_touch_channel`;

  let result = await sb
    .from("contacts")
    .select(fullColumns)
    .filter("source_ids->>recruiter_pipeline_id", "eq", recruiterId)
    .limit(1)
    .maybeSingle();

  if (result.error && /\bintent\b/i.test(result.error.message)) {
    result = (await sb
      .from("contacts")
      .select(noIntentColumns)
      .filter("source_ids->>recruiter_pipeline_id", "eq", recruiterId)
      .limit(1)
      .maybeSingle()) as typeof result;
  }

  const { data, error } = result;
  if (error || !data) return null;

  // Enrich firm/title from rr_recruiters so the modal header & section
  // helpers see real firm context even when contacts.title is null.
  let firm: string | null = null;
  let firmNormalized: string | null = null;
  let title: string | null = (data.title as string | null) ?? null;
  let strategicScore: number | null = null;
  let firmFocusRank: number | null = null;
  try {
    const sbPublic = createPublicServiceRoleClient();
    const { data: recruiter } = await sbPublic
      .from("rr_recruiters")
      .select("firm,firm_normalized,title,strategic_score,firm_focus_rank")
      .eq("id", recruiterId)
      .maybeSingle();
    if (recruiter) {
      firm = (recruiter.firm as string) ?? null;
      firmNormalized = (recruiter.firm_normalized as string) ?? null;
      title = title ?? ((recruiter.title as string) ?? null);
      strategicScore = (recruiter.strategic_score as number) ?? null;
      firmFocusRank = (recruiter.firm_focus_rank as number) ?? null;
    }
  } catch (err) {
    console.error("[outreach.getOutreachContactByRecruiterId.enrich]", err);
  }

  const emails = (data.emails as string[] | null) ?? [];

  return {
    id: data.id as string,
    name: data.name as string,
    title,
    firm,
    firm_normalized: firmNormalized,
    linkedin_url: (data.linkedin_url as string) ?? null,
    primary_email: emails[0] ?? null,
    vip: Boolean(data.vip),
    relationship_type:
      (data.relationship_type as RelationshipType | null) ?? null,
    cadence_interval:
      (data.cadence_interval as CadenceInterval | null) ?? "none",
    cadence_stage: (data.cadence_stage as CadenceStage | null) ?? null,
    intent:
      ((data as { intent?: ContactIntent | null }).intent as
        | ContactIntent
        | null) ?? null,
    next_touch_date: (data.next_touch_date as string | null) ?? null,
    last_touch_date: (data.last_touch_date as string | null) ?? null,
    last_touch_channel: (data.last_touch_channel as string | null) ?? null,
    tags: (data.tags as string[] | null) ?? [],
    strategic_score: strategicScore,
    firm_focus_rank: firmFocusRank,
  };
}
