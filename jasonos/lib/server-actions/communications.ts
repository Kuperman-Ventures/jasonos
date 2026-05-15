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
  if (diffDays <= 7) return "this_week";
  return "scheduled";
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getCommunicationsData(): Promise<CommunicationsContact[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];

  try {
    const sb = createPublicServiceRoleClient();

    const { data: recruiters, error } = await sb
      .from("rr_recruiters")
      .select(
        "id,name,firm,firm_normalized,title,strategic_score,last_contact_date,summary_of_prior_comms,hubspot_url,firm_focus_rank"
      )
      .order("strategic_score", { ascending: false });

    if (error) {
      console.error("[communications] rr_recruiters query failed", error);
    }
    if (!recruiters?.length) {
      // No recruiter pipeline rows — fall back to cadence-only contacts.
      return await getCadenceCommunicationsContacts();
    }

    const ids = recruiters.map((r) => r.id as string);
    const today = startOfToday();
    const ninetyDaysAgo = addDays(today, -90);

    const [{ data: states }, { data: touches }] = await Promise.all([
      sb
        .from("rr_contact_state")
        .select("contact_id,status,next_action_due_date")
        .in("contact_id", ids),
      sb
        .from("rr_touches")
        .select("id,contact_id,channel,direction,touched_at,brief")
        .in("contact_id", ids)
        .gte("touched_at", ninetyDaysAgo.toISOString())
        .order("touched_at", { ascending: false }),
    ]);

    const stateMap = new Map(
      (states ?? []).map((s) => [s.contact_id as string, s])
    );

    const touchesByContact = new Map<string, NonNullable<typeof touches>>();
    for (const t of touches ?? []) {
      const arr = touchesByContact.get(t.contact_id as string) ?? [];
      arr.push(t);
      touchesByContact.set(t.contact_id as string, arr);
    }

    // Build peer map by firm
    const firmMap = new Map<string, typeof recruiters>();
    for (const r of recruiters) {
      if (!r.firm) continue;
      const arr = firmMap.get(r.firm as string) ?? [];
      arr.push(r);
      firmMap.set(r.firm as string, arr);
    }

    const recruiterContacts: CommunicationsContact[] = recruiters
      .filter((r) => stateMap.get(r.id as string)?.status !== "dismissed")
      .map((r): CommunicationsContact => {
        const state = stateMap.get(r.id as string) ?? null;
        const contactTouches = touchesByContact.get(r.id as string) ?? [];

        const contactedToday = contactTouches.some(
          (t) =>
            t.direction === "outbound" && new Date(t.touched_at as string) >= today
        );

        const threeDaysAgo = addDays(today, -3);
        const recentlyContacted = contactTouches.some(
          (t) =>
            t.direction === "outbound" && new Date(t.touched_at as string) >= threeDaysAgo
        );

        const lastTouchRaw = contactTouches[0] ?? null;
        const lastTouch: CommTouch | null = lastTouchRaw
          ? {
              id: lastTouchRaw.id as string,
              channel: toCommChannel(lastTouchRaw.channel as string),
              direction: (lastTouchRaw.direction ?? "outbound") as "inbound" | "outbound",
              touched_at: lastTouchRaw.touched_at as string,
              brief: (lastTouchRaw.brief as string) ?? null,
            }
          : null;

        const recentTouches: CommTouch[] = contactTouches.slice(0, 5).map((t) => ({
          id: t.id as string,
          channel: toCommChannel(t.channel as string),
          direction: (t.direction ?? "outbound") as "inbound" | "outbound",
          touched_at: t.touched_at as string,
          brief: (t.brief as string) ?? null,
        }));

        const peers: CommPeer[] = (firmMap.get(r.firm as string) ?? [])
          .filter((p) => p.id !== r.id)
          .slice(0, 5)
          .map((p) => ({
            id: p.id as string,
            name: p.name as string,
            title: (p.title as string) ?? null,
            firm: (p.firm as string) ?? null,
          }));

        return {
          id: r.id as string,
          name: r.name as string,
          title: (r.title as string) ?? null,
          firm: (r.firm as string) ?? null,
          firm_normalized: (r.firm_normalized as string) ?? null,
          firm_focus_rank: (r.firm_focus_rank as number) ?? null,
          strength: normalizeStrength(r.strategic_score as number | null),
          urgency: computeUrgency(
            (state?.next_action_due_date as string) ?? null,
            contactedToday,
            recentlyContacted,
          ),
          lastTouch,
          recentTouches,
          nextActionDueDate: (state?.next_action_due_date as string) ?? null,
          summaryOfPriorComms: (r.summary_of_prior_comms as string) ?? null,
          peers,
          hubspot_url: (r.hubspot_url as string) ?? null,
          source: "recruiter" as const,
          cadenceCardId: null,
          cadenceInterval: null,
        };
      });

    // Merge in cadence contacts (added via the global "Add contact" sheet).
    // These live in jasonos.contacts + jasonos.cards, not the rr_* pipeline.
    const cadenceContacts = await getCadenceCommunicationsContacts();
    const recruiterIds = new Set(recruiterContacts.map((c) => c.id));
    const merged = [
      ...recruiterContacts,
      ...cadenceContacts.filter((c) => !recruiterIds.has(c.id)),
    ];
    return merged;
  } catch (err) {
    console.error("[communications] getCommunicationsData failed", err);
    return [];
  }
}

async function getCadenceCommunicationsContacts(): Promise<CommunicationsContact[]> {
  try {
    const sb = createServiceRoleClient();
    const { data: cards, error } = await sb
      .from("cards")
      .select("id,title,subtitle,body,linked_object_ids,state,created_at")
      .eq("module", "reconnect")
      .eq("object_type", "cadence_contact")
      .eq("state", "open");

    if (error) {
      console.error("[communications] cadence cards query failed", error);
      return [];
    }
    if (!cards?.length) return [];

    const contactIds = cards
      .map((c) => {
        const linked = c.linked_object_ids as Record<string, unknown> | null;
        const id = linked?.contact_id;
        return typeof id === "string" ? id : null;
      })
      .filter((id): id is string => Boolean(id));

    if (!contactIds.length) return [];

    const { data: contacts } = await sb
      .from("contacts")
      .select("id,name,title,linkedin_url,emails,tags,last_touch_date,last_touch_channel,notes")
      .in("id", contactIds);

    const contactsById = new Map(
      (contacts ?? []).map((c) => [c.id as string, c])
    );
    const today = startOfToday();

    return cards
      .map((card): CommunicationsContact | null => {
        const linked = card.linked_object_ids as Record<string, unknown> | null;
        const contactId = typeof linked?.contact_id === "string" ? linked.contact_id : null;
        if (!contactId) return null;
        const contact = contactsById.get(contactId);
        if (!contact) return null;

        const body = (card.body as
          | {
              cadence_interval?: CadenceIntervalType;
              next_touch_date?: string | null;
              notes?: string | null;
              firm?: string | null;
            }
          | null) ?? {};
        const cadenceInterval = (body.cadence_interval as CadenceIntervalType) ?? "none";
        const nextDue = typeof body.next_touch_date === "string" ? body.next_touch_date : null;

        const lastTouchDate = (contact.last_touch_date as string | null) ?? null;
        const lastTouchChannel = toCommChannel(contact.last_touch_channel as string | null);
        const lastTouch: CommTouch | null = lastTouchDate
          ? {
              id: `cadence-${card.id as string}-last`,
              channel: lastTouchChannel,
              direction: "outbound",
              touched_at: new Date(`${lastTouchDate}T00:00:00`).toISOString(),
              brief: (contact.notes as string | null) ?? null,
            }
          : null;

        const contactedToday = lastTouchDate
          ? new Date(`${lastTouchDate}T00:00:00`) >= today
          : false;
        const recentlyContacted = lastTouchDate
          ? new Date(`${lastTouchDate}T00:00:00`) >= addDays(today, -3)
          : false;

        return {
          id: contactId,
          name: (contact.name as string) ?? (card.title as string) ?? "Untitled",
          title: (contact.title as string) ?? null,
          firm: body.firm ?? null,
          firm_normalized: body.firm ? body.firm.toLowerCase() : null,
          firm_focus_rank: null,
          strength: 1,
          urgency: computeUrgency(nextDue, contactedToday, recentlyContacted),
          lastTouch,
          recentTouches: lastTouch ? [lastTouch] : [],
          nextActionDueDate: nextDue,
          summaryOfPriorComms: (body.notes as string | null) ?? (contact.notes as string | null) ?? null,
          peers: [],
          hubspot_url: null,
          source: "cadence",
          cadenceCardId: card.id as string,
          cadenceInterval,
        };
      })
      .filter((c): c is CommunicationsContact => c !== null);
  } catch (err) {
    console.error("[communications] getCadenceCommunicationsContacts failed", err);
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
// Schedule next touch
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

  // --- Upsert ---
  const allRows = [...gmailRows, ...hubspotRows];
  let written = 0;

  if (allRows.length) {
    try {
      const { data, error } = await sbPublic
        .from("rr_touches")
        .upsert(allRows, { onConflict: "source,external_id", ignoreDuplicates: true })
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
