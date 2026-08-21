"use server";

import { revalidatePath } from "next/cache";
import {
  searchGmailThreads,
  getGmailThread,
  isGmailConnected,
} from "@/lib/integrations/gmail";
import { gmailThreadUrl } from "@/lib/integrations/gmail-links";
import {
  fetchAllPersonalCalendarEvents,
  getGoogleAccessToken,
} from "@/lib/integrations/google-calendar";
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
import {
  upsertMeetingsFromCalendar,
  type CalendarMeetingUpsert,
} from "@/lib/outreach/meeting-capture";
import {
  BEEPER_UNAVAILABLE_MESSAGE,
  BeeperApiError,
  BeeperUnavailableError,
  fetchBeeperTouchCandidates,
  isBeeperConfigured,
} from "@/lib/integrations/beeper";

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

export type SyncResultSource = "gmail" | "gcal" | "beeper";

export interface SyncResult {
  ok: boolean;
  source: SyncResultSource;
  matched: number;
  inserted: number;
  duplicates: number;
  cadenceUpdates: number;
  skipped: number;
  error?: string;
  /** Soft skip — Beeper Desktop closed / unreachable / not configured. */
  unavailable?: boolean;
}

export interface SyncAllResult {
  ok: boolean;
  ranAt: string;
  gmail: SyncResult | null;
  gcal: SyncResult | null;
  beeper: SyncResult | null;
}

// ---------------------------------------------------------------------------
// Gmail sync — captures outbound emails from the last `daysBack` days.
// ---------------------------------------------------------------------------

export async function syncOutreachFromGmail(opts?: {
  daysBack?: number;
}): Promise<SyncResult> {
  const daysBack = Math.max(1, Math.min(90, opts?.daysBack ?? 7));

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return errorResult("gmail", "Supabase service role is not configured.");
  }
  const gmailReady = await isGmailConnected();
  if (!gmailReady) {
    await recordSyncState("gmail", {
      ok: false,
      error: "Gmail is not connected.",
    });
    return errorResult("gmail", "Gmail is not connected.");
  }

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
          thread_url: gmailThreadUrl(t.id),
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
// Calendar sync — captures meetings from the last `daysBack` days (and
// upcoming `daysForward` days) where any attendee resolves to a contact.
// Past events also become contact_touches (cadence). All matched events are
// upserted into jasonos.meetings so they appear on the contact Meetings tab.
// Reads jason@kupermanadvisors.com (primary) and jskuperman@gmail.com.
// ---------------------------------------------------------------------------

export async function syncOutreachFromCalendar(opts?: {
  daysBack?: number;
  /** How far ahead to load upcoming meetings onto contact Meetings tabs. */
  daysForward?: number;
}): Promise<SyncResult> {
  const daysBack = Math.max(1, Math.min(90, opts?.daysBack ?? 30));
  const daysForward = Math.max(0, Math.min(90, opts?.daysForward ?? 30));

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return errorResult("gcal", "Supabase service role is not configured.");
  }
  const token = await getGoogleAccessToken();
  if (!token) {
    await recordSyncState("gcal", {
      ok: false,
      error: "Google Calendar is not connected.",
    });
    return errorResult("gcal", "Google Calendar is not connected.");
  }

  const lookup = await buildContactLookup();
  if (!lookup.rows.length) {
    await recordSyncState("gcal", { matched: 0 });
    return okResult("gcal", emptyInsertResult(), 0, 0);
  }

  const now = Date.now();
  const timeMin = new Date(now - daysBack * 86_400_000).toISOString();
  const timeMax = new Date(now + daysForward * 86_400_000).toISOString();

  const { events, error, warnings } = await fetchAllPersonalCalendarEvents({
    token,
    timeMin,
    timeMax,
  });
  const fetchWarning = [error, ...warnings].filter(Boolean).join(" · ") || undefined;
  if (error && events.length === 0) {
    await recordSyncState("gcal", { error });
    return errorResult("gcal", error);
  }
  if (fetchWarning) {
    console.warn("[outreach-sync.gcal] calendar fetch:", fetchWarning);
  }

  const touches: ContactTouchInput[] = [];
  const meetingRows: CalendarMeetingUpsert[] = [];
  const enrich: EnrichMap = new Map();
  let skipped = 0;

  for (const ev of events) {
    if (!ev.id) continue;
    const eventId = ev.id;
    if (ev.status === "cancelled") continue;
    // Timed events preferred; all-day events use noon local so they still link.
    const startISO = ev.start?.dateTime
      ? new Date(ev.start.dateTime).toISOString()
      : ev.start?.date
        ? new Date(`${ev.start.date}T12:00:00`).toISOString()
        : null;
    if (!startISO) continue;

    const isPastOrStarted = new Date(startISO).getTime() <= now;
    const attendees = ev.attendees ?? [];
    const otherAttendees = attendees.filter(
      (a) => a.email && !a.self && !isMyOwnAddress(a.email)
    );
    if (!otherAttendees.length) continue;

    let matchedAny = false;
    for (const a of otherAttendees) {
      const header = a.displayName ? `${a.displayName} <${a.email}>` : a.email!;
      const contact = lookup.resolve(header);
      if (!contact) continue;
      // Skip declined attendees — they didn't / won't meet.
      if (a.responseStatus === "declined") continue;

      matchedAny = true;
      if (a.email) recordEnrich(enrich, contact, a.email);

      const title = ev.summary?.trim() || "Meeting";
      meetingRows.push({
        contactId: contact.id,
        gcalEventId: eventId,
        scheduledAt: startISO,
        title,
        calendarUrl: ev.htmlLink ?? null,
        status: isPastOrStarted ? "held" : "scheduled",
      });

      // Cadence touches only for meetings that have started.
      if (isPastOrStarted) {
        touches.push({
          contact_id: contact.id,
          channel: "calendar",
          direction: "outbound",
          touched_at: startISO,
          source: "gcal",
          external_id: `${eventId}::${contact.id}`,
          brief: title,
          subject: ev.summary ?? null,
          thread_url: ev.htmlLink ?? null,
        });
      }
    }
    if (!matchedAny) skipped += 1;
  }

  const insertResult = await insertContactTouches(touches);
  const meetingResult = await upsertMeetingsFromCalendar(meetingRows);
  await applyEmailEnrichments(enrich);
  await recordSyncState("gcal", {
    matched: meetingRows.length,
    inserted: insertResult.inserted,
    duplicates: insertResult.duplicates,
    cadenceUpdates: insertResult.cadenceUpdates,
    meetingsInserted: meetingResult.inserted,
    meetingsUpdated: meetingResult.updated,
    skipped,
    pagesFetched: true,
    eventCount: events.length,
    errors: [...insertResult.errors, ...meetingResult.errors],
    ...(fetchWarning ? { fetchWarning } : {}),
  });
  revalidatePaths();

  if (meetingResult.errors.length && !insertResult.inserted && !meetingResult.inserted) {
    const msg = meetingResult.errors.join("; ");
    // Missing migration is the common cause — surface it rather than a silent zero.
    if (/gcal_event_id|column/i.test(msg)) {
      return errorResult(
        "gcal",
        `Meetings tab sync needs migration 0052_meetings_gcal_link.sql applied (${msg})`
      );
    }
  }

  return okResult("gcal", insertResult, meetingRows.length, skipped);
}

// ---------------------------------------------------------------------------
// Upcoming meetings — read-only lookahead used by the networking report.
// Returns future Google Calendar events whose attendees resolve to a known
// contact. Does not write touches. Returns [] when Calendar isn't connected.
// ---------------------------------------------------------------------------

export interface UpcomingCalendarMeeting {
  contactId: string;
  startISO: string;
}

export async function getUpcomingCalendarMeetings(opts?: {
  daysAhead?: number;
}): Promise<UpcomingCalendarMeeting[]> {
  const daysAhead = Math.max(1, Math.min(120, opts?.daysAhead ?? 30));
  const token = await getGoogleAccessToken();
  if (!token) return [];

  const lookup = await buildContactLookup();
  if (!lookup.rows.length) return [];

  const now = Date.now();
  const { events } = await fetchAllPersonalCalendarEvents({
    token,
    timeMin: new Date(now).toISOString(),
    timeMax: new Date(now + daysAhead * 86_400_000).toISOString(),
  });

  const out: UpcomingCalendarMeeting[] = [];
  const seen = new Set<string>();
  for (const ev of events) {
    if (ev.status === "cancelled") continue;
    const startISO = ev.start?.dateTime ?? null;
    if (!startISO) continue;
    if (new Date(startISO).getTime() < now) continue; // future only
    for (const a of ev.attendees ?? []) {
      if (!a.email || a.self || isMyOwnAddress(a.email)) continue;
      if (a.responseStatus === "declined") continue;
      const header = a.displayName ? `${a.displayName} <${a.email}>` : a.email;
      const contact = lookup.resolve(header);
      if (!contact) continue;
      const key = `${contact.id}::${startISO}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ contactId: contact.id, startISO });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Beeper sync — 1:1 chats when Desktop API is reachable.
// Soft-skips (unavailable) when Beeper isn't open / token missing / tunnel down.
// ---------------------------------------------------------------------------

export async function syncOutreachFromBeeper(opts?: {
  daysBack?: number;
}): Promise<SyncResult> {
  const daysBack = Math.max(1, Math.min(90, opts?.daysBack ?? 30));

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return errorResult("beeper", "Supabase service role is not configured.");
  }
  if (!isBeeperConfigured()) {
    return unavailableBeeperResult(
      "Beeper not configured (missing BEEPER_ACCESS_TOKEN)."
    );
  }

  try {
    const candidates = await fetchBeeperTouchCandidates({
      daysBack,
      includeInbound: true,
    });
    const lookup = await buildContactLookup();
    if (!lookup.rows.length) {
      await recordSyncState("beeper", {
        ok: true,
        matched: 0,
        inserted: 0,
        candidates: candidates.length,
        skipped: candidates.length,
        daysBack,
        note: "No contacts to match.",
      });
      return {
        ...okResult("beeper", emptyInsertResult(), 0, candidates.length),
        error:
          candidates.length > 0
            ? `Beeper found ${candidates.length} messages but no contacts to match`
            : "Beeper reachable — no recent 1:1 chats found",
      };
    }

    const touches: ContactTouchInput[] = [];
    let skipped = 0;

    for (const c of candidates) {
      const contact = lookup.resolvePeer({
        name: c.peer.name ?? c.chatTitle,
        phone: c.peer.phone,
        email: c.peer.email,
      });
      if (!contact) {
        skipped += 1;
        continue;
      }

      const network = c.network ? ` via ${c.network}` : "";
      const preview = oneLine(c.text);
      touches.push({
        contact_id: contact.id,
        channel: "text",
        direction: c.direction,
        touched_at: c.timestamp,
        source: "beeper",
        external_id: `beeper:${c.chatId}:${c.messageId}`,
        brief: preview
          ? `${c.direction === "outbound" ? "Sent" : "Received"} text${network}: ${preview}`
          : `${c.direction === "outbound" ? "Sent" : "Received"} message${network}`,
        subject: c.chatTitle || c.peer.name || "Beeper chat",
        thread_url: null,
        objective_achieved: "neutral",
      });
    }

    const insert = await insertContactTouches(touches);
    await recordSyncState("beeper", {
      ok: true,
      matched: touches.length,
      inserted: insert.inserted,
      duplicates: insert.duplicates,
      cadenceUpdates: insert.cadenceUpdates,
      skipped,
      candidates: candidates.length,
      daysBack,
    });
    revalidatePaths();

    const result = okResult("beeper", insert, touches.length, skipped);
    if (candidates.length === 0) {
      return {
        ...result,
        error: "Beeper reachable — no recent 1:1 chats found",
      };
    }
    if (touches.length === 0 && skipped > 0) {
      return {
        ...result,
        error: `Beeper found ${candidates.length} messages; none matched contacts (${skipped} unmatched)`,
      };
    }
    return result;
  } catch (err) {
    if (err instanceof BeeperUnavailableError) {
      return unavailableBeeperResult(err.message || BEEPER_UNAVAILABLE_MESSAGE);
    }
    if (err instanceof BeeperApiError) {
      console.error("[outreach-sync.beeper.api]", err);
      await recordSyncState("beeper", {
        ok: false,
        error: err.message,
        daysBack,
      }).catch(() => undefined);
      return errorResult("beeper", err.message);
    }
    console.error("[outreach-sync.beeper]", err);
    const msg = err instanceof Error ? err.message : "Beeper sync failed.";
    await recordSyncState("beeper", { ok: false, error: msg });
    return errorResult("beeper", msg);
  }
}

function unavailableBeeperResult(message = BEEPER_UNAVAILABLE_MESSAGE): SyncResult {
  // Persist soft-skip so we can see the last attempt even when Funnel is down.
  void recordSyncState("beeper", {
    ok: true,
    unavailable: true,
    error: message,
  });
  return {
    ok: true,
    source: "beeper",
    matched: 0,
    inserted: 0,
    duplicates: 0,
    cadenceUpdates: 0,
    skipped: 0,
    unavailable: true,
    error: message.includes("No Beeper")
      ? BEEPER_UNAVAILABLE_MESSAGE
      : message,
  };
}

// ---------------------------------------------------------------------------
// Orchestrator — run all configured syncs and aggregate results.
// ---------------------------------------------------------------------------

export async function syncOutreachAll(opts?: {
  daysBack?: number;
  daysForward?: number;
}): Promise<SyncAllResult> {
  const ranAt = new Date().toISOString();
  const [gmail, gcal, beeper] = await Promise.allSettled([
    syncOutreachFromGmail(opts),
    syncOutreachFromCalendar(opts),
    syncOutreachFromBeeper(opts),
  ]);

  return {
    ok:
      (gmail.status === "fulfilled" && gmail.value.ok) ||
      (gcal.status === "fulfilled" && gcal.value.ok) ||
      (beeper.status === "fulfilled" &&
        beeper.value.ok &&
        !beeper.value.unavailable),
    ranAt,
    gmail: settled(gmail),
    gcal: settled(gcal),
    beeper: settled(beeper),
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
  revalidatePath("/settings/sync-log");
}
