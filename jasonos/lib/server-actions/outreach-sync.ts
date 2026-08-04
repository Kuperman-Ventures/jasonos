"use server";

import { revalidatePath } from "next/cache";
import {
  searchGmailThreads,
  getGmailThread,
  isGmailConnected,
} from "@/lib/integrations/gmail";
import { getGoogleAccessToken } from "@/lib/integrations/google-calendar";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  buildContactLookup,
  canonicalEmail,
  extractEmail,
  isFromMe,
  isMyOwnAddress,
  type ContactLookupRow,
} from "@/lib/outreach/email-matching";
import {
  insertContactTouches,
  recordSyncState,
  type ContactTouchInput,
  type InsertTouchesResult,
} from "@/lib/outreach/touch-capture";

// ---------------------------------------------------------------------------
// Email write-back — when a sync matches a contact (typically by NAME, e.g. a
// spreadsheet-imported contact with no email on file) using an address that
// isn't yet on the contact, record it so we can attach it. This binds future
// email/calendar activity to that same canonical contact instead of drifting
// onto a duplicate, and stops the Suggested-Contacts scan from re-suggesting.
// ---------------------------------------------------------------------------

type EnrichMap = Map<string, { existing: string[]; adds: string[] }>;

function recordEnrich(
  enrich: EnrichMap,
  contact: ContactLookupRow,
  rawEmail: string
): void {
  const email = extractEmail(rawEmail);
  if (!email || isMyOwnAddress(email)) return;
  const canon = canonicalEmail(email);
  if (contact.emails.some((e) => canonicalEmail(e) === canon)) return;
  const cur = enrich.get(contact.id) ?? { existing: contact.emails, adds: [] };
  if (!cur.adds.some((a) => canonicalEmail(a) === canon)) cur.adds.push(email);
  enrich.set(contact.id, cur);
}

function mergeEmails(existing: string[], adds: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of [...existing, ...adds]) {
    if (!e) continue;
    const key = canonicalEmail(e);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

async function applyEmailEnrichments(enrich: EnrichMap): Promise<void> {
  if (!enrich.size) return;
  const sb = createServiceRoleClient();
  for (const [contactId, { existing, adds }] of enrich) {
    if (!adds.length) continue;
    await sb
      .from("contacts")
      .update({ emails: mergeEmails(existing, adds) })
      .eq("id", contactId)
      .then(
        () => undefined,
        (err) => console.error("[outreach-sync.emailEnrich]", err)
      );
  }
}

export type SyncResultSource = "gmail" | "gcal";

export interface SyncResult {
  ok: boolean;
  source: SyncResultSource;
  matched: number;
  inserted: number;
  duplicates: number;
  cadenceUpdates: number;
  skipped: number;
  error?: string;
}

export interface SyncAllResult {
  ok: boolean;
  ranAt: string;
  gmail: SyncResult | null;
  gcal: SyncResult | null;
}

// ---------------------------------------------------------------------------
// Gmail sync — captures outbound emails from the last `daysBack` days.
// ---------------------------------------------------------------------------

export async function syncOutreachFromGmail(opts?: {
  daysBack?: number;
}): Promise<SyncResult> {
  const daysBack = Math.max(1, Math.min(30, opts?.daysBack ?? 7));

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return errorResult("gmail", "Supabase service role is not configured.");
  }
  const gmailReady = await isGmailConnected();
  if (!gmailReady) return errorResult("gmail", "Gmail is not connected.");

  const lookup = await buildContactLookup();
  if (!lookup.rows.length) {
    await recordSyncState("gmail", { written: 0, matched: 0, skipped: 0 });
    return okResult("gmail", emptyInsertResult(), 0, 0);
  }

  const afterEpoch = Math.floor((Date.now() - daysBack * 86_400_000) / 1000);
  const touches: ContactTouchInput[] = [];
  const enrich: EnrichMap = new Map();
  let skipped = 0;

  try {
    const threads = await searchGmailThreads({
      query: `in:sent after:${afterEpoch}`,
      pageSize: 100,
    });

    for (const t of threads) {
      const full = await getGmailThread(t.id);
      if (!full) continue;

      for (const m of full.messages) {
        if (!m.from || !isFromMe(m.from)) continue;
        if (!m.date) continue;
        if (new Date(m.date).getTime() < Date.now() - daysBack * 86_400_000) continue;
        if (!m.to) continue;
        if (isMyOwnAddress(m.to)) continue;

        const contact = lookup.resolve(m.to);
        if (!contact) {
          skipped += 1;
          continue;
        }
        recordEnrich(enrich, contact, m.to);

        touches.push({
          contact_id: contact.id,
          channel: "email",
          direction: "outbound",
          touched_at: new Date(m.date).toISOString(),
          source: "gmail",
          external_id: m.id,
          brief: oneLine(m.plaintextBody) || m.snippet || "Email sent",
          subject: m.subject ?? null,
          thread_url: `https://mail.google.com/mail/u/0/#all/${t.id}`,
        });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordSyncState("gmail", { error: msg });
    return errorResult("gmail", msg);
  }

  const insertResult = await insertContactTouches(touches);
  await applyEmailEnrichments(enrich);
  await recordSyncState("gmail", {
    matched: touches.length,
    inserted: insertResult.inserted,
    duplicates: insertResult.duplicates,
    cadenceUpdates: insertResult.cadenceUpdates,
    skipped,
    errors: insertResult.errors,
  });
  revalidatePaths();
  return okResult("gmail", insertResult, touches.length, skipped);
}

// ---------------------------------------------------------------------------
// Calendar sync — captures meetings from the last `daysBack` days and the
// next `daysForward` days where any attendee resolves to a contact. Uses the
// primary calendar via the existing Google OAuth token. Upcoming meetings are
// stored for the contact Meetings tab but do not advance cadence until past.
// ---------------------------------------------------------------------------

interface RawGCalEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email?: string; displayName?: string; self?: boolean; responseStatus?: string }[];
  htmlLink?: string;
  status?: string;
}

export async function syncOutreachFromCalendar(opts?: {
  daysBack?: number;
  /** How far ahead to pull upcoming meetings onto contact Meeting tabs. */
  daysForward?: number;
}): Promise<SyncResult> {
  const daysBack = Math.max(1, Math.min(60, opts?.daysBack ?? 30));
  const daysForward = Math.max(0, Math.min(60, opts?.daysForward ?? 30));

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return errorResult("gcal", "Supabase service role is not configured.");
  }
  const token = await getGoogleAccessToken();
  if (!token) return errorResult("gcal", "Google Calendar is not connected.");

  const lookup = await buildContactLookup();
  if (!lookup.rows.length) {
    await recordSyncState("gcal", { matched: 0 });
    return okResult("gcal", emptyInsertResult(), 0, 0);
  }

  const now = Date.now();
  const timeMin = new Date(now - daysBack * 86_400_000).toISOString();
  const timeMax = new Date(now + daysForward * 86_400_000).toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  let raw: { items?: RawGCalEvent[] } = {};
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      const msg = `GCal ${res.status} :: ${txt.slice(0, 200)}`;
      await recordSyncState("gcal", { error: msg });
      return errorResult("gcal", msg);
    }
    raw = await res.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordSyncState("gcal", { error: msg });
    return errorResult("gcal", msg);
  }

  const events = raw.items ?? [];
  const touches: ContactTouchInput[] = [];
  const enrich: EnrichMap = new Map();
  let skipped = 0;

  for (const ev of events) {
    if (ev.status === "cancelled") continue;
    // Timed events preferred; all-day events use date-only (store as local midnight).
    const startISO = ev.start?.dateTime
      ? new Date(ev.start.dateTime).toISOString()
      : ev.start?.date
        ? new Date(`${ev.start.date}T12:00:00`).toISOString()
        : null;
    if (!startISO) continue;

    const attendees = ev.attendees ?? [];
    const otherAttendees = attendees.filter((a) => !a.self && a.email);
    if (!otherAttendees.length) continue;

    // Build a header-style string we can pass through the lookup resolver.
    let matchedAny = false;
    for (const a of otherAttendees) {
      const header = a.displayName ? `${a.displayName} <${a.email}>` : a.email!;
      const contact = lookup.resolve(header);
      if (!contact) continue;
      // Skip declined attendees — they didn't actually meet / won't attend.
      if (a.responseStatus === "declined") continue;

      matchedAny = true;
      if (a.email) recordEnrich(enrich, contact, a.email);
      touches.push({
        contact_id: contact.id,
        channel: "calendar",
        direction: "outbound", // calendar meetings are mutual; we tag outbound for cadence advancement
        touched_at: startISO,
        source: "gcal",
        // Multiple contacts can share one event → make external_id unique per (event, contact)
        external_id: `${ev.id}::${contact.id}`,
        brief: ev.summary ?? "Meeting",
        subject: ev.summary ?? null,
        thread_url: ev.htmlLink ?? null,
      });
    }
    if (!matchedAny) skipped += 1;
  }

  const insertResult = await insertContactTouches(touches);
  await applyEmailEnrichments(enrich);
  await recordSyncState("gcal", {
    matched: touches.length,
    inserted: insertResult.inserted,
    duplicates: insertResult.duplicates,
    cadenceUpdates: insertResult.cadenceUpdates,
    skipped,
    errors: insertResult.errors,
  });
  revalidatePaths();
  return okResult("gcal", insertResult, touches.length, skipped);
}

// ---------------------------------------------------------------------------
// Orchestrator — run all configured syncs and aggregate results.
// ---------------------------------------------------------------------------

export async function syncOutreachAll(opts?: {
  daysBack?: number;
  daysForward?: number;
}): Promise<SyncAllResult> {
  const ranAt = new Date().toISOString();
  const [gmail, gcal] = await Promise.allSettled([
    syncOutreachFromGmail(opts),
    syncOutreachFromCalendar(opts),
  ]);

  return {
    ok:
      (gmail.status === "fulfilled" && gmail.value.ok) ||
      (gcal.status === "fulfilled" && gcal.value.ok),
    ranAt,
    gmail: settled(gmail),
    gcal: settled(gcal),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyInsertResult(): InsertTouchesResult {
  return { inserted: 0, duplicates: 0, cadenceUpdates: 0, errors: [] };
}

function okResult(
  source: SyncResultSource,
  insert: InsertTouchesResult,
  matched: number,
  skipped: number
): SyncResult {
  return {
    ok: true,
    source,
    matched,
    inserted: insert.inserted,
    duplicates: insert.duplicates,
    cadenceUpdates: insert.cadenceUpdates,
    skipped,
    error: insert.errors.length ? insert.errors.join("; ") : undefined,
  };
}

function errorResult(source: SyncResultSource, error: string): SyncResult {
  return {
    ok: false,
    source,
    matched: 0,
    inserted: 0,
    duplicates: 0,
    cadenceUpdates: 0,
    skipped: 0,
    error,
  };
}

function settled<T extends SyncResult>(
  r: PromiseSettledResult<T>
): SyncResult | null {
  if (r.status === "fulfilled") return r.value;
  return null;
}

function oneLine(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 200);
}

function revalidatePaths() {
  revalidatePath("/outreach");
  revalidatePath("/outreach/queue");
  revalidatePath("/outreach/schedule");
  revalidatePath("/outreach/people");
}
