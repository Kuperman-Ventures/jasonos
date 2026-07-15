"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import {
  createPublicServiceRoleClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import {
  searchGmailThreads,
  getGmailThread,
  isGmailConnected,
} from "@/lib/integrations/gmail";
import {
  getHubSpotContactActivities,
} from "@/lib/integrations/hubspot";
import type { CadenceInterval as CadenceIntervalType } from "@/lib/cadence/types";
import { getOutreachPeople, type OutreachPerson } from "@/lib/outreach/data";
import { setCadence } from "@/lib/server-actions/outreach";

// Kupe's known outbound email addresses (v1 hardcode — update if addresses change)
const MY_EMAILS = ["jason@kupermanadvisors.com", "jskuperman@gmail.com"];

/** Strip +tags so jason+jobalerts@… canonicalises to jason@… */
function canonicalEmail(raw: string): string {
  const e = extractEmail(raw);
  return e.replace(/\+[^@]*@/, "@");
}

/** Returns true if the To: header resolves to one of the user's own addresses. */
function isMyOwnAddress(toHeader: string): boolean {
  const canon = canonicalEmail(toHeader);
  return MY_EMAILS.some((me) => canonicalEmail(me) === canon);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommChannel = "email" | "linkedin" | "phone" | "meeting" | "other";
export type CommUrgency = "sent_today" | "due_today" | "this_week" | "scheduled" | "needs_scheduling";

export interface CommTouch {
  id: string;
  channel: CommChannel;
  direction: "inbound" | "outbound";
  touched_at: string;
  brief: string | null;
}

export interface CommPeer {
  id: string;
  name: string;
  title: string | null;
  firm: string | null;
}

export type CommSource = "recruiter" | "cadence";
export type { CadenceInterval } from "@/lib/cadence/types";

export interface CommunicationsContact {
  id: string;
  name: string;
  title: string | null;
  firm: string | null;
  firm_normalized: string | null;
  firm_focus_rank: number | null;
  strength: number; // 1–4 normalised from strategic_score
  urgency: CommUrgency;
  lastTouch: CommTouch | null;
  recentTouches: CommTouch[];
  nextActionDueDate: string | null;
  summaryOfPriorComms: string | null;
  peers: CommPeer[];
  hubspot_url: string | null;
  /** Identifies the upstream store backing this contact. */
  source: CommSource;
  /** When source === "cadence", the id of the open jasonos.cards row. */
  cadenceCardId: string | null;
  /** When source === "cadence", the interval the user picked. */
  cadenceInterval: CadenceIntervalType | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeStrength(score: number | null): number {
  if (!score) return 1;
  if (score >= 75) return 4;
  if (score >= 50) return 3;
  if (score >= 25) return 2;
  return 1;
}

function toCommChannel(raw: string | null | undefined): CommChannel {
  const map: Record<string, CommChannel> = {
    email: "email",
    linkedin: "linkedin",
    phone: "phone",
    meeting: "meeting",
    zoom: "meeting",
    call: "phone",
  };
  return map[raw?.toLowerCase() ?? ""] ?? "other";
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

// End of the current calendar work week (the coming Friday, inclusive), at
// 00:00. "This week" means through this Friday — anything due Sat/Sun or later
// rolls to next week ("Scheduled"). On a weekend, points to the next Friday.
function endOfWorkWeek(today: Date): Date {
  const d = new Date(today);
  const daysUntilFriday = (5 - d.getDay() + 7) % 7; // Fri = 5
  d.setDate(d.getDate() + daysUntilFriday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function computeUrgency(
  nextActionDueDate: string | null,
  contactedToday: boolean,
  recentlyContacted: boolean, // outbound touch within last 3 days
): CommUrgency {
  if (contactedToday) return "sent_today";

  if (!nextActionDueDate) return "needs_scheduling";

  const today = startOfToday();
  const due = new Date(nextActionDueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = (due.getTime() - today.getTime()) / 86_400_000;

  if (diffDays <= 0) return "due_today";
  // If already reached out recently and next touch is in the future, they're
  // scheduled — not an active action item for this week.
  if (recentlyContacted) return "scheduled";
  // Calendar week: due on or before this Friday → this week; later → scheduled.
  if (due.getTime() <= endOfWorkWeek(today).getTime()) return "this_week";
  return "scheduled";
}

// ---------------------------------------------------------------------------
// Main query
//
// Schedule reads from the unified jasonos.contacts source via
// getOutreachPeople() so EVERY contact with a scheduling-relevant signal
// shows up here, not just rr_recruiters pipeline rows. Recruiter-linked
// contacts are still enriched with their richer pipeline data (rr_touches,
// rr_contact_state, hubspot_url, summary_of_prior_comms) so the existing
// recruiter UI keeps working.
// ---------------------------------------------------------------------------

interface RecruiterEnrichmentRow {
  id: string;
  summary_of_prior_comms: string | null;
  hubspot_url: string | null;
}

interface ContactStateRow {
  contact_id: string;
  status: string | null;
  next_action_due_date: string | null;
}

interface TouchRow {
  id: string;
  contact_id: string;
  channel: string | null;
  direction: string | null;
  touched_at: string;
  brief: string | null;
}

export async function getCommunicationsData(): Promise<CommunicationsContact[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];

  try {
    const sbPublic = createPublicServiceRoleClient();
    const sbJasonos = createServiceRoleClient();

    // 1. Unified contact source — Phase 2/3 canonical store.
    const people = await getOutreachPeople();
    if (!people.length) return [];

    // 2. Map every contact to its recruiter-pipeline link (when present)
    //    so we know which rows still get the richer pipeline enrichment.
    const allIds = people.map((p) => p.id);
    const { data: rpidRows } = await sbJasonos
      .from("contacts")
      .select("id, source_ids")
      .in("id", allIds);

    const contactToRpid = new Map<string, string>();
    for (const row of rpidRows ?? []) {
      const si = row.source_ids as Record<string, unknown> | null;
      const rpid = si?.recruiter_pipeline_id;
      if (typeof rpid === "string" && rpid.length > 0) {
        contactToRpid.set(row.id as string, rpid);
      }
    }
    const recruiterIds = Array.from(new Set(contactToRpid.values()));

    // 3. Inclusion criteria — keep this aligned with the spec:
    //    - cadence_interval != 'none' AND next_touch_date set, OR
    //    - next_touch_date set on its own (one-off scheduled touch), OR
    //    - intent in {warm, specific, cold} (explicitly placed in queue), OR
    //    - has a recruiter pipeline link (preserves legacy Schedule
    //      behavior — every triaged recruiter still surfaces here).
    //    Backrow contacts are universally excluded.
    const eligible = people.filter((p) => {
      if (p.intent === "backrow") return false;
      if (p.cadence_interval !== "none" && p.next_touch_date) return true;
      if (p.next_touch_date) return true;
      if (p.intent) return true;
      if (contactToRpid.has(p.id)) return true;
      return false;
    });
    if (!eligible.length) return [];

    // 4. Pull recruiter-side enrichment + state + touches in parallel,
    //    plus the cadence-card lookup needed for non-recruiter dismiss /
    //    schedule actions.
    const today = startOfToday();
    const ninetyDaysAgo = addDays(today, -90);

    const recruiterPromise = recruiterIds.length
      ? sbPublic
          .from("rr_recruiters")
          .select("id,summary_of_prior_comms,hubspot_url")
          .in("id", recruiterIds)
      : Promise.resolve({ data: [] as RecruiterEnrichmentRow[] });

    const statePromise = recruiterIds.length
      ? sbPublic
          .from("rr_contact_state")
          .select("contact_id,status,next_action_due_date")
          .in("contact_id", recruiterIds)
      : Promise.resolve({ data: [] as ContactStateRow[] });

    const touchesPromise = recruiterIds.length
      ? sbPublic
          .from("rr_touches")
          .select("id,contact_id,channel,direction,touched_at,brief")
          .in("contact_id", recruiterIds)
          .gte("touched_at", ninetyDaysAgo.toISOString())
          .order("touched_at", { ascending: false })
      : Promise.resolve({ data: [] as TouchRow[] });

    const cardsPromise = sbJasonos
      .from("cards")
      .select("id, linked_object_ids")
      .eq("module", "reconnect")
      .eq("object_type", "cadence_contact")
      .eq("state", "open");

    const [
      { data: recruiterRows },
      { data: stateRows },
      { data: touchRows },
      { data: cardRows },
    ] = await Promise.all([
      recruiterPromise,
      statePromise,
      touchesPromise,
      cardsPromise,
    ]);

    const recruiterMap = new Map<string, RecruiterEnrichmentRow>();
    for (const r of (recruiterRows ?? []) as RecruiterEnrichmentRow[]) {
      recruiterMap.set(r.id, r);
    }

    const stateMap = new Map<string, ContactStateRow>();
    for (const s of (stateRows ?? []) as ContactStateRow[]) {
      stateMap.set(s.contact_id, s);
    }

    const touchesByRpid = new Map<string, TouchRow[]>();
    for (const t of (touchRows ?? []) as TouchRow[]) {
      const arr = touchesByRpid.get(t.contact_id) ?? [];
      arr.push(t);
      touchesByRpid.set(t.contact_id, arr);
    }

    const cardByContactId = new Map<string, string>();
    for (const c of cardRows ?? []) {
      const linked = c.linked_object_ids as Record<string, unknown> | null;
      const cid = linked?.contact_id;
      if (typeof cid === "string") cardByContactId.set(cid, c.id as string);
    }

    // 5. Peer map — keyed by firm_normalized so non-recruiters at the same
    //    firm can also surface as peers in the right-rail card.
    const peersByFirm = new Map<string, OutreachPerson[]>();
    for (const p of eligible) {
      if (!p.firm_normalized) continue;
      const arr = peersByFirm.get(p.firm_normalized) ?? [];
      arr.push(p);
      peersByFirm.set(p.firm_normalized, arr);
    }

    const threeDaysAgo = addDays(today, -3);

    // 6. Build the CommunicationsContact[] result.
    const contacts: CommunicationsContact[] = [];
    for (const p of eligible) {
      const rpid = contactToRpid.get(p.id) ?? null;
      const state = rpid ? stateMap.get(rpid) ?? null : null;

      // Preserve the existing "dismiss recruiter" behavior — once a
      // recruiter is marked dismissed in rr_contact_state, they stay out
      // of the queue.
      if (rpid && state?.status === "dismissed") continue;

      const recruiter = rpid ? recruiterMap.get(rpid) ?? null : null;
      const contactTouches = rpid ? touchesByRpid.get(rpid) ?? [] : [];

      let lastTouch: CommTouch | null = null;
      let recentTouches: CommTouch[] = [];
      let contactedToday = false;
      let recentlyContacted = false;

      if (contactTouches.length) {
        const top = contactTouches[0];
        lastTouch = {
          id: top.id,
          channel: toCommChannel(top.channel),
          direction: (top.direction ?? "outbound") as "inbound" | "outbound",
          touched_at: top.touched_at,
          brief: top.brief ?? null,
        };
        recentTouches = contactTouches.slice(0, 5).map((t) => ({
          id: t.id,
          channel: toCommChannel(t.channel),
          direction: (t.direction ?? "outbound") as "inbound" | "outbound",
          touched_at: t.touched_at,
          brief: t.brief ?? null,
        }));
        contactedToday = contactTouches.some(
          (t) =>
            t.direction === "outbound" && new Date(t.touched_at) >= today
        );
        recentlyContacted = contactTouches.some(
          (t) =>
            t.direction === "outbound" &&
            new Date(t.touched_at) >= threeDaysAgo
        );
      } else if (p.last_touch_date) {
        const synth = new Date(`${p.last_touch_date}T00:00:00`);
        lastTouch = {
          id: `contact-${p.id}-last`,
          channel: toCommChannel(p.last_touch_channel),
          direction: "outbound",
          touched_at: synth.toISOString(),
          brief: null,
        };
        recentTouches = [lastTouch];
        contactedToday = synth >= today;
        recentlyContacted = synth >= threeDaysAgo;
      }

      // Prefer rr_contact_state.next_action_due_date when the recruiter
      // pipeline owns the schedule (legacy behavior). Otherwise fall back
      // to jasonos.contacts.next_touch_date — the canonical Phase 1+ field.
      const nextActionDueDate =
        state?.next_action_due_date ?? p.next_touch_date ?? null;

      const peers: CommPeer[] = (p.firm_normalized
        ? peersByFirm.get(p.firm_normalized) ?? []
        : []
      )
        .filter((peer) => peer.id !== p.id)
        .slice(0, 5)
        .map((peer) => ({
          // Mirror the contact-id convention used below: recruiter-linked
          // peers expose their rr_recruiters.id so peer-click drills into
          // the same row that getCommunicationsData() returns.
          id: contactToRpid.get(peer.id) ?? peer.id,
          name: peer.name,
          title: peer.title ?? null,
          firm: peer.firm ?? null,
        }));

      contacts.push({
        // Recruiter-linked rows expose rr_recruiters.id so the existing
        // server actions (dismissCommunicationContact, scheduleNextTouch,
        // getLastContactContents, getFirmmates) keep working unchanged.
        // Non-recruiter rows expose jasonos.contacts.id — the canonical
        // identifier for everything else.
        id: rpid ?? p.id,
        name: p.name,
        title: p.title ?? null,
        firm: p.firm ?? null,
        firm_normalized: p.firm_normalized ?? null,
        firm_focus_rank: p.firm_focus_rank ?? null,
        strength: normalizeStrength(p.strategic_score),
        urgency: computeUrgency(
          nextActionDueDate,
          contactedToday,
          recentlyContacted
        ),
        lastTouch,
        recentTouches,
        nextActionDueDate,
        summaryOfPriorComms: recruiter?.summary_of_prior_comms ?? null,
        peers,
        hubspot_url: recruiter?.hubspot_url ?? null,
        source: rpid ? "recruiter" : "cadence",
        cadenceCardId: rpid ? null : cardByContactId.get(p.id) ?? null,
        cadenceInterval: p.cadence_interval ?? null,
      });
    }

    return contacts;
  } catch (err) {
    console.error("[communications] getCommunicationsData failed", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Post a Dispatch (Claude Cowork) request — service-role bypass so the
// Communications page works without requiring Supabase auth session.
// ---------------------------------------------------------------------------

export async function postDispatchRequest(input: {
  requestType: string;
  context: Record<string, unknown>;
  sourcePage: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "supabase_not_configured" };
  }

  try {
    // Need the admin client (service role) to both list users and bypass RLS.
    const admin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Single-user app: find the first user in auth.users to use as owner_id.
    const { data: users, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1 });
    if (usersError || !users?.users?.length) {
      return { ok: false, error: "no_user_found — make sure at least one user exists in Supabase Auth" };
    }
    const ownerId = users.users[0].id;

    const { error } = await admin.from("dispatch_requests").insert({
      owner_id: ownerId,
      request_type: input.requestType,
      context: input.context,
      source_page: input.sourcePage,
    });

    if (error) {
      console.error("[communications] dispatch insert failed", error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    console.error("[communications] postDispatchRequest failed", err);
    return { ok: false, error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Dismiss contact
// ---------------------------------------------------------------------------

export async function dismissCommunicationContact(contactId: string): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const sb = createPublicServiceRoleClient();
  await sb.from("rr_contact_state").upsert(
    {
      contact_id: contactId,
      status: "dismissed",
      status_updated_at: new Date().toISOString(),
    },
    { onConflict: "contact_id" }
  );
  revalidatePath("/communications");
}

// ---------------------------------------------------------------------------
// setContactCadence — canonical write for the Schedule page's Cadence picker.
//
// Accepts either a jasonos.contacts.id OR an rr_recruiters.id (the
// CommunicationsContact.id is heterogeneous: rpid for recruiter-linked rows,
// jasonos.contacts.id otherwise). Resolves to the canonical contact row,
// then delegates to setCadence(), which:
//   - Updates contacts.cadence_interval
//   - Recomputes contacts.next_touch_date to today + CADENCE_DAYS[interval]
//     (or null when interval === "none")
//   - Mirrors next_action_due_date in rr_contact_state for recruiter-linked
//     contacts so the recruiter pipeline view stays in sync
//   - Revalidates /outreach/queue, /outreach/schedule, /outreach/people, and
//     legacy /communications + /reconnect paths
// ---------------------------------------------------------------------------

export async function setContactCadence(
  idOrRpid: string,
  cadence: CadenceIntervalType
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "Supabase service role is not configured." };
  }
  if (!idOrRpid) return { ok: false, error: "contactId is required." };

  const sb = createServiceRoleClient();

  let contactId: string | null = null;
  const direct = await sb
    .from("contacts")
    .select("id")
    .eq("id", idOrRpid)
    .maybeSingle();
  if (direct.data) {
    contactId = direct.data.id as string;
  } else {
    const lookup = await sb
      .from("contacts")
      .select("id")
      .filter("source_ids->>recruiter_pipeline_id", "eq", idOrRpid)
      .limit(1)
      .maybeSingle();
    contactId = (lookup.data?.id as string | undefined) ?? null;
  }

  if (!contactId) return { ok: false, error: "Contact not found." };

  return setCadence(contactId, cadence);
}

// ---------------------------------------------------------------------------
// Schedule next touch (legacy preset-driven actions — kept for backwards
// compat; the canonical write is setContactCadence above).
// ---------------------------------------------------------------------------

type ScheduleOption =
  | "asap"
  | "next_week"
  | "2_weeks"
  | "1_month"
  | "3_months"
  | "custom";

function dueDateFromOption(option: ScheduleOption, customDate?: string): string {
  const today = startOfToday();
  switch (option) {
    case "asap":
      return today.toISOString().split("T")[0];
    case "next_week":
      return addDays(today, 7).toISOString().split("T")[0];
    case "2_weeks":
      return addDays(today, 14).toISOString().split("T")[0];
    case "1_month":
      return addDays(today, 30).toISOString().split("T")[0];
    case "3_months":
      return addDays(today, 90).toISOString().split("T")[0];
    case "custom":
      return customDate ?? addDays(today, 14).toISOString().split("T")[0];
  }
}

/**
 * @deprecated Use {@link setContactCadence} instead. This action writes a
 * one-off `next_action_due_date` to `rr_contact_state` from a hard-coded
 * preset (asap/next_week/2_weeks/1_month/3_months) and does NOT update
 * `cadence_interval`. The Schedule picker is now cadence-driven; new
 * callers should set the canonical `cadence_interval` and let
 * `next_touch_date` follow.
 */
export async function scheduleNextTouch(
  contactId: string,
  option: ScheduleOption,
  customDate?: string
): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const sb = createPublicServiceRoleClient();
  const dueDate = dueDateFromOption(option, customDate);
  await sb.from("rr_contact_state").upsert(
    {
      contact_id: contactId,
      next_action_due_date: dueDate,
      status_updated_at: new Date().toISOString(),
    },
    { onConflict: "contact_id" }
  );
  revalidatePath("/communications");
  revalidatePath("/outreach/schedule");
}

/**
 * @deprecated Use {@link setContactCadence} instead. Writes a one-off
 * `next_touch_date` directly to `jasonos.contacts` from a preset without
 * touching `cadence_interval`, so the picker drifts out of sync with the
 * canonical cadence on the next render.
 */
export async function scheduleContactNextTouch(
  contactId: string,
  option: ScheduleOption,
  customDate?: string
): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const sb = createServiceRoleClient();
  const dueDate = dueDateFromOption(option, customDate);
  await sb
    .from("contacts")
    .update({ next_touch_date: dueDate })
    .eq("id", contactId);
  revalidatePath("/communications");
  revalidatePath("/outreach/schedule");
}

// ---------------------------------------------------------------------------
// dismissContactFromSchedule — set intent='backrow' on a non-recruiter
// contact so the unified inclusion criteria removes it from /outreach/schedule
// on next load. Recruiter-linked contacts keep using
// dismissCommunicationContact (rr_contact_state.status='dismissed').
// ---------------------------------------------------------------------------

export async function dismissContactFromSchedule(contactId: string): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const sb = createServiceRoleClient();
  await sb.from("contacts").update({ intent: "backrow" }).eq("id", contactId);
  revalidatePath("/communications");
  revalidatePath("/outreach/schedule");
}

// ---------------------------------------------------------------------------
// syncSentToday — in-process Gmail + HubSpot sync, writes rr_touches rows
// Requires migration 0011 to be applied first (adds source/external_id cols).
// ---------------------------------------------------------------------------

interface TouchUpsert {
  contact_id: string;
  channel: "email";
  direction: "outbound";
  touched_at: string;
  brief: string;
  subject: string | null;
  source: "gmail" | "hubspot";
  external_id: string;
  thread_url: string | null;
}

interface TriagedRecruiter {
  recruiterId: string;
  name: string;
  primaryEmail: string | null;
  hubspotContactId: string | null;
}

async function getActiveTriagedRecruitersWithEmail(): Promise<TriagedRecruiter[]> {
  const sbPublic = createPublicServiceRoleClient();
  const sbJasonos = createServiceRoleClient();

  const [{ data: recruiters }, { data: dismissedStates }] = await Promise.all([
    sbPublic.from("rr_recruiters").select("id,name,hubspot_contact_id"),
    sbPublic.from("rr_contact_state").select("contact_id").eq("status", "dismissed"),
  ]);

  if (!recruiters?.length) return [];

  const dismissedIds = new Set((dismissedStates ?? []).map((s) => s.contact_id as string));
  const active = recruiters.filter((r) => !dismissedIds.has(r.id as string));
  if (!active.length) return [];

  // Resolve primary email from jasonos.contacts via source_ids->>'recruiter_pipeline_id'
  const { data: contacts } = await sbJasonos
    .from("contacts")
    .select("emails,source_ids")
    .not("source_ids->>recruiter_pipeline_id", "is", null);

  const rpIdToEmail = new Map<string, string>();
  for (const c of contacts ?? []) {
    const si = c.source_ids as Record<string, unknown> | null;
    const rpId = typeof si?.recruiter_pipeline_id === "string" ? si.recruiter_pipeline_id : null;
    const email = (c.emails as string[] | null)?.[0] ?? null;
    if (rpId && email) rpIdToEmail.set(rpId, email);
  }

  return active.map((r) => ({
    recruiterId: r.id as string,
    name: r.name as string,
    primaryEmail: rpIdToEmail.get(r.id as string) ?? null,
    hubspotContactId: (r.hubspot_contact_id as string | null) ?? null,
  }));
}

function isFromMe(fromHeader: string): boolean {
  const lower = fromHeader.toLowerCase();
  return MY_EMAILS.some((e) => lower.includes(e));
}

function extractEmail(value: string): string {
  const m = value.match(/<([^>]+)>/);
  return (m?.[1] ?? value).trim().toLowerCase();
}

/** Returns the display name part of a "Name <email>" header, lower-cased. */
function extractDisplayName(value: string): string {
  const m = value.match(/^([^<]+)<[^>]+>/);
  return (m?.[1] ?? "").trim().replace(/^"|"$/g, "").toLowerCase();
}

/** Normalize a full name for fuzzy comparison: lowercase, collapse spaces. */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function oneLineSnippet(body: string | null | undefined): string {
  if (!body) return "";
  return body.replace(/\s+/g, " ").trim().slice(0, 200);
}

export interface SyncSentTodayResult {
  ok: boolean;
  written: number;
  gmail: number;
  hubspot: number;
  skippedUnmatched: number;
  skippedDetails?: Array<{ to: string; subject?: string }>;
  error?: string;
}

export async function syncSentToday(): Promise<SyncSentTodayResult> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, written: 0, gmail: 0, hubspot: 0, skippedUnmatched: 0, error: "supabase_not_configured" };
  }

  const sbPublic = createPublicServiceRoleClient();
  const today = startOfToday();
  const todayEpoch = Math.floor(today.getTime() / 1000);

  // Quick check: is a Google token stored?
  const gmailOk = await isGmailConnected();
  if (!gmailOk) {
    return {
      ok: false,
      written: 0,
      gmail: 0,
      hubspot: 0,
      skippedUnmatched: 0,
      error: "gmail_not_connected",
    };
  }

  const triaged = await getActiveTriagedRecruitersWithEmail();
  if (!triaged.length) {
    return { ok: true, written: 0, gmail: 0, hubspot: 0, skippedUnmatched: 0 };
  }

  const emailToRecruiter = new Map<string, TriagedRecruiter>(
    triaged
      .filter((r) => r.primaryEmail)
      .map((r) => [r.primaryEmail!.toLowerCase(), r])
  );

  // Fallback: match by full name when email isn't linked in jasonos.contacts
  const nameToRecruiter = new Map<string, TriagedRecruiter>(
    triaged.map((r) => [normalizeName(r.name), r])
  );

  function findRecruiter(toHeader: string): TriagedRecruiter | undefined {
    const email = extractEmail(toHeader);

    // 1. Match by linked email in jasonos.contacts
    const byEmail = emailToRecruiter.get(email);
    if (byEmail) return byEmail;

    // 2. Match by display name from "Name <email>" header
    const displayName = extractDisplayName(toHeader);
    if (displayName) {
      const byDisplay = nameToRecruiter.get(displayName);
      if (byDisplay) return byDisplay;
    }

    // 3. Derive name from email username (jennifer.fisher@… → "jennifer fisher")
    const username = email.split("@")[0] ?? "";
    const nameFromEmail = username.replace(/[._\-+]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    if (nameFromEmail) return nameToRecruiter.get(nameFromEmail);

    return undefined;
  }

  let skippedUnmatched = 0;
  const skippedDetails: Array<{ to: string; subject?: string }> = [];

  // --- Gmail ---
  const gmailRows: TouchUpsert[] = [];
  try {
    const threads = await searchGmailThreads({
      query: `in:sent after:${todayEpoch}`,
      pageSize: 50,
    });

    for (const t of threads) {
      const full = await getGmailThread(t.id);
      if (!full) continue;

      for (const m of full.messages) {
        // Only my outbound messages sent today (fixed: must have from header AND be from me)
        if (!m.from || !isFromMe(m.from)) continue;
        if (!m.date || new Date(m.date).getTime() < today.getTime()) continue;
        // Skip emails sent to myself (job alerts, auto-forwards, etc.)
        if (m.to && isMyOwnAddress(m.to)) continue;

        const recruiter = findRecruiter(m.to ?? "");
        if (!recruiter) {
          skippedUnmatched++;
          skippedDetails.push({ to: m.to ?? "(no to header)", subject: m.subject ?? undefined });
          continue;
        }

        gmailRows.push({
          contact_id: recruiter.recruiterId,
          channel: "email",
          direction: "outbound",
          touched_at: new Date(m.date).toISOString(),
          brief: oneLineSnippet(m.plaintextBody) || m.snippet || "Email sent",
          subject: m.subject ?? null,
          source: "gmail",
          external_id: m.id,
          thread_url: `https://mail.google.com/mail/u/0/#all/${t.id}`,
        });
      }
    }
  } catch (err) {
    console.error("[communications] gmail sync failed", err);
  }

  // --- HubSpot ---
  const hubspotRows: TouchUpsert[] = [];
  try {
    await Promise.all(
      triaged
        .filter((r) => r.hubspotContactId)
        .map(async (r) => {
          const acts = await getHubSpotContactActivities(r.hubspotContactId!, { limit: 5 });
          for (const a of acts) {
            if (a.type !== "email") continue;
            if (!a.createdAt || new Date(a.createdAt).getTime() < today.getTime()) continue;
            hubspotRows.push({
              contact_id: r.recruiterId,
              channel: "email",
              direction: "outbound",
              touched_at: new Date(a.createdAt).toISOString(),
              brief: oneLineSnippet(a.body) || a.subject || "Email",
              subject: a.subject ?? null,
              source: "hubspot",
              external_id: a.id,
              thread_url: null,
            });
          }
        })
    );
  } catch (err) {
    console.error("[communications] hubspot sync failed", err);
  }

  // --- Insert with pre-check dedup ---
  // The unique index `rr_touches_source_external_id_uniq` (migration 0011) is
  // *partial* — it only applies WHERE source IS NOT NULL AND external_id
  // IS NOT NULL. Postgres won't infer a partial unique index for ON CONFLICT
  // unless the same WHERE predicate is restated, and Supabase's .upsert() has
  // no way to pass that predicate. So we mirror the NOT EXISTS pre-check
  // pattern used for jasonos.contact_touches in 0014. The partial unique
  // index stays as defense-in-depth against two sync workers racing.
  const allRows = [...gmailRows, ...hubspotRows];
  let written = 0;

  if (allRows.length) {
    try {
      const sources = Array.from(new Set(allRows.map((r) => r.source)));
      const externalIds = Array.from(
        new Set(allRows.map((r) => r.external_id))
      );

      const { data: existingRows, error: preErr } = await sbPublic
        .from("rr_touches")
        .select("source, external_id")
        .in("source", sources)
        .in("external_id", externalIds);

      if (preErr) {
        return {
          ok: false,
          written: 0,
          gmail: gmailRows.length,
          hubspot: hubspotRows.length,
          skippedUnmatched,
          error: `pre-check: ${preErr.message}`,
        };
      }

      const existingKeys = new Set<string>();
      for (const row of existingRows ?? []) {
        const src = (row as { source: string | null }).source;
        const ext = (row as { external_id: string | null }).external_id;
        if (src && ext) existingKeys.add(`${src}::${ext}`);
      }

      const newRows = allRows.filter(
        (r) => !existingKeys.has(`${r.source}::${r.external_id}`)
      );

      if (newRows.length) {
        const { data, error } = await sbPublic
          .from("rr_touches")
          .insert(newRows)
          .select("id");

        if (error) {
          const hint = error.message.includes("column")
            ? " — Apply migration 0011 in Supabase Dashboard SQL Editor first."
            : "";
          return {
            ok: false,
            written: 0,
            gmail: gmailRows.length,
            hubspot: hubspotRows.length,
            skippedUnmatched,
            error: error.message + hint,
          };
        }
        written = data?.length ?? 0;
      }
    } catch (err) {
      return {
        ok: false,
        written: 0,
        gmail: gmailRows.length,
        hubspot: hubspotRows.length,
        skippedUnmatched,
        error: String(err),
      };
    }
  }

  revalidatePath("/communications");
  return { ok: true, written, gmail: gmailRows.length, hubspot: hubspotRows.length, skippedUnmatched, skippedDetails: skippedDetails.length ? skippedDetails : undefined };
}

// ---------------------------------------------------------------------------
// getLastContactContents — lazy-load most recent email body for right column
// ---------------------------------------------------------------------------

export interface LastContactContents {
  source: "gmail" | "hubspot";
  subject: string | null;
  body: string;
  sentAt: string;
  direction: "inbound" | "outbound";
  threadUrl: string | null;
}

async function getRecruiterCommsContext(
  recruiterId: string
): Promise<{ primaryEmail: string | null; hubspotContactId: string | null } | null> {
  const sbPublic = createPublicServiceRoleClient();
  const sbJasonos = createServiceRoleClient();

  const { data: recruiter } = await sbPublic
    .from("rr_recruiters")
    .select("hubspot_contact_id")
    .eq("id", recruiterId)
    .maybeSingle();

  if (!recruiter) return null;

  const { data: contact } = await sbJasonos
    .from("contacts")
    .select("emails")
    .filter("source_ids->>recruiter_pipeline_id", "eq", recruiterId)
    .limit(1)
    .maybeSingle();

  return {
    primaryEmail: (contact?.emails as string[] | null)?.[0] ?? null,
    hubspotContactId: (recruiter.hubspot_contact_id as string | null) ?? null,
  };
}

async function fetchGmailLatest(email: string | null): Promise<LastContactContents | null> {
  if (!email) return null;
  try {
    const threads = await searchGmailThreads({
      query: `from:${email} OR to:${email}`,
      pageSize: 1,
    });
    if (!threads.length) return null;
    const full = await getGmailThread(threads[0].id);
    if (!full?.messages?.length) return null;

    const last = full.messages[full.messages.length - 1];
    const direction: "inbound" | "outbound" =
      last.from && isFromMe(last.from) ? "outbound" : "inbound";

    return {
      source: "gmail",
      subject: last.subject ?? null,
      body: (last.plaintextBody || last.snippet || "").slice(0, 3000),
      sentAt: last.date ? new Date(last.date).toISOString() : new Date().toISOString(),
      direction,
      threadUrl: `https://mail.google.com/mail/u/0/#all/${threads[0].id}`,
    };
  } catch {
    return null;
  }
}

async function fetchHubspotLatest(hubspotContactId: string | null): Promise<LastContactContents | null> {
  if (!hubspotContactId) return null;
  try {
    const acts = await getHubSpotContactActivities(hubspotContactId, { limit: 5 });
    const emails = acts.filter((a) => a.type === "email" && a.createdAt);
    if (!emails.length) return null;
    emails.sort((a, b) => Date.parse(b.createdAt!) - Date.parse(a.createdAt!));
    const top = emails[0];
    const portalId = process.env.HUBSPOT_PORTAL_ID;
    return {
      source: "hubspot",
      subject: top.subject ?? null,
      body: (top.body ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000),
      sentAt: new Date(top.createdAt!).toISOString(),
      direction: "outbound",
      threadUrl: portalId
        ? `https://app.hubspot.com/contacts/${portalId}/record/0-1/${hubspotContactId}/?engagement=${top.id}`
        : null,
    };
  } catch {
    return null;
  }
}

export async function getLastContactContents(
  recruiterId: string
): Promise<LastContactContents | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const ctx = await getRecruiterCommsContext(recruiterId);
  if (!ctx) return null;

  const [gmail, hubspot] = await Promise.allSettled([
    fetchGmailLatest(ctx.primaryEmail),
    fetchHubspotLatest(ctx.hubspotContactId),
  ]);

  const candidates: LastContactContents[] = [];
  if (gmail.status === "fulfilled" && gmail.value) candidates.push(gmail.value);
  if (hubspot.status === "fulfilled" && hubspot.value) candidates.push(hubspot.value);

  if (!candidates.length) return null;
  candidates.sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt));
  return candidates[0];
}
