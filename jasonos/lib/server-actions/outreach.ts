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
  type NetworkDegree,
  type RelationshipType,
  type RelevanceTier,
  type TouchObjective,
} from "@/lib/outreach/types";
import type { LogTouchChannel, RecentTouch } from "@/lib/outreach/draft-types";
import type { OutreachPerson } from "@/lib/outreach/data";
import type { ReplyStatusOverride } from "@/lib/outreach/reply-status";
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
  // Home attention cards (overdue / drift) read the same contact fields
  // that touch logging and cadence edits change — must invalidate or the
  // dashboard stays stale after a log that already refreshed the queue.
  revalidatePath("/");
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
        updatePayload.next_touch_is_manual = false;
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
// setCadence — cadence interval write for the contact card AND the Schedule
// picker.
//   - If the user has manually overridden next_touch_date, keep that date
//     (cadence only changes the rhythm for AFTER the next logged touch).
//   - Otherwise cadence drives next_touch_date:
//       cadence === "none" → next_touch_date = null
//       else               → next_touch_date = today + CADENCE_DAYS[cadence]
// For recruiter-linked contacts, also mirror next_action_due_date in
// rr_contact_state so the recruiter pipeline view stays in sync.
// ---------------------------------------------------------------------------

export async function setCadence(
  contactId: string,
  cadence: CadenceInterval
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!contactId) return { ok: false, error: "contactId is required." };

  const sb = createServiceRoleClient();

  const { data: existing, error: readError } = await sb
    .from("contacts")
    .select("source_ids, next_touch_date, next_touch_is_manual")
    .eq("id", contactId)
    .maybeSingle();

  if (readError) {
    // Migration 0044 not applied yet — fall back without the manual flag.
    if (/next_touch_is_manual/i.test(readError.message)) {
      const { data: legacy, error: legacyErr } = await sb
        .from("contacts")
        .select("source_ids, next_touch_date")
        .eq("id", contactId)
        .maybeSingle();
      if (legacyErr) return { ok: false, error: legacyErr.message };
      if (!legacy) return { ok: false, error: "Contact not found." };
      const nextTouchDate =
        cadence === "none" ? null : nextTouchFromCadence(cadence);
      const { error } = await sb
        .from("contacts")
        .update({ cadence_interval: cadence, next_touch_date: nextTouchDate })
        .eq("id", contactId);
      if (error) return { ok: false, error: error.message };
      await mirrorPipelineDueDate(legacy.source_ids, nextTouchDate);
      revalidate();
      return { ok: true };
    }
    return { ok: false, error: readError.message };
  }
  if (!existing) return { ok: false, error: "Contact not found." };

  const isManual = Boolean(
    (existing as { next_touch_is_manual?: boolean | null }).next_touch_is_manual
  );
  const priorNextTouch =
    (existing.next_touch_date as string | null | undefined) ?? null;

  // Manual next-touch wins over cadence for the scheduled date. Cadence still
  // updates so the next logged touch can re-derive from the new rhythm.
  const nextTouchDate = isManual
    ? priorNextTouch
    : cadence === "none"
      ? null
      : nextTouchFromCadence(cadence);

  const { error } = await sb
    .from("contacts")
    .update({
      cadence_interval: cadence,
      next_touch_date: nextTouchDate,
    })
    .eq("id", contactId);

  if (error) return { ok: false, error: error.message };

  await mirrorPipelineDueDate(existing.source_ids, nextTouchDate);

  revalidate();
  return { ok: true };
}

/** Mirror contacts.next_touch_date → rr_contact_state for recruiter links. */
async function mirrorPipelineDueDate(
  sourceIds: unknown,
  nextTouchDate: string | null
): Promise<void> {
  const ids = sourceIds as Record<string, unknown> | null;
  const rpid =
    typeof ids?.recruiter_pipeline_id === "string"
      ? ids.recruiter_pipeline_id
      : null;
  if (!rpid) return;
  const sbPublic = createPublicServiceRoleClient();
  await sbPublic.from("rr_contact_state").upsert(
    {
      contact_id: rpid,
      next_action_due_date: nextTouchDate,
      status_updated_at: new Date().toISOString(),
    },
    { onConflict: "contact_id" }
  );
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
// setNetworkingFlag — mark a contact as a networking relationship (true) or a
// frequent/operational contact (false). Operational contacts are excluded from
// the networking Weekly Report and funnel so day-to-day chatter doesn't skew
// the picture. Defaults true for every contact.
// ---------------------------------------------------------------------------

export async function setNetworkingFlag(
  contactId: string,
  isNetworking: boolean
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!contactId) return { ok: false, error: "contactId is required." };

  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("contacts")
    .update({ is_networking: isNetworking })
    .eq("id", contactId);

  if (error) return { ok: false, error: error.message };

  revalidate();
  revalidatePath("/activity");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// setRelevanceTier / setNetworkDegree — the two new classification vectors
// (migration 0025). Both accept null to clear.
// ---------------------------------------------------------------------------

export async function setRelevanceTier(
  contactId: string,
  tier: RelevanceTier | null
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!contactId) return { ok: false, error: "contactId is required." };

  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("contacts")
    .update({ relevance_tier: tier })
    .eq("id", contactId);
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

export async function setNetworkDegree(
  contactId: string,
  degree: NetworkDegree | null
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!contactId) return { ok: false, error: "contactId is required." };

  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("contacts")
    .update({ network_degree: degree })
    .eq("id", contactId);
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// setReplyStatusOverride — pin the green/yellow/red reply-status light by
// hand. Texts aren't tracked automatically, so this is how Jason marks
// "they texted back" / "I'm waiting" without inventing a fake touch row.
// Pass null to clear the pin and fall back to auto (last logged touch).
// ---------------------------------------------------------------------------

export async function setReplyStatusOverride(
  contactId: string,
  override: ReplyStatusOverride
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!contactId) return { ok: false, error: "contactId is required." };
  if (override && !["replied", "waiting", "overdue"].includes(override)) {
    return { ok: false, error: "Invalid reply status." };
  }

  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("contacts")
    .update({
      reply_status_override: override,
      reply_status_override_at: override ? new Date().toISOString() : null,
    })
    .eq("id", contactId);
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// updateContactIdentity — edit the core identity fields from the contact card:
// name, firm, primary email, and phone. Firm is stored as a `firm:<slug>` tag
// (the app's convention); email is the primary entry of the emails array
// (additional emails are preserved); phone is the new `contacts.phone` column
// (migration 0030).
//
// Note: for contacts whose firm is enriched from the recruiter pipeline, that
// enrichment still wins on display — editing the firm here updates the tag,
// which is what the People list and reports read for non-pipeline contacts.
// ---------------------------------------------------------------------------

export async function updateContactIdentity(
  contactId: string,
  input: {
    name: string;
    title: string | null;
    firm: string | null;
    email: string | null;
    phone: string | null;
    linkedinUrl: string | null;
  }
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!contactId) return { ok: false, error: "contactId is required." };

  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name can't be empty." };

  const sb = createServiceRoleClient();

  const { data: existing, error: readError } = await sb
    .from("contacts")
    .select("tags,emails")
    .eq("id", contactId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!existing) return { ok: false, error: "Contact not found." };

  // Firm: link a companies row that preserves the EXACT, user-typed casing
  // (so "Goldman Sachs" stays "Goldman Sachs"), and keep the legacy
  // `firm:<slug>` tag in sync for name+firm matching. Firm display reads the
  // company name first, so capitalization edits stick.
  const tags = ((existing.tags as string[] | null) ?? []).filter(
    (t) => !t.startsWith("firm:")
  );
  const firm = input.firm?.trim() || null;
  if (firm) tags.push(`firm:${slugifyFirm(firm)}`);

  let companyId: string | null = null;
  if (firm) {
    const resolved = await resolveCompanyId(sb, firm);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    companyId = resolved.companyId;
  }

  // Primary email = emails[0]; preserve any additional emails.
  const currentEmails = (existing.emails as string[] | null) ?? [];
  const email = input.email?.trim() || null;
  const rest = currentEmails.slice(1).filter((e) => e && e !== email);
  const emails = email ? [email, ...rest] : rest;

  const phone = input.phone?.trim() || null;
  const title = input.title?.trim() || null;
  const linkedinUrl = input.linkedinUrl?.trim() || null;

  const payload: Record<string, unknown> = {
    name,
    title,
    linkedin_url: linkedinUrl,
    tags,
    emails,
    phone,
    company_id: companyId,
  };
  let { error } = await sb.from("contacts").update(payload).eq("id", contactId);

  // Graceful fallback if the phone column hasn't been added yet.
  if (error && /\bphone\b/i.test(error.message)) {
    delete payload.phone;
    ({ error } = await sb.from("contacts").update(payload).eq("id", contactId));
  }

  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// addReferredContact — a contact introduced you to someone new: create the new
// contact, linked back to the referrer (referred_by_contact_id). Auto-sets the
// new person's closeness degree one hop further than the referrer's (capped at
// 3), and links a company for exact-cased firm display. This is the entry point
// the meeting Debrief uses to capture referrals.
// ---------------------------------------------------------------------------

export async function addReferredContact(input: {
  referrerContactId: string;
  name: string;
  firm?: string | null;
  email?: string | null;
  referredAt?: string | null; // YYYY-MM-DD, defaults to today
}): Promise<{ ok: true; contactId: string } | { ok: false; error: string }> {
  const guard = ensureConfigured();
  if (guard && !guard.ok) return guard;
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (!input.referrerContactId)
    return { ok: false, error: "referrerContactId is required." };

  const sb = createServiceRoleClient();

  // Referrer's degree → the new person's degree, one hop further (max 3).
  const { data: referrer } = await sb
    .from("contacts")
    .select("network_degree")
    .eq("id", input.referrerContactId)
    .maybeSingle();
  const refDeg = (referrer?.network_degree as number | null) ?? null;
  const newDegree = refDeg ? Math.min(refDeg + 1, 3) : 2;

  const firm = input.firm?.trim() || null;
  const tags: string[] = ["source:referral"];
  if (firm) tags.push(`firm:${slugifyFirm(firm)}`);
  let companyId: string | null = null;
  if (firm) {
    const resolved = await resolveCompanyId(sb, firm);
    if (resolved.ok) companyId = resolved.companyId;
  }
  const email = input.email?.trim() || null;

  const { data, error } = await sb
    .from("contacts")
    .insert({
      name,
      emails: email ? [email] : [],
      tags,
      company_id: companyId,
      referred_by_contact_id: input.referrerContactId,
      referred_at: input.referredAt || new Date().toISOString().split("T")[0],
      network_degree: newDegree,
      relationship_type: null,
      cadence_interval: "none",
      is_networking: true,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidate();
  revalidatePath("/activity");
  return { ok: true, contactId: data.id as string };
}

// setReferredBy — mark (or clear) who introduced you to an existing contact.
export async function setReferredBy(
  contactId: string,
  referrerContactId: string | null
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!contactId) return { ok: false, error: "contactId is required." };
  if (referrerContactId === contactId)
    return { ok: false, error: "A contact can't refer themselves." };

  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("contacts")
    .update({
      referred_by_contact_id: referrerContactId,
      referred_at: referrerContactId
        ? new Date().toISOString().split("T")[0]
        : null,
    })
    .eq("id", contactId);
  if (error) return { ok: false, error: error.message };

  revalidate();
  revalidatePath("/activity");
  return { ok: true };
}

// searchContacts — lightweight name type-ahead over existing contacts (used by
// the "Referred by" picker so you can link an existing contact instead of
// accidentally creating a duplicate). Returns up to 10 matches.
export async function searchContacts(
  query: string,
  excludeId?: string
): Promise<{ id: string; name: string; firm: string | null }[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return [];
  }
  const sb = createServiceRoleClient();
  const pattern = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const { data, error } = await sb
    .from("contacts")
    .select("id,name,tags")
    .ilike("name", pattern)
    .order("name", { ascending: true })
    .limit(10);
  if (error) {
    console.error("[outreach.searchContacts]", error);
    return [];
  }
  return (data ?? [])
    .filter((r) => (r.id as string) !== excludeId)
    .map((r) => ({
      id: r.id as string,
      name: (r.name as string) ?? "Unknown",
      firm: firmFromTags((r.tags as string[] | null) ?? []),
    }));
}

// ---------------------------------------------------------------------------
// setContactIntent — pin a contact to a queue column (warm/specific/cold),
// remove them from the queue entirely (backrow, migration 0019), or clear
// the value (null) so the queue-buckets derivation rules decide. Backed by
// migration 0017 (column) + 0018/0019 (CHECK constraint widenings).
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
    // new outreach-queue intents. If that constraint hasn't been widened
    // to include the latest intent values (currently 'backrow' from
    // migration 0019), writes will fail here.
    if (/contacts_intent_check/i.test(error.message)) {
      return {
        ok: false,
        error:
          "Intent CHECK constraint is too narrow — run migration 0019_add_backrow_intent.sql (or the latest), then try again.",
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
  /**
   * Explicit next-touch date (YYYY-MM-DD) chosen in the Log a Touch panel.
   * When provided it wins over the cadence-derived date so the user can
   * manually schedule the next touch (even against the cadence).
   */
  nextTouchDateOverride?: string | null;
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

  const sb = createServiceRoleClient();

  // Explicit next-touch override wins over the cadence-derived (or cleared)
  // date that insertContactTouches just stamped. Allow clearing with null
  // when the caller passes the key intentionally. Mark manual so cadence
  // edits don't clobber the user's chosen date.
  const { data: contact } = await sb
    .from("contacts")
    .select("source_ids, next_touch_date")
    .eq("id", input.contactId)
    .maybeSingle();

  let effectiveNextTouch =
    (contact?.next_touch_date as string | null | undefined) ?? null;

  if (input.nextTouchDateOverride !== undefined) {
    const overridePayload: Record<string, unknown> = {
      next_touch_date: input.nextTouchDateOverride,
      next_touch_is_manual: input.nextTouchDateOverride != null,
    };
    let { error: ntErr } = await sb
      .from("contacts")
      .update(overridePayload)
      .eq("id", input.contactId);
    if (ntErr && /next_touch_is_manual/i.test(ntErr.message)) {
      ({ error: ntErr } = await sb
        .from("contacts")
        .update({ next_touch_date: input.nextTouchDateOverride })
        .eq("id", input.contactId));
    }
    if (ntErr) return { ok: false, error: ntErr.message };
    effectiveNextTouch = input.nextTouchDateOverride;
  }

  // Mirror to rr_touches for recruiter contacts so the existing legacy
  // Communications timeline view continues to render manual touches.
  const sourceIds = (contact?.source_ids as Record<string, unknown> | null) ?? {};
  const recruiterId =
    typeof sourceIds.recruiter_pipeline_id === "string"
      ? sourceIds.recruiter_pipeline_id
      : null;
  if (recruiterId) {
    await mirrorPipelineDueDate(sourceIds, effectiveNextTouch);
    // rr_touches has a narrower channel CHECK (email/linkedin/phone/meeting/
    // event/referral/other) than jasonos.contact_touches. Map the richer
    // channel down so the legacy mirror insert doesn't violate it.
    const rrChannel = ((ch: LogTouchChannel): string => {
      switch (ch) {
        case "email":
          return "email";
        case "linkedin":
          return "linkedin";
        case "phone":
        case "call":
          return "phone";
        case "video":
        case "calendar":
        case "in_person":
        case "coffee_chat":
          return "meeting";
        default:
          return "other";
      }
    })(input.channel);
    await sb
      .from("rr_touches")
      .insert({
        contact_id: recruiterId,
        channel: rrChannel,
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
// setNextTouchDate — directly set (or clear) a contact's next_touch_date
// WITHOUT logging a touch or changing the cadence interval. This is the
// "reschedule / push out" action: e.g. a contact is overdue but unreachable
// until next week, so bump the next touch to next week and it moves straight
// from Overdue to Scheduled — overriding cadence for queue placement.
// Marks next_touch_is_manual so later cadence edits don't clobber it.
// Mirrors rr_contact_state for recruiter-linked contacts.
// ---------------------------------------------------------------------------

export async function setNextTouchDate(
  contactId: string,
  date: string | null
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!contactId) return { ok: false, error: "contactId is required." };

  const sb = createServiceRoleClient();
  const { data: existing, error: readError } = await sb
    .from("contacts")
    .select("source_ids")
    .eq("id", contactId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!existing) return { ok: false, error: "Contact not found." };

  // date set → manual override; cleared → back to cadence-driven (no date).
  const updatePayload: Record<string, unknown> = {
    next_touch_date: date,
    next_touch_is_manual: date != null,
  };
  let { error } = await sb
    .from("contacts")
    .update(updatePayload)
    .eq("id", contactId);
  if (error && /next_touch_is_manual/i.test(error.message)) {
    ({ error } = await sb
      .from("contacts")
      .update({ next_touch_date: date })
      .eq("id", contactId));
  }
  if (error) return { ok: false, error: error.message };

  await mirrorPipelineDueDate(existing.source_ids, date);

  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// snoozeContact — push the next_touch_date forward by N days (or to a specific
// date). Lightweight: doesn't change the cadence interval. Counts as a manual
// override so cadence won't immediately pull the date back.
// ---------------------------------------------------------------------------

export async function snoozeContact(
  contactId: string,
  days: number
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!contactId) return { ok: false, error: "contactId is required." };

  const sb = createServiceRoleClient();
  const { data: existing, error: readError } = await sb
    .from("contacts")
    .select("source_ids")
    .eq("id", contactId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!existing) return { ok: false, error: "Contact not found." };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  today.setDate(today.getDate() + Math.max(1, Math.floor(days)));
  const nextDate = today.toISOString().split("T")[0];

  let { error } = await sb
    .from("contacts")
    .update({ next_touch_date: nextDate, next_touch_is_manual: true })
    .eq("id", contactId);
  if (error && /next_touch_is_manual/i.test(error.message)) {
    ({ error } = await sb
      .from("contacts")
      .update({ next_touch_date: nextDate })
      .eq("id", contactId));
  }

  if (error) return { ok: false, error: error.message };

  await mirrorPipelineDueDate(existing.source_ids, nextDate);

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

// Find (case-insensitively) or create a jasonos.companies row for a firm name,
// preserving the exact casing the user typed. If a company already exists with
// different casing, its name is updated to the new casing so the edit "sticks"
// everywhere the company is referenced. Returns the company id.
async function resolveCompanyId(
  sb: ReturnType<typeof createServiceRoleClient>,
  firm: string
): Promise<{ ok: true; companyId: string } | { ok: false; error: string }> {
  // Escape LIKE wildcards so a stray % / _ in a name can't widen the match.
  const pattern = firm.replace(/[\\%_]/g, (m) => `\\${m}`);
  const { data: existing, error } = await sb
    .from("companies")
    .select("id,name")
    .ilike("name", pattern)
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  if (existing) {
    if ((existing.name as string) !== firm) {
      await sb.from("companies").update({ name: firm }).eq("id", existing.id);
    }
    return { ok: true, companyId: existing.id as string };
  }

  const { data: created, error: insErr } = await sb
    .from("companies")
    .insert({ name: firm })
    .select("id")
    .single();
  if (insErr) return { ok: false, error: insErr.message };
  return { ok: true, companyId: created.id as string };
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
  const fullColumns = `id,name,emails,phone,linkedin_url,title,vip,tags,is_networking,
     relationship_type,cadence_interval,cadence_stage,intent,relevance_tier,
     network_degree,next_touch_date,next_touch_is_manual,last_touch_date,last_touch_channel,
     reply_status_override,reply_status_override_at`;
  const noManualColumns = `id,name,emails,phone,linkedin_url,title,vip,tags,is_networking,
     relationship_type,cadence_interval,cadence_stage,intent,relevance_tier,
     network_degree,next_touch_date,last_touch_date,last_touch_channel,
     reply_status_override,reply_status_override_at`;
  const noOverrideColumns = `id,name,emails,phone,linkedin_url,title,vip,tags,is_networking,
     relationship_type,cadence_interval,cadence_stage,intent,relevance_tier,
     network_degree,next_touch_date,last_touch_date,last_touch_channel`;
  const noIntentColumns = `id,name,emails,phone,linkedin_url,title,vip,tags,is_networking,
     relationship_type,cadence_interval,cadence_stage,relevance_tier,
     network_degree,next_touch_date,last_touch_date,last_touch_channel`;

  let result = await sb
    .from("contacts")
    .select(fullColumns)
    .filter("source_ids->>recruiter_pipeline_id", "eq", recruiterId)
    .limit(1)
    .maybeSingle();

  if (result.error && /next_touch_is_manual/i.test(result.error.message)) {
    result = (await sb
      .from("contacts")
      .select(noManualColumns)
      .filter("source_ids->>recruiter_pipeline_id", "eq", recruiterId)
      .limit(1)
      .maybeSingle()) as typeof result;
  }

  if (result.error && /reply_status_override/i.test(result.error.message)) {
    result = (await sb
      .from("contacts")
      .select(noOverrideColumns)
      .filter("source_ids->>recruiter_pipeline_id", "eq", recruiterId)
      .limit(1)
      .maybeSingle()) as typeof result;
  }

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
    phone: ((data as { phone?: string | null }).phone as string | null) ?? null,
    vip: Boolean(data.vip),
    is_networking:
      ((data as { is_networking?: boolean | null }).is_networking ?? true) !== false,
    relationship_type:
      (data.relationship_type as RelationshipType | null) ?? null,
    cadence_interval:
      (data.cadence_interval as CadenceInterval | null) ?? "none",
    cadence_stage: (data.cadence_stage as CadenceStage | null) ?? null,
    relevance_tier:
      ((data as { relevance_tier?: RelevanceTier | null }).relevance_tier as
        | RelevanceTier
        | null) ?? null,
    network_degree:
      ((data as { network_degree?: NetworkDegree | null }).network_degree as
        | NetworkDegree
        | null) ?? null,
    intent:
      ((data as { intent?: ContactIntent | null }).intent as
        | ContactIntent
        | null) ?? null,
    next_touch_date: (data.next_touch_date as string | null) ?? null,
    next_touch_is_manual: Boolean(
      (data as { next_touch_is_manual?: boolean | null }).next_touch_is_manual
    ),
    last_touch_date: (data.last_touch_date as string | null) ?? null,
    last_touch_channel: (data.last_touch_channel as string | null) ?? null,
    reply_status_override:
      ((data as { reply_status_override?: ReplyStatusOverride }).reply_status_override as
        | ReplyStatusOverride
        | undefined) ?? null,
    reply_status_override_at:
      ((data as { reply_status_override_at?: string | null }).reply_status_override_at as
        | string
        | null
        | undefined) ?? null,
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
      /** Who introduced you to this contact, if recorded. */
      referredBy: { id: string; name: string } | null;
      /** New people this contact introduced you to. */
      referrals: { id: string; name: string }[];
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
  const fullColumns = `id,name,emails,phone,linkedin_url,title,vip,tags,source_ids,company_id,is_networking,referred_by_contact_id,
     relationship_type,cadence_interval,cadence_stage,intent,relevance_tier,
     network_degree,next_touch_date,next_touch_is_manual,last_touch_date,last_touch_channel,
     reply_status_override,reply_status_override_at`;
  const noManualColumns = `id,name,emails,phone,linkedin_url,title,vip,tags,source_ids,company_id,is_networking,referred_by_contact_id,
     relationship_type,cadence_interval,cadence_stage,intent,relevance_tier,
     network_degree,next_touch_date,last_touch_date,last_touch_channel,
     reply_status_override,reply_status_override_at`;
  const noOverrideColumns = `id,name,emails,phone,linkedin_url,title,vip,tags,source_ids,company_id,is_networking,referred_by_contact_id,
     relationship_type,cadence_interval,cadence_stage,intent,relevance_tier,
     network_degree,next_touch_date,last_touch_date,last_touch_channel`;
  const noIntentColumns = `id,name,emails,phone,linkedin_url,title,vip,tags,source_ids,company_id,is_networking,referred_by_contact_id,
     relationship_type,cadence_interval,cadence_stage,relevance_tier,
     network_degree,next_touch_date,last_touch_date,last_touch_channel`;

  let contactResult = await sb
    .from("contacts")
    .select(fullColumns)
    .eq("id", resolvedContactId)
    .maybeSingle();

  if (contactResult.error && /next_touch_is_manual/i.test(contactResult.error.message)) {
    contactResult = (await sb
      .from("contacts")
      .select(noManualColumns)
      .eq("id", resolvedContactId)
      .maybeSingle()) as typeof contactResult;
  }

  if (contactResult.error && /reply_status_override/i.test(contactResult.error.message)) {
    contactResult = (await sb
      .from("contacts")
      .select(noOverrideColumns)
      .eq("id", resolvedContactId)
      .maybeSingle()) as typeof contactResult;
  }

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

  // 4. Firm resolution. The linked company name (exact casing, via company_id)
  //    wins over the legacy firm:<slug> tag; the recruiter pipeline enrichment
  //    below still wins over both for recruiter-linked contacts.
  const contactCompanyId = (row.company_id as string | null) ?? null;
  let companyName: string | null = null;
  if (contactCompanyId) {
    const { data: co } = await sb
      .from("companies")
      .select("name")
      .eq("id", contactCompanyId)
      .maybeSingle();
    companyName = (co?.name as string | null) ?? null;
  }
  let firm: string | null =
    companyName ?? inferFirmFromTagsLocal((row.tags as string[] | null) ?? []);
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
    phone: ((row as { phone?: string | null }).phone as string | null) ?? null,
    vip: Boolean(row.vip),
    is_networking:
      ((row as { is_networking?: boolean | null }).is_networking ?? true) !== false,
    relationship_type:
      (row.relationship_type as RelationshipType | null) ?? null,
    cadence_interval:
      (row.cadence_interval as CadenceInterval | null) ?? "none",
    cadence_stage: (row.cadence_stage as CadenceStage | null) ?? null,
    relevance_tier:
      ((row as { relevance_tier?: RelevanceTier | null }).relevance_tier as
        | RelevanceTier
        | null) ?? null,
    network_degree:
      ((row as { network_degree?: NetworkDegree | null }).network_degree as
        | NetworkDegree
        | null) ?? null,
    intent:
      ((row as { intent?: ContactIntent | null }).intent as
        | ContactIntent
        | null) ?? null,
    next_touch_date: (row.next_touch_date as string | null) ?? null,
    next_touch_is_manual: Boolean(
      (row as { next_touch_is_manual?: boolean | null }).next_touch_is_manual
    ),
    last_touch_date: (row.last_touch_date as string | null) ?? null,
    last_touch_channel: (row.last_touch_channel as string | null) ?? null,
    reply_status_override:
      ((row as { reply_status_override?: ReplyStatusOverride }).reply_status_override as
        | ReplyStatusOverride
        | undefined) ?? null,
    reply_status_override_at:
      ((row as { reply_status_override_at?: string | null }).reply_status_override_at as
        | string
        | null
        | undefined) ?? null,
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

  // Referral relationships: who introduced you to this contact, and the new
  // people this contact introduced you to.
  let referredBy: { id: string; name: string } | null = null;
  const referrerId =
    (row.referred_by_contact_id as string | null) ?? null;
  if (referrerId) {
    const { data: refRow } = await sb
      .from("contacts")
      .select("id,name")
      .eq("id", referrerId)
      .maybeSingle();
    if (refRow) {
      referredBy = { id: refRow.id as string, name: (refRow.name as string) ?? "Unknown" };
    }
  }
  const referrals: { id: string; name: string }[] = [];
  try {
    const { data: referredRows } = await sb
      .from("contacts")
      .select("id,name")
      .eq("referred_by_contact_id", contact.id)
      .order("created_at", { ascending: false });
    for (const r of referredRows ?? []) {
      referrals.push({ id: r.id as string, name: (r.name as string) ?? "Unknown" });
    }
  } catch (err) {
    console.error("[outreach.getContactCardData.referrals]", err);
  }

  return {
    ok: true,
    contact,
    recruiterId: recruiterPipelineId,
    recentTouches,
    referredBy,
    referrals,
  };
}

function inferFirmFromTagsLocal(tags: string[]): string | null {
  const tag = tags.find((t) => t.startsWith("firm:"));
  if (!tag) return null;
  return tag.slice("firm:".length).replace(/-/g, " ");
}
