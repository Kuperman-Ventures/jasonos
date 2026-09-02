"use server";

import { revalidatePath } from "next/cache";
import {
  searchGmailThreads,
  getGmailThread,
} from "@/lib/integrations/gmail";
import { gmailThreadUrl } from "@/lib/integrations/gmail-links";
import { OUTLOOK_WRAP_EMAIL } from "@/lib/integrations/unwrap-forwarded-mail";
import {
  calendarEventGuests,
  fetchAllPersonalCalendarEvents,
  fetchCalendarEvents,
} from "@/lib/integrations/google-calendar";
import {
  GOOGLE_GMAIL,
  listGoogleAccountAccess,
} from "@/lib/integrations/google-tokens";
import { matchCalendarEventToContacts } from "@/lib/outreach/calendar-matching";
import {
  upsertCandidateSightings,
  type CandidateSighting,
} from "@/lib/outreach/candidate-capture";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  beeperCandidateIdentity,
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
  /** Unknown people staged onto Suggested this run. */
  candidatesStaged?: number;
  /** One mailbox failed while others still synced. */
  warnings?: string[];
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

function splitRecipientHeaders(...headers: (string | undefined)[]): string[] {
  const out: string[] = [];
  for (const header of headers) {
    if (!header) continue;
    for (const part of header.split(",")) {
      const trimmed = part.trim();
      if (trimmed) out.push(trimmed);
    }
  }
  return out;
}

export async function syncOutreachFromGmail(opts?: {
  daysBack?: number;
  runId?: string;
}): Promise<SyncResult> {
  const daysBack = Math.max(1, Math.min(90, opts?.daysBack ?? 7));
  const log = (payload: Record<string, unknown>) =>
    recordSyncState("gmail", payload, opts?.runId);

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return errorResult("gmail", "Supabase service role is not configured.");
  }
  const mailboxTokens = await listGoogleAccountAccess();
  if (!mailboxTokens.length) {
    await log({
      ok: false,
      error: "Gmail is not connected.",
    });
    return errorResult("gmail", "Gmail is not connected.");
  }

  const lookup = await buildContactLookup();
  const afterEpoch = Math.floor((Date.now() - daysBack * 86_400_000) / 1000);
  const enrich: EnrichMap = new Map();
  const combined = emptyInsertResult();
  let matchedTotal = 0;
  let skippedTotal = 0;
  let stagedTotal = 0;
  const mailboxErrors: string[] = [];

  for (const { provider, token, accountEmail, error } of mailboxTokens) {
    if (!token) {
      const msg = error ?? `${accountEmail}: sign-in expired. Reconnect in Settings.`;
      mailboxErrors.push(msg);
      await log({ accountEmail, ok: false, error: msg });
      continue;
    }
    const touches: ContactTouchInput[] = [];
    const sightings: CandidateSighting[] = [];
    let skipped = 0;

    try {
      const sent = await searchGmailThreads({
        query: `in:sent after:${afterEpoch}`,
        pageSize: 100,
        accessToken: token,
      });
      const wraps = await searchGmailThreads({
        query: `from:${OUTLOOK_WRAP_EMAIL} after:${afterEpoch}`,
        pageSize: 100,
        accessToken: token,
      });
      const threads = dedupeThreadsById([...sent, ...wraps]);

      for (const t of threads) {
        const full = await getGmailThread(t.id, token);
        if (!full) continue;

        for (const m of full.messages) {
          if (!m.from || !m.date) continue;
          if (new Date(m.date).getTime() < Date.now() - daysBack * 86_400_000) {
            continue;
          }

          const touchedAt = new Date(m.date).toISOString();
          const outbound = isFromMe(m.from);
          const counterparties = outbound
            ? splitRecipientHeaders(m.to, m.cc)
            : [m.from];
          if (!counterparties.length) continue;

          let firstMatched = true;
          for (const raw of counterparties) {
            const email = extractEmail(raw);
            if (!email || isMyOwnAddress(email)) continue;
            const contact = lookup.resolve(raw);
            const direction = outbound ? "outbound" : "inbound";
            if (!contact) {
              skipped += 1;
              sightings.push({
                email,
                name:
                  raw.replace(/<[^>]+>/, "").replace(/["']/g, "").trim() || null,
                dateIso: touchedAt,
                subject: m.subject ?? null,
                direction,
              });
              continue;
            }
            recordEnrich(enrich, contact, email);
            const id =
              provider === GOOGLE_GMAIL
                ? firstMatched
                  ? `gmail:${m.id}`
                  : `gmail:${m.id}::${contact.id}`
                : firstMatched
                  ? m.id
                  : `${m.id}::${contact.id}`;
            firstMatched = false;
            touches.push({
              contact_id: contact.id,
              channel: "email",
              direction,
              touched_at: touchedAt,
              source: "gmail",
              // Advisors ids stay bare so existing rows still dedupe. Gmail gets a prefix.
              external_id: id,
              brief:
                oneLine(m.plaintextBody) ||
                m.snippet ||
                (outbound ? "Email sent" : "Email received"),
              subject: m.subject ?? null,
              thread_url: gmailThreadUrl(t.id),
            });
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      mailboxErrors.push(`${accountEmail}: ${msg}`);
      await log({ accountEmail, ok: false, error: msg });
      continue;
    }

    const insertResult = await insertContactTouches(touches);
    const staged = await upsertCandidateSightings(sightings, lookup);
    combined.inserted += insertResult.inserted;
    combined.duplicates += insertResult.duplicates;
    combined.cadenceUpdates += insertResult.cadenceUpdates;
    combined.errors.push(...insertResult.errors);
    matchedTotal += touches.length;
    skippedTotal += skipped;
    stagedTotal += staged.created;
    await log({
      accountEmail,
      matched: touches.length,
      inserted: insertResult.inserted,
      duplicates: insertResult.duplicates,
      cadenceUpdates: insertResult.cadenceUpdates,
      skipped,
      candidatesStaged: staged.created,
      unmatchedNames: staged.newNames,
      errors: insertResult.errors,
    });
  }

  await applyEmailEnrichments(enrich);
  revalidatePaths();

  if (!mailboxTokens.length) {
    return errorResult("gmail", "Gmail is not connected.");
  }
  if (mailboxErrors.length && !combined.inserted && !matchedTotal) {
    return errorResult("gmail", mailboxErrors.join(" · "));
  }
  return okResult(
    "gmail",
    combined,
    matchedTotal,
    skippedTotal,
    stagedTotal,
    mailboxErrors
  );
}

// ---------------------------------------------------------------------------
// Calendar sync — captures meetings from the last `daysBack` days (and
// upcoming `daysForward` days) where any attendee resolves to a contact.
// Past events also become contact_touches (cadence). All matched events are
// upserted into jasonos.meetings so they appear on the contact Meetings tab.
// Reads Advisors Google primary and, when connected, personal Gmail primary.
// ---------------------------------------------------------------------------

export async function syncOutreachFromCalendar(opts?: {
  daysBack?: number;
  /** How far ahead to load upcoming meetings onto contact Meetings tabs. */
  daysForward?: number;
  runId?: string;
}): Promise<SyncResult> {
  const daysBack = Math.max(1, Math.min(90, opts?.daysBack ?? 30));
  const daysForward = Math.max(0, Math.min(90, opts?.daysForward ?? 30));
  const log = (payload: Record<string, unknown>) =>
    recordSyncState("gcal", payload, opts?.runId);

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return errorResult("gcal", "Supabase service role is not configured.");
  }

  const mailboxTokens = await listGoogleAccountAccess();
  if (!mailboxTokens.length) {
    await log({ error: "Google Calendar is not connected." });
    return errorResult("gcal", "Google Calendar is not connected.");
  }

  const lookup = await buildContactLookup();
  const now = Date.now();
  const timeMin = new Date(now - daysBack * 86_400_000).toISOString();
  const timeMax = new Date(now + daysForward * 86_400_000).toISOString();
  const enrich: EnrichMap = new Map();
  const combined = emptyInsertResult();
  let matchedTotal = 0;
  let skippedTotal = 0;
  let stagedTotal = 0;
  const mailboxErrors: string[] = [];
  let migrationError: string | null = null;

  for (const { token, accountEmail, error } of mailboxTokens) {
    if (!token) {
      const msg = error ?? `${accountEmail}: sign-in expired. Reconnect in Settings.`;
      mailboxErrors.push(msg);
      await log({ accountEmail, ok: false, error: msg });
      continue;
    }
    const fetched = await fetchCalendarEvents({
      token,
      calendarId: "primary",
      timeMin,
      timeMax,
    });
    if (fetched.error && !fetched.events.length) {
      mailboxErrors.push(`${accountEmail}: ${fetched.error}`);
      await log({ accountEmail, ok: false, error: fetched.error });
      continue;
    }
    if (fetched.error) {
      console.warn("[outreach-sync.gcal]", accountEmail, fetched.error);
    }

    const touches: ContactTouchInput[] = [];
    const meetingRows: CalendarMeetingUpsert[] = [];
    const sightings: CandidateSighting[] = [];
    let skipped = 0;

    for (const ev of fetched.events) {
      if (!ev.id || ev.status === "cancelled") continue;
      const eventId = ev.id;
      // Timed events preferred; all-day events use noon local so they still link.
      const startISO = ev.start?.dateTime
        ? new Date(ev.start.dateTime).toISOString()
        : ev.start?.date
          ? new Date(`${ev.start.date}T12:00:00`).toISOString()
          : null;
      if (!startISO) continue;

      const isPastOrStarted = new Date(startISO).getTime() <= now;
      const guests = calendarEventGuests(ev);
      const { matches, unmatchedGuests } = matchCalendarEventToContacts({
        title: ev.summary,
        guests,
        lookup,
      });
      if (!matches.length && !unmatchedGuests.length) continue;

      for (const guest of unmatchedGuests) {
        if (!guest.email || !guest.email.includes("@")) continue;
        sightings.push({
          email: guest.email,
          name: guest.name ?? null,
          dateIso: startISO,
          subject: ev.summary?.trim() || "Meeting",
          direction: "inbound",
        });
      }
      if (!matches.length) {
        skipped += 1;
        continue;
      }

      for (const match of matches) {
        if (match.email) recordEnrich(enrich, match.contact, match.email);
        const title = ev.summary?.trim() || "Meeting";
        meetingRows.push({
          contactId: match.contact.id,
          gcalEventId: eventId,
          scheduledAt: startISO,
          title,
          calendarUrl: ev.htmlLink ?? null,
          status: isPastOrStarted ? "held" : "scheduled",
        });

        if (isPastOrStarted) {
          touches.push({
            contact_id: match.contact.id,
            channel: "calendar",
            direction: "outbound",
            touched_at: startISO,
            source: "gcal",
            external_id: `${eventId}::${match.contact.id}`,
            brief: title,
            subject: ev.summary ?? null,
            thread_url: ev.htmlLink ?? null,
          });
        }
      }
    }

    const insertResult = await insertContactTouches(touches);
    const meetingResult = await upsertMeetingsFromCalendar(meetingRows);
    const staged = await upsertCandidateSightings(sightings, lookup);
    combined.inserted += insertResult.inserted;
    combined.duplicates += insertResult.duplicates;
    combined.cadenceUpdates += insertResult.cadenceUpdates;
    combined.errors.push(...insertResult.errors, ...meetingResult.errors);
    matchedTotal += meetingRows.length;
    skippedTotal += skipped;
    stagedTotal += staged.created;

    if (
      meetingResult.errors.length &&
      !insertResult.inserted &&
      !meetingResult.inserted
    ) {
      const msg = meetingResult.errors.join("; ");
      if (/gcal_event_id|column/i.test(msg)) {
        migrationError = msg;
      }
    }

    await log({
      accountEmail,
      matched: meetingRows.length,
      inserted: insertResult.inserted,
      duplicates: insertResult.duplicates,
      cadenceUpdates: insertResult.cadenceUpdates,
      meetingsInserted: meetingResult.inserted,
      meetingsUpdated: meetingResult.updated,
      skipped,
      candidatesStaged: staged.created,
      unmatchedNames: staged.newNames,
      pagesFetched: true,
      eventCount: fetched.events.length,
      errors: [...insertResult.errors, ...meetingResult.errors],
      ...(fetched.error ? { fetchWarning: fetched.error } : {}),
    });
  }

  await applyEmailEnrichments(enrich);
  revalidatePaths();

  if (migrationError) {
    return errorResult(
      "gcal",
      `Meetings tab sync needs migration 0052_meetings_gcal_link.sql applied (${migrationError})`
    );
  }
  if (mailboxErrors.length && !matchedTotal && !combined.inserted) {
    return errorResult("gcal", mailboxErrors.join(" · "));
  }
  return okResult(
    "gcal",
    combined,
    matchedTotal,
    skippedTotal,
    stagedTotal,
    mailboxErrors
  );
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
  const lookup = await buildContactLookup();
  if (!lookup.rows.length) return [];

  const now = Date.now();
  const { events } = await fetchAllPersonalCalendarEvents({
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
    const { matches } = matchCalendarEventToContacts({
      title: ev.summary,
      guests: calendarEventGuests(ev),
      lookup,
    });
    for (const match of matches) {
      const key = `${match.contact.id}::${startISO}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ contactId: match.contact.id, startISO });
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
  runId?: string;
}): Promise<SyncResult> {
  const daysBack = Math.max(1, Math.min(90, opts?.daysBack ?? 30));
  const log = (payload: Record<string, unknown>) =>
    recordSyncState("beeper", payload, opts?.runId);

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return errorResult("beeper", "Supabase service role is not configured.");
  }
  if (!isBeeperConfigured()) {
    return unavailableBeeperResult(
      "Beeper not configured (missing BEEPER_ACCESS_TOKEN).",
      opts?.runId
    );
  }

  try {
    const candidates = await fetchBeeperTouchCandidates({
      daysBack,
      maxChats: 80,
      includeInbound: true,
    });
    const lookup = await buildContactLookup();
    if (!lookup.rows.length) {
      await log({
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
    const sightings: CandidateSighting[] = [];
    let skipped = 0;

    for (const c of candidates) {
      const contact = lookup.resolvePeer({
        name: c.peer.name ?? c.chatTitle,
        phone: c.peer.phone,
        email: c.peer.email,
      });
      if (!contact) {
        skipped += 1;
        const identity = beeperCandidateIdentity({
          email: c.peer.email,
          phone: c.peer.phone,
          name: c.peer.name,
          chatTitle: c.chatTitle,
        });
        if (identity) {
          sightings.push({
            email: identity.email,
            name: identity.name,
            phone: identity.phone,
            dateIso: c.timestamp,
            subject: c.network ? `Beeper · ${c.network}` : "Beeper",
            direction: c.direction,
          });
        }
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
    const staged = await upsertCandidateSightings(sightings, lookup);
    await log({
      ok: true,
      matched: touches.length,
      inserted: insert.inserted,
      duplicates: insert.duplicates,
      cadenceUpdates: insert.cadenceUpdates,
      skipped,
      candidates: candidates.length,
      candidatesStaged: staged.created,
      unmatchedNames: staged.newNames,
      daysBack,
    });
    revalidatePaths();

    const result = okResult(
      "beeper",
      insert,
      touches.length,
      skipped,
      staged.created
    );
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
      return unavailableBeeperResult(err.message || BEEPER_UNAVAILABLE_MESSAGE, opts?.runId);
    }
    if (err instanceof BeeperApiError) {
      console.error("[outreach-sync.beeper.api]", err);
      await log({
        ok: false,
        error: err.message,
        daysBack,
      }).catch(() => undefined);
      return errorResult("beeper", err.message);
    }
    console.error("[outreach-sync.beeper]", err);
    const msg = err instanceof Error ? err.message : "Beeper sync failed.";
    await log({ ok: false, error: msg });
    return errorResult("beeper", msg);
  }
}

function unavailableBeeperResult(
  message = BEEPER_UNAVAILABLE_MESSAGE,
  runId?: string
): SyncResult {
  // Persist soft-skip so we can see the last attempt even when Funnel is down.
  void recordSyncState(
    "beeper",
    {
      ok: true,
      unavailable: true,
      error: message,
    },
    runId
  );
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
  runId?: string;
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
  skipped: number,
  candidatesStaged = 0,
  warnings: string[] = []
): SyncResult {
  return {
    ok: true,
    source,
    matched,
    inserted: insert.inserted,
    duplicates: insert.duplicates,
    cadenceUpdates: insert.cadenceUpdates,
    skipped,
    candidatesStaged,
    error:
      warnings[0] ??
      (insert.errors.length ? insert.errors.join("; ") : undefined),
    warnings: warnings.length ? warnings : undefined,
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

function dedupeThreadsById<T extends { id: string }>(threads: T[]): T[] {
  return [...new Map(threads.map((t) => [t.id, t])).values()];
}

function revalidatePaths() {
  revalidatePath("/outreach");
  revalidatePath("/outreach/queue");
  revalidatePath("/outreach/schedule");
  revalidatePath("/outreach/people");
  revalidatePath("/outreach/suggested");
  revalidatePath("/settings/sync-log");
}
