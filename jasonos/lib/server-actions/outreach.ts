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
import type { LogTouchChannel, RecentTouch } from "@/lib/outreach/draft-types";
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
    // The legacy `jasonos.contacts.intent` column ships with a CHECK
    // constraint (`contacts_intent_check`) whose allow-list pre-dates the
    // new outreach-queue intents. If that constraint hasn't been widened by
    // migration 0018, writes of 'specific' / 'cold' will fail here.
    if (/contacts_intent_check/i.test(error.message)) {
      return {
        ok: false,
        error:
          "Intent CHECK constraint is too narrow — run migration 0018_widen_contacts_intent_check.sql, then try again.",
      };
    }
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
// ensureContactForRecruiter — guarantee a jasonos.contacts row exists and is
// back-linked to a given rr_recruiters.id (via source_ids.recruiter_pipeline_id).
//
// "rr_recruiters" is legacy naming — the table backs ANY first-contact /
// cold-outreach pipeline row, not literally recruiters. So this action
// does NOT classify the resulting contact: new rows leave
// relationship_type as null and the user picks Intent + Relationship from
// the contact card.
//
// Idempotent and duplicate-safe:
//   1. If a contact already links to recruiterId, return it.
//   2. Else look for an unlinked contact matching name+firm
//      (case-insensitive). If exactly one match, BACK-LINK by merging
//      { recruiter_pipeline_id: recruiterId } into its source_ids and
//      return it. If >1 match, bail with a clear error so the user can
//      link manually rather than guessing.
//   3. Otherwise INSERT a new contact populated from the rr_recruiters row.
// ---------------------------------------------------------------------------

export async function ensureContactForRecruiter(
  recruiterId: string
): Promise<
  | { ok: true; contactId: string }
  | { ok: false; error: string }
> {
  if (!recruiterId) return { ok: false, error: "recruiterId is required." };
  const guard = ensureConfigured();
  if (guard && !guard.ok) return guard;

  const sb = createServiceRoleClient();

  // Step 1: existing back-link wins.
  {
    const { data: existing, error } = await sb
      .from("contacts")
      .select("id")
      .filter("source_ids->>recruiter_pipeline_id", "eq", recruiterId)
      .limit(1)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (existing) return { ok: true, contactId: existing.id as string };
  }

  // Step 2: load the recruiter row to get name/firm/title/linkedin.
  const sbPublic = createPublicServiceRoleClient();
  const { data: recruiter, error: recruiterError } = await sbPublic
    .from("rr_recruiters")
    .select("id,name,firm,title,linkedin_url")
    .eq("id", recruiterId)
    .maybeSingle();

  if (recruiterError) return { ok: false, error: recruiterError.message };
  if (!recruiter) {
    return { ok: false, error: "Pipeline row not found for this contact." };
  }

  const recruiterName = ((recruiter.name as string) ?? "").trim();
  const recruiterFirm = ((recruiter.firm as string | null) ?? "").trim();
  const recruiterTitle = ((recruiter.title as string | null) ?? "").trim();
  const recruiterLinkedin =
    ((recruiter.linkedin_url as string | null) ?? "").trim();

  if (!recruiterName) {
    return { ok: false, error: "Pipeline row is missing a name; cannot link." };
  }

  // Step 3: try to find an unlinked match on name+firm (case-insensitive).
  // jasonos.contacts has no `firm` column; firm is encoded as a `firm:<slug>`
  // tag. So we filter by case-insensitive name and then compare each
  // candidate's tag-derived firm against the recruiter's firm.
  const { data: candidatesRaw, error: candidatesError } = await sb
    .from("contacts")
    .select("id,name,tags,source_ids")
    .ilike("name", recruiterName);

  if (candidatesError) return { ok: false, error: candidatesError.message };

  const lcFirm = recruiterFirm.toLowerCase();
  const matches = (candidatesRaw ?? []).filter((row) => {
    const tags = (row.tags as string[] | null) ?? [];
    const rowFirm = (firmFromTags(tags) ?? "").trim().toLowerCase();
    return rowFirm === lcFirm;
  });

  if (matches.length > 1) {
    return {
      ok: false,
      error:
        "Multiple contacts match this name+firm — link manually from People.",
    };
  }

  if (matches.length === 1) {
    const match = matches[0];
    const existingSourceIds =
      (match.source_ids as Record<string, unknown> | null) ?? {};
    const mergedSourceIds = {
      ...existingSourceIds,
      recruiter_pipeline_id: recruiterId,
    };
    const { error: linkError } = await sb
      .from("contacts")
      .update({ source_ids: mergedSourceIds })
      .eq("id", match.id as string);
    if (linkError) return { ok: false, error: linkError.message };
    revalidate();
    return { ok: true, contactId: match.id as string };
  }

  // Step 4: no match — INSERT a brand-new contact, back-linked from the start.
  const tags: string[] = [];
  if (recruiterFirm) tags.push(`firm:${slugifyFirm(recruiterFirm)}`);

  const { data: inserted, error: insertError } = await sb
    .from("contacts")
    .insert({
      name: recruiterName,
      title: recruiterTitle || null,
      linkedin_url: recruiterLinkedin || null,
      emails: [],
      tags,
      relationship_type: null,
      cadence_interval: "none",
      source_ids: { recruiter_pipeline_id: recruiterId },
    })
    .select("id")
    .single();

  if (insertError) return { ok: false, error: insertError.message };

  revalidate();
  return { ok: true, contactId: inserted.id as string };
}

function firmFromTags(tags: string[]): string | null {
  const tag = tags.find((t) => t.startsWith("firm:"));
  if (!tag) return null;
  return tag.slice("firm:".length).replace(/-/g, " ");
}

function slugifyFirm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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

// ---------------------------------------------------------------------------
// getContactCardData — single source of truth for "what's in this card".
//
// The OutreachModal calls this on open with whatever minimal context the
// entry point has (a canonical contactId, an rr_recruiters.id, or both).
// The action does the heavy lifting of resolving the canonical contact,
// the linked recruiter-pipeline id, and recent touches.
//
// Behavior:
//   - contactId provided           → load contact + recruiterId back-link
//   - recruiterId only             → resolve link; if none, return
//                                    { ok: false, error: "no_linked_contact" }
//                                    with a stub for header paint. The modal
//                                    can decide to call ensureContactForRecruiter
//                                    on the user's first action.
//   - both provided                → contactId wins
//   - neither                      → error
//
// No row creation happens here. That stays in ensureContactForRecruiter,
// which the modal only triggers on a real user action.
// ---------------------------------------------------------------------------

export type ContactCardDataResult =
  | {
      ok: true;
      contact: OutreachPerson;
      /** rr_recruiters.id linked via source_ids.recruiter_pipeline_id, or null. */
      recruiterId: string | null;
      recentTouches: RecentTouch[];
    }
  | {
      ok: false;
      /** "no_linked_contact" is special: the caller has only a recruiterId
       *  and there is no jasonos.contacts row linked yet. The modal can
       *  render from `stub` and call ensureContactForRecruiter on the
       *  user's first action. Any other error string is a hard failure. */
      error: string;
      recruiterId?: string;
      stub?: { name: string; title: string | null; firm: string | null };
    };

export async function getContactCardData(input: {
  contactId?: string | null;
  recruiterId?: string | null;
}): Promise<ContactCardDataResult> {
  const guard = ensureConfigured();
  if (guard && !guard.ok) return { ok: false, error: guard.error };

  const contactIdInput = input.contactId?.trim() || null;
  const recruiterIdInput = input.recruiterId?.trim() || null;

  if (!contactIdInput && !recruiterIdInput) {
    return {
      ok: false,
      error: "Provide a contactId or recruiterId.",
    };
  }

  const sb = createServiceRoleClient();

  // 1. Resolve which canonical jasonos.contacts.id we're targeting.
  let resolvedContactId: string | null = contactIdInput;

  if (!resolvedContactId && recruiterIdInput) {
    const { data: linked, error } = await sb
      .from("contacts")
      .select("id")
      .filter("source_ids->>recruiter_pipeline_id", "eq", recruiterIdInput)
      .limit(1)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };

    if (linked) {
      resolvedContactId = linked.id as string;
    } else {
      // No linked contact yet — return a stub from the pipeline row so the
      // modal can render the header immediately, and surface the
      // no_linked_contact signal so the modal knows to auto-link on the
      // user's first action via ensureContactForRecruiter.
      const sbPublic = createPublicServiceRoleClient();
      const { data: recruiter } = await sbPublic
        .from("rr_recruiters")
        .select("name,firm,title")
        .eq("id", recruiterIdInput)
        .maybeSingle();

      return {
        ok: false,
        error: "no_linked_contact",
        recruiterId: recruiterIdInput,
        stub: {
          name: (recruiter?.name as string) ?? "Unknown",
          title: (recruiter?.title as string | null) ?? null,
          firm: (recruiter?.firm as string | null) ?? null,
        },
      };
    }
  }

  if (!resolvedContactId) {
    return { ok: false, error: "Could not resolve a contact id." };
  }

  // 2. Load the canonical contact row. Mirrors getOutreachContactByRecruiterId
  // schema fallbacks so this works even when migration 0017 hasn't shipped.
  const fullColumns = `id,name,emails,linkedin_url,title,vip,tags,source_ids,
     relationship_type,cadence_interval,cadence_stage,intent,next_touch_date,
     last_touch_date,last_touch_channel`;
  const noIntentColumns = `id,name,emails,linkedin_url,title,vip,tags,source_ids,
     relationship_type,cadence_interval,cadence_stage,next_touch_date,
     last_touch_date,last_touch_channel`;

  let contactResult = await sb
    .from("contacts")
    .select(fullColumns)
    .eq("id", resolvedContactId)
    .maybeSingle();

  if (contactResult.error && /\bintent\b/i.test(contactResult.error.message)) {
    contactResult = (await sb
      .from("contacts")
      .select(noIntentColumns)
      .eq("id", resolvedContactId)
      .maybeSingle()) as typeof contactResult;
  }

  if (contactResult.error) {
    return { ok: false, error: contactResult.error.message };
  }
  const row = contactResult.data;
  if (!row) {
    return { ok: false, error: "Contact not found." };
  }

  // 3. Pull the linked recruiter pipeline id (if any) so callers can hand
  //    pipeline-aware context (FirstContactSequence) back into the modal.
  const sourceIds = (row.source_ids as Record<string, unknown> | null) ?? {};
  const recruiterPipelineId =
    typeof sourceIds.recruiter_pipeline_id === "string"
      ? sourceIds.recruiter_pipeline_id
      : null;

  // 4. Enrich firm / title / strategic score from the recruiter pipeline
  //    row when available, matching getOutreachContactByRecruiterId.
  let firm: string | null = inferFirmFromTagsLocal(
    (row.tags as string[] | null) ?? []
  );
  let firmNormalized: string | null = firm ? firm.toLowerCase() : null;
  let title: string | null = (row.title as string | null) ?? null;
  let strategicScore: number | null = null;
  let firmFocusRank: number | null = null;
  if (recruiterPipelineId) {
    try {
      const sbPublic = createPublicServiceRoleClient();
      const { data: recruiter } = await sbPublic
        .from("rr_recruiters")
        .select("firm,firm_normalized,title,strategic_score,firm_focus_rank")
        .eq("id", recruiterPipelineId)
        .maybeSingle();
      if (recruiter) {
        firm = (recruiter.firm as string) ?? firm;
        firmNormalized =
          (recruiter.firm_normalized as string) ?? firmNormalized;
        title = title ?? ((recruiter.title as string) ?? null);
        strategicScore = (recruiter.strategic_score as number) ?? null;
        firmFocusRank = (recruiter.firm_focus_rank as number) ?? null;
      }
    } catch (err) {
      console.error("[outreach.getContactCardData.enrich]", err);
    }
  }

  const emails = (row.emails as string[] | null) ?? [];
  const contact: OutreachPerson = {
    id: row.id as string,
    name: row.name as string,
    title,
    firm,
    firm_normalized: firmNormalized,
    linkedin_url: (row.linkedin_url as string) ?? null,
    primary_email: emails[0] ?? null,
    vip: Boolean(row.vip),
    relationship_type:
      (row.relationship_type as RelationshipType | null) ?? null,
    cadence_interval:
      (row.cadence_interval as CadenceInterval | null) ?? "none",
    cadence_stage: (row.cadence_stage as CadenceStage | null) ?? null,
    intent:
      ((row as { intent?: ContactIntent | null }).intent as
        | ContactIntent
        | null) ?? null,
    next_touch_date: (row.next_touch_date as string | null) ?? null,
    last_touch_date: (row.last_touch_date as string | null) ?? null,
    last_touch_channel: (row.last_touch_channel as string | null) ?? null,
    tags: (row.tags as string[] | null) ?? [],
    strategic_score: strategicScore,
    firm_focus_rank: firmFocusRank,
  };

  // 5. Recent touches — primary source jasonos.contact_touches.
  const recentTouches: RecentTouch[] = [];
  try {
    const { data: touches } = await sb
      .from("contact_touches")
      .select("id,channel,direction,touched_at,brief")
      .eq("contact_id", contact.id)
      .order("touched_at", { ascending: false })
      .limit(10);
    if (touches?.length) {
      for (const t of touches) {
        recentTouches.push({
          id: t.id as string,
          channel: t.channel as string,
          direction: t.direction as string,
          touched_at: t.touched_at as string,
          brief: (t.brief as string) ?? null,
        });
      }
    } else if (recruiterPipelineId) {
      // Fallback: rr_touches via the recruiter link (legacy path).
      const { data: legacy } = await sb
        .from("rr_touches")
        .select("id,channel,direction,touched_at,brief")
        .eq("contact_id", recruiterPipelineId)
        .order("touched_at", { ascending: false })
        .limit(10);
      for (const t of legacy ?? []) {
        recentTouches.push({
          id: t.id as string,
          channel: t.channel as string,
          direction: t.direction as string,
          touched_at: t.touched_at as string,
          brief: (t.brief as string) ?? null,
        });
      }
    }
  } catch (err) {
    console.error("[outreach.getContactCardData.touches]", err);
  }

  return {
    ok: true,
    contact,
    recruiterId: recruiterPipelineId,
    recentTouches,
  };
}

function inferFirmFromTagsLocal(tags: string[]): string | null {
  const tag = tags.find((t) => t.startsWith("firm:"));
  if (!tag) return null;
  return tag.slice("firm:".length).replace(/-/g, " ");
}
