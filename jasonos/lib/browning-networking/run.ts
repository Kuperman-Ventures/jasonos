import "server-only";

import { etToday, etYmd } from "@/lib/dates";
import { BROWNING_SOURCE_NAME, findReferralSourceId } from "@/lib/referral-sources";
import { createGmailDraft, downloadGmailResume, getGmailMessagesFull, listGmailMessages } from "@/lib/integrations/gmail";
import { downloadOutlookResume, latestOutlookSentTo, listOutlookTracyMessages, searchOutlookMessages } from "@/lib/integrations/outlook";
import { getOutlookAccountAccess } from "@/lib/integrations/outlook-tokens";
import {
  fetchAccountCalendarEvents,
  renameGoogleCalendarEvent,
  type CalendarApiEvent,
} from "@/lib/integrations/google-calendar";
import { ADVISORS_ACCOUNT_EMAIL, listGoogleAccessTokens } from "@/lib/integrations/google-tokens";
import { searchFirefliesForContact } from "@/lib/integrations/fireflies";
import { searchGranolaForContact } from "@/lib/integrations/granola";
import { canonicalEmail } from "@/lib/outreach/contact-lookup";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { findBookedCall, type CalendarGuestEvent } from "./booking";
import {
  planDuplicateDismissals,
  type DedupeHandoff,
} from "./dedupe";
import {
  briefFromHandoff,
  callHasEnded,
  connectMeetingTitle,
  isCallMorning,
  replyComposeUrl,
  followUpDraft,
  replySubject,
  schedulingDraft,
  packetEmailDraft,
  packetEmailSubject,
} from "./draft";
import { composeThankYouDraft } from "./thank-you-compose";
import {
  chooseHandoffs,
  emailFromText,
  handoffKind,
  linkedInUrlFromText,
  phoneFromText,
  sameCandidate,
  type HandoffMail,
} from "./parse";
import { loadBusy } from "./data";
import { firstEligibleYmd, lastEligibleYmd, proposeSlots } from "./slots";
import { isAlreadyTracked, FOLLOW_UP_LOOKBACK_DAYS, shouldQueueFollowUp } from "./follow-up";
import { canEditOfferedTimes } from "./lanes";
import { meetingBrief } from "./meeting-brief";
import { matchOfferedSlot, replyWords } from "./chosen-time";
import { extractDocxText, extractPdfText } from "@/lib/resume-customizer/extract";
import { HANDOFF_OPENING, TRACY_EMAIL, type HandoffSlot, type HandoffStatus, type ParsedHandoff } from "./types";

type Sb = ReturnType<typeof createServiceRoleClient>;

export type BrowningRunResult = {
  ok: boolean;
  configured: boolean;
  found: number;
  created: number;
  skippedExisting: number;
  booked: number;
  briefs: number;
  thankYous: number;
  followUps: number;
  olderFound: number;
  preps: number;
  error?: string;
};

function gmailSearches(days: number): string[] {
  return [
    `from:${TRACY_EMAIL} newer_than:${days}d`,
    `"${HANDOFF_OPENING}" newer_than:${days}d`,
    `"Attached please find the resume for" newer_than:${days}d`,
    `"Jason Kuperman &" newer_than:${days}d`,
    `from:${TRACY_EMAIL} linkedin.com/in newer_than:${days}d`,
    `from:${TRACY_EMAIL} "Client to Client" newer_than:${days}d`,
  ];
}

export async function runBrowningNetworking(): Promise<BrowningRunResult> {
  const result: BrowningRunResult = {
    ok: false,
    configured: false,
    found: 0,
    created: 0,
    skippedExisting: 0,
    booked: 0,
    briefs: 0,
    thankYous: 0,
    followUps: 0,
    olderFound: 0,
    preps: 0,
  };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ...result, error: "Supabase is not configured." };
  }
  result.configured = true;
  const sb = createServiceRoleClient();

  try {
    await renameConnectTitles(sb);
    const harvested = await harvestHandoffs(sb);
    result.found = harvested.found;
    result.created = harvested.created;
    result.skippedExisting = harvested.skippedExisting;
    await reshuffleDuplicateOffers(sb);
    const followedUp = await harvestFollowUps(sb);
    result.followUps = followedUp.created;
    result.olderFound = followedUp.found;
    result.preps = followedUp.preps;
    const followed = await followBookedCalls(sb);
    result.booked = followed.booked;
    result.briefs = followed.briefs;
    result.thankYous = followed.thankYous;
    await collapseDuplicateHandoffs(sb);
    await linkBrowningReferrals(sb);
    await detectChosenTimes(sb);
    result.ok = true;
    return result;
  } catch (err) {
    return {
      ...result,
      error: err instanceof Error ? err.message : "Browning Networking run failed.",
    };
  }
}

async function harvestHandoffs(sb: Sb): Promise<{
  found: number;
  created: number;
  skippedExisting: number;
}> {
  const collected = await collectHandoffMail();
  let found = 0;
  let created = 0;
  let skippedExisting = 0;
  if (!collected.searched) {
    if (collected.error) throw new Error(collected.error);
    return { found, created, skippedExisting };
  }

  const contacts = await loadContacts(sb);
  const now = new Date();
  const busy = [
    ...(await loadBusy(firstEligibleYmd(now), lastEligibleYmd(now))),
    ...(await loadOfferedSlotBusy(sb)),
  ];
  const chosen = chooseHandoffs(collected.messages);
  const createdRows: {
    id: string;
    gmail_account: string;
    gmail_message_id: string;
    contact_name: string | null;
    meeting_brief: string | null;
    created_contact_id: string | null;
    existing_contact_id: string | null;
  }[] = [];
  // Include dismissed so Clear does not bring the same false positive back.
  const { data: knownRows } = await sb
    .from("browning_handoffs")
    .select(
      "id, gmail_account, gmail_message_id, rfc822_message_id, contact_email, contact_name, existing_contact_id, created_contact_id, status"
    );
  const tracked = (knownRows ?? []).map((row) => ({
    email: (row.contact_email as string | null) ?? null,
    name: (row.contact_name as string | null) ?? null,
  }));
  const seenMessages = new Set(
    (knownRows ?? []).map((row) => `${row.gmail_account}:${row.gmail_message_id}`)
  );
  const seenRfc = new Set(
    (knownRows ?? [])
      .map((row) => (row.rfc822_message_id as string | null) ?? "")
      .filter(Boolean)
      .map((id) => id.toLowerCase())
  );
  const seenPeople = new Set(
    (knownRows ?? []).map((row) =>
      personKey(
        row.gmail_account as string,
        row.gmail_message_id as string,
        (row.contact_name as string | null) ?? null
      )
    )
  );

  for (const item of chosen) {
    found += 1;
    const mail = item.mail;
    const parsed = item.parsed;
    const isPacket = item.kind === "packet";
    if (isPacket && seenPeople.has(personKey(mail.accountEmail, mail.messageId, parsed.name))) {
      skippedExisting += 1;
      continue;
    }
    if (!isPacket && seenMessages.has(`${mail.accountEmail}:${mail.messageId}`)) {
      skippedExisting += 1;
      continue;
    }
    if (
      !isPacket &&
      mail.rfc822MessageId &&
      seenRfc.has(mail.rfc822MessageId.toLowerCase())
    ) {
      skippedExisting += 1;
      continue;
    }
    if (
      isAlreadyTracked(tracked, {
        email: parsed.email,
        name: parsed.name,
      })
    ) {
      skippedExisting += 1;
      continue;
    }

    const filled = isPacket
      ? await enrichParsedFromResume(mail, item.resumeMessageId, parsed)
      : parsed;

    const match = matchExistingContact(contacts, filled);
    let createdContactId: string | null = null;
    if (!match && filled.name) {
      createdContactId = await insertContact(sb, filled);
    }

    const slots = isPacket
      ? filled.email
        ? proposeSlots({
            now,
            busy,
            availabilityNote: filled.availabilityNote,
          })
        : []
      : proposeSlots({
          now,
          busy,
          availabilityNote: filled.availabilityNote,
        });
    for (const slot of slots) {
      busy.push({ start: slot.start, end: slot.end });
    }
    const draft = isPacket
      ? packetEmailDraft({ name: filled.name, slots })
      : schedulingDraft({ name: filled.name, slots });

    const inserted = await sb
      .from("browning_handoffs")
      .insert({
        gmail_account: mail.accountEmail,
        gmail_message_id: mail.messageId,
        gmail_thread_id: mail.threadId,
        rfc822_message_id: mail.rfc822MessageId,
        received_at: mail.receivedAt,
        subject: mail.subject,
        contact_name: filled.name,
        contact_email: filled.email,
        contact_phone: filled.phone,
        linkedin_url: filled.linkedinUrl,
        contact_title: filled.title,
        contact_company: filled.company,
        availability_note: filled.availabilityNote,
        quoted_reply: filled.quotedReply,
        why_they_replied: filled.whyTheyReplied,
        existing_contact_id: match?.id ?? null,
        created_contact_id: createdContactId,
        slots,
        draft_body: draft,
        source_kind: isPacket ? "packet" : "intro",
        status: "times_ready",
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) {
      console.error("[browning-networking] insert", inserted.error);
      continue;
    }
    const handoffId = inserted.data.id as string;
    tracked.push({ email: filled.email, name: filled.name });
    seenMessages.add(`${mail.accountEmail}:${mail.messageId}`);
    seenPeople.add(personKey(mail.accountEmail, mail.messageId, filled.name));
    if (mail.rfc822MessageId) seenRfc.add(mail.rfc822MessageId.toLowerCase());
    createdRows.push({
      id: handoffId,
      gmail_account: mail.accountEmail,
      gmail_message_id: mail.messageId,
      contact_name: filled.name,
      meeting_brief: null,
      created_contact_id: createdContactId,
      existing_contact_id: match?.id ?? null,
    });
    const cardId = await insertCard(sb, {
      title: isPacket
        ? `Reach out to ${filled.name ?? "Browning contact"}`
        : `Reply to ${filled.name ?? "Browning contact"}`,
      subtitle: isPacket
        ? filled.linkedinUrl
          ? "LinkedIn first. Email if the resume has an address."
          : "Find email in the resume, or message them on LinkedIn."
        : filled.availabilityNote || "Pick times, then open the reply.",
      why: isPacket
        ? "Tracy sent a resume packet. They are not on the email. Nothing sends until you do."
        : "Tracy's handoff is in. Nothing sends until you do.",
      draft,
      href: `/outreach/browning-networking?id=${handoffId}`,
    });
    if (cardId) {
      await sb.from("browning_handoffs").update({ card_id: cardId }).eq("id", handoffId);
    }
    created += 1;
  }
  await writeMeetingBriefs(sb, chosen, createdRows, 12);
  return { found, created, skippedExisting };
}

function personKey(
  accountEmail: string,
  messageId: string,
  name: string | null
): string {
  return `${accountEmail}:${messageId}:${(name ?? "").trim().toLowerCase()}`;
}

/** Times already offered on open handoffs — do not suggest them again. */
async function loadOfferedSlotBusy(sb: Sb): Promise<{ start: string; end: string }[]> {
  const { data, error } = await sb
    .from("browning_handoffs")
    .select("slots")
    .in("status", ["times_ready", "draft_ready", "acted_on", "follow_up"])
    .is("call_starts_at", null);
  if (error) {
    console.error("[browning-networking] offered slots", error);
    return [];
  }
  const out: { start: string; end: string }[] = [];
  for (const row of data ?? []) {
    for (const slot of asStoredSlots(row.slots)) {
      out.push({ start: slot.start, end: slot.end });
    }
  }
  return out;
}

/**
 * If two open handoffs still share the same offered times, give the newer
 * one a fresh set. Keeps the earliest handoff's times as-is.
 */
async function reshuffleDuplicateOffers(sb: Sb): Promise<number> {
  const { data, error } = await sb
    .from("browning_handoffs")
    .select("id, slots, status, source_kind, contact_name, availability_note, received_at, created_at")
    .in("status", ["times_ready", "draft_ready"])
    .is("call_starts_at", null)
    .order("received_at", { ascending: true });
  if (error || !data?.length) {
    if (error) console.error("[browning-networking] reshuffle load", error);
    return 0;
  }
  const now = new Date();
  const calendarBusy = await loadBusy(firstEligibleYmd(now), lastEligibleYmd(now));
  const reserved: { start: string; end: string }[] = [];
  let changed = 0;
  for (const row of data) {
    const current = asStoredSlots(row.slots);
    if (!current.length) continue;
    const clash = current.some((slot) => {
      const start = Date.parse(slot.start);
      const end = Date.parse(slot.end);
      return reserved.some((block) => {
        const blockStart = Date.parse(block.start);
        const blockEnd = Date.parse(block.end);
        return start < blockEnd && end > blockStart;
      });
    });
    if (!clash) {
      for (const slot of current) reserved.push({ start: slot.start, end: slot.end });
      continue;
    }
    const next = proposeSlots({
      now,
      busy: [...calendarBusy, ...reserved],
      availabilityNote: (row.availability_note as string | null) ?? null,
    });
    if (!next.length) {
      for (const slot of current) reserved.push({ start: slot.start, end: slot.end });
      continue;
    }
    const name = (row.contact_name as string | null) ?? null;
    const draft =
      row.source_kind === "packet"
        ? packetEmailDraft({ name, slots: next })
        : schedulingDraft({ name, slots: next });
    const { error: updateError } = await sb
      .from("browning_handoffs")
      .update({ slots: next, draft_body: draft, status: "times_ready" })
      .eq("id", row.id as string);
    if (updateError) {
      console.error("[browning-networking] reshuffle", updateError);
      for (const slot of current) reserved.push({ start: slot.start, end: slot.end });
      continue;
    }
    for (const slot of next) reserved.push({ start: slot.start, end: slot.end });
    changed += 1;
  }
  return changed;
}

async function collectHandoffMail(lookbackDays = 30): Promise<{
  searched: boolean;
  messages: HandoffMail[];
  error?: string;
}> {
  const messages: HandoffMail[] = [];
  const problems: string[] = [];
  let searched = false;
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const listMax = lookbackDays > 30 ? 80 : 40;

  const google = await listGoogleAccessTokens();
  for (const account of google) {
    searched = true;
    const ids = new Set<string>();
    for (const query of gmailSearches(lookbackDays)) {
      const listed = await listGmailMessages({
        query,
        max: listMax,
        accessToken: account.token,
      });
      for (const item of listed) ids.add(item.id);
    }
    if (!ids.size) continue;
    const full = await getGmailMessagesFull([...ids], account.token);
    for (const message of full) {
      const body = message.plaintextBody || message.htmlBody || message.snippet || "";
      if (!handoffKind(body, message.subject) || !message.from) continue;
      messages.push({
        accountEmail: account.accountEmail,
        messageId: message.id,
        threadId: message.threadId,
        rfc822MessageId: message.rfc822MessageId ?? null,
        receivedAt: message.internalDate
          ? new Date(message.internalDate).toISOString()
          : new Date().toISOString(),
        subject: message.subject ?? null,
        from: message.from,
        to: message.to ?? "",
        body,
      });
    }
  }

  const outlook = await getOutlookAccountAccess();
  if (outlook.token) {
    searched = true;
    try {
      const found = await listOutlookTracyMessages(outlook.token, since);
      for (const message of found) {
        if (!handoffKind(message.body, message.subject)) continue;
        messages.push({
          accountEmail: outlook.accountEmail,
          messageId: message.id,
          threadId: message.conversationId,
          rfc822MessageId: message.internetMessageId,
          receivedAt: message.receivedAt,
          subject: message.subject,
          from: message.from,
          to: message.to,
          body: message.body,
        });
      }
    } catch (err) {
      problems.push(err instanceof Error ? err.message : "Outlook search failed.");
    }
  } else if (outlook.configured && outlook.error) {
    problems.push(outlook.error);
  }

  if (!searched && problems.length) {
    return { searched: false, messages, error: problems[0] };
  }
  return { searched, messages };
}

async function harvestFollowUps(sb: Sb): Promise<{ created: number; found: number; preps: number }> {
  const collected = await collectHandoffMail(FOLLOW_UP_LOOKBACK_DAYS);
  if (!collected.searched) return { created: 0, found: 0, preps: 0 };
  const chosen = chooseHandoffs(collected.messages);
  const { data: existingRows, error } = await sb
    .from("browning_handoffs")
    .select("id, gmail_account, gmail_message_id, contact_email, contact_name, meeting_brief, created_contact_id, existing_contact_id");
  if (error) {
    console.error("[browning-networking] follow-up existing", error);
    return { created: 0, found: 0, preps: 0 };
  }
  const rows = [...(existingRows ?? [])];
  const seenMessages = new Set(
    rows.map((row) => `${row.gmail_account}:${row.gmail_message_id}`)
  );
  const tracked = rows.map((row) => ({
    email: (row.contact_email as string | null) ?? null,
    name: (row.contact_name as string | null) ?? null,
  }));
  const contacts = await loadContacts(sb);
  const events = await calendarEventsBetween(
    new Date(Date.now() - FOLLOW_UP_LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
  );
  let created = 0;
  let preps = await writeMeetingBriefs(sb, chosen, rows, 12);

  for (const item of chosen) {
    const mail = item.mail;
    const parsed = item.parsed;
    if (item.kind === "packet") continue;
    if (!parsed.email || !parsed.name) continue;
    if (seenMessages.has(`${mail.accountEmail}:${mail.messageId}`)) continue;
    const alreadyTracked = isAlreadyTracked(tracked, { email: parsed.email, name: parsed.name });
    const hasMeeting = Boolean(
      findBookedCall(events, { email: parsed.email, name: parsed.name }, new Date(), true)
    );
    const outreach = alreadyTracked || hasMeeting ? null : await lastOutreachTo(parsed.email, mail.receivedAt);
    const introAgeDays = Math.floor((Date.now() - Date.parse(mail.receivedAt)) / 86_400_000);
    if (
      !shouldQueueFollowUp({
        alreadyTracked,
        hasMeeting,
        hasOutreach: Boolean(outreach),
        introAgeDays,
      })
    ) {
      continue;
    }

    const match = matchExistingContact(contacts, parsed);
    let createdContactId: string | null = null;
    if (!match) createdContactId = await insertContact(sb, parsed);
    const body = followUpDraft(parsed.name);
    const inserted = await sb
      .from("browning_handoffs")
      .insert({
        gmail_account: mail.accountEmail,
        gmail_message_id: mail.messageId,
        gmail_thread_id: mail.threadId,
        rfc822_message_id: mail.rfc822MessageId,
        received_at: mail.receivedAt,
        subject: mail.subject,
        contact_name: parsed.name,
        contact_email: parsed.email,
        contact_phone: parsed.phone,
        linkedin_url: parsed.linkedinUrl,
        contact_title: parsed.title,
        contact_company: parsed.company,
        availability_note: parsed.availabilityNote,
        quoted_reply: parsed.quotedReply,
        why_they_replied: parsed.whyTheyReplied,
        existing_contact_id: match?.id ?? null,
        created_contact_id: createdContactId,
        slots: [],
        draft_body: body,
        last_outreach_subject: outreach?.subject ?? mail.subject,
        last_outreach_sent_at: outreach?.sentAt ?? null,
        status: "follow_up",
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) {
      console.error("[browning-networking] follow-up insert", inserted.error);
      continue;
    }
    tracked.push({ email: parsed.email, name: parsed.name });
    seenMessages.add(`${mail.accountEmail}:${mail.messageId}`);
    rows.push({
      id: inserted.data.id,
      gmail_account: mail.accountEmail,
      gmail_message_id: mail.messageId,
      contact_email: parsed.email,
      contact_name: parsed.name,
      meeting_brief: null,
      created_contact_id: createdContactId,
      existing_contact_id: match?.id ?? null,
    });
    created += 1;
  }
  preps += await writeMeetingBriefs(sb, chosen, rows, Math.max(0, 12 - preps));
  return { created, found: chosen.length, preps };
}

async function writeMeetingBriefs(
  sb: Sb,
  chosen: { mail: HandoffMail; parsed: ParsedHandoff; resumeMessageId: string | null }[],
  rows: {
    id?: string;
    gmail_account?: string;
    gmail_message_id?: string;
    contact_name?: string | null;
    meeting_brief?: string | null;
    created_contact_id?: string | null;
    existing_contact_id?: string | null;
  }[],
  max: number
): Promise<number> {
  let wrote = 0;
  for (const item of chosen) {
    if (wrote >= max) break;
    const row = rows.find((candidate) => {
      if (candidate.gmail_account !== item.mail.accountEmail) return false;
      if (candidate.gmail_message_id !== item.mail.messageId) return false;
      const rowName = candidate.contact_name ?? null;
      const want = item.parsed.name;
      if (rowName && want && !sameCandidate(rowName, want)) return false;
      return true;
    });
    if (!row?.id) continue;
    const previousBrief = row.meeting_brief ?? "";
    if (previousBrief.startsWith("Who they are")) continue;
    const messageId = item.resumeMessageId || item.mail.messageId;
    const file = await loadResumeFile(
      item.mail.accountEmail,
      messageId,
      item.parsed.name
    );
    const brief = meetingBrief({
      name: item.parsed.name,
      tracyBody: item.mail.body,
      resumeText: file?.text ?? null,
      whyTheyReplied: item.parsed.whyTheyReplied,
    });
    if (!brief) continue;
    row.meeting_brief = brief;
    await sb
      .from("browning_handoffs")
      .update({
        meeting_brief: brief,
        resume_message_id: messageId,
        resume_filename: file?.filename ?? null,
      })
      .eq("id", row.id);
    const contactId = row.created_contact_id || row.existing_contact_id;
    if (contactId) {
      await sb.from("contacts").update({ browning_prep: brief }).eq("id", contactId);
      if (previousBrief) {
        await sb
          .from("meetings")
          .update({ prep_notes: brief })
          .eq("contact_id", contactId)
          .eq("prep_notes", previousBrief);
      }
      await sb
        .from("meetings")
        .update({ prep_notes: brief })
        .eq("contact_id", contactId)
        .eq("status", "scheduled")
        .is("prep_notes", null);
    }
    wrote += 1;
  }
  return wrote;
}

async function loadResumeFile(
  accountEmail: string,
  messageId: string,
  contactName?: string | null
): Promise<{ text: string; filename: string } | null> {
  try {
    const file = /@(outlook|hotmail|live)\.com$/i.test(accountEmail)
      ? await outlookResume(messageId, contactName)
      : await gmailResume(accountEmail, messageId, contactName);
    if (!file) return null;
    const name = file.filename.toLowerCase();
    const text = name.endsWith(".pdf")
      ? await extractPdfText(file.bytes)
      : await extractDocxText(file.bytes);
    return { text, filename: file.filename };
  } catch (err) {
    console.error("[browning-networking] resume", err);
    return null;
  }
}

async function enrichParsedFromResume(
  mail: HandoffMail,
  resumeMessageId: string | null,
  parsed: ParsedHandoff
): Promise<ParsedHandoff> {
  const messageId = resumeMessageId || mail.messageId;
  const file = await loadResumeFile(mail.accountEmail, messageId, parsed.name);
  if (!file?.text) return parsed;
  return {
    ...parsed,
    email: parsed.email || emailFromText(file.text),
    phone: parsed.phone || phoneFromText(file.text),
    linkedinUrl: parsed.linkedinUrl || linkedInUrlFromText(file.text),
  };
}

const CONTACT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function downloadHandoffResume(contactId: string): Promise<{
  filename: string;
  bytes: Buffer;
} | null> {
  if (!CONTACT_ID.test(contactId)) return null;
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("browning_handoffs")
    .select("gmail_account, gmail_message_id, resume_message_id, resume_filename")
    .or(`created_contact_id.eq.${contactId},existing_contact_id.eq.${contactId}`)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const accountEmail = data.gmail_account as string;
  const messageId = (data.resume_message_id as string | null) || (data.gmail_message_id as string);
  if (!messageId) return null;
  const file = /@(outlook|hotmail|live)\.com$/i.test(accountEmail)
    ? await outlookResume(messageId)
    : await gmailResume(accountEmail, messageId);
  return file;
}

async function outlookResume(messageId: string, contactName?: string | null) {
  const outlook = await getOutlookAccountAccess();
  if (!outlook.token) return null;
  return downloadOutlookResume(outlook.token, messageId, contactName);
}

async function gmailResume(
  accountEmail: string,
  messageId: string,
  contactName?: string | null
) {
  const google = await listGoogleAccessTokens();
  const token = google.find((account) => account.accountEmail === accountEmail)?.token;
  if (!token) return null;
  return downloadGmailResume(token, messageId, contactName);
}

async function lastOutreachTo(
  email: string,
  afterIso: string
): Promise<{ subject: string | null; sentAt: string } | null> {
  const after = new Date(afterIso);
  const slash = `${after.getUTCFullYear()}/${after.getUTCMonth() + 1}/${after.getUTCDate()}`;
  let best: { subject: string | null; sentAt: string } | null = null;
  const google = await listGoogleAccessTokens();
  for (const account of google) {
    const listed = await listGmailMessages({
      query: `in:sent to:${email} after:${slash}`,
      max: 5,
      accessToken: account.token,
    });
    if (!listed.length) continue;
    const full = await getGmailMessagesFull(listed.slice(0, 3).map((item) => item.id), account.token);
    for (const message of full) {
      const sentAt = message.internalDate
        ? new Date(message.internalDate).toISOString()
        : null;
      if (!sentAt || Date.parse(sentAt) < after.getTime()) continue;
      if (!best || Date.parse(sentAt) > Date.parse(best.sentAt)) {
        best = { subject: message.subject ?? null, sentAt };
      }
    }
  }
  const outlook = await getOutlookAccountAccess();
  if (outlook.token) {
    const sent = await latestOutlookSentTo(outlook.token, email, afterIso).catch(() => null);
    if (sent && (!best || Date.parse(sent.sentAt) > Date.parse(best.sentAt))) best = sent;
  }
  return best;
}

async function calendarEventsBetween(start: Date, end: Date): Promise<CalendarGuestEvent[]> {
  const tokens = await listGoogleAccessTokens();
  const lists = await Promise.all(
    tokens.map((account) =>
      fetchAccountCalendarEvents({
        token: account.token,
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
      }).catch(() => ({ events: [] as CalendarApiEvent[] }))
    )
  );
  const out: CalendarGuestEvent[] = [];
  for (const list of lists) {
    for (const event of list.events) {
      out.push({
        id: event.id,
        summary: event.summary,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        status: event.status,
        attendees: event.attendees,
      });
    }
  }
  return out;
}

async function followBookedCalls(sb: Sb): Promise<{
  booked: number;
  briefs: number;
  thankYous: number;
}> {
  const { data, error } = await sb
    .from("browning_handoffs")
    .select("*")
    .in("status", ["times_ready", "draft_ready", "acted_on", "follow_up", "booked", "brief_ready"]);
  if (error || !data?.length) return { booked: 0, briefs: 0, thankYous: 0 };

  const contacts = await loadContacts(sb);
  const contactsById = new Map(contacts.map((row) => [row.id, row]));
  const events = await upcomingEvents();
  const now = new Date();
  const today = etToday();
  let booked = 0;
  let briefs = 0;
  let thankYous = 0;

  for (const row of data) {
    const id = row.id as string;
    const contactId =
      ((row.existing_contact_id as string | null) ?? null) ||
      ((row.created_contact_id as string | null) ?? null);
    const linked = contactId ? contactsById.get(contactId) : null;
    let name = (row.contact_name as string | null) ?? linked?.name ?? null;
    let email = (row.contact_email as string | null) ?? null;
    const emails = [
      email,
      ...((linked?.emails ?? []) as string[]),
    ].filter((value): value is string => Boolean(value?.includes("@")));
    if (!email && emails[0]) email = emails[0];
    let startsAt = (row.call_starts_at as string | null) ?? null;
    let endsAt = (row.call_ends_at as string | null) ?? null;
    let status = row.status as string;

    const identityPatch: Record<string, string> = {};
    if (!(row.contact_name as string | null) && name) identityPatch.contact_name = name;
    if (!(row.contact_email as string | null) && email) identityPatch.contact_email = email;
    if (Object.keys(identityPatch).length) {
      await sb.from("browning_handoffs").update(identityPatch).eq("id", id);
    }

    if (!startsAt) {
      const match = findBookedCall(events, { email, emails, name }, now);
      if (match) {
        startsAt = match.startsAt;
        endsAt = match.endsAt;
        status = row.brief ? "brief_ready" : "booked";
        await sb
          .from("browning_handoffs")
          .update({
            call_event_id: match.id,
            call_title: match.title,
            call_starts_at: match.startsAt,
            call_ends_at: match.endsAt,
            status,
            ...(name ? { contact_name: name } : {}),
            ...(email ? { contact_email: email } : {}),
          })
          .eq("id", id);
        booked += 1;
      }
    }

    if (startsAt && !row.brief && isCallMorning(startsAt, today)) {
      const brief = briefFromHandoff({
        name,
        email,
        phone: (row.contact_phone as string | null) ?? null,
        linkedinUrl: (row.linkedin_url as string | null) ?? null,
        availabilityNote: (row.availability_note as string | null) ?? null,
        quotedReply: (row.quoted_reply as string | null) ?? null,
        whyTheyReplied: (row.why_they_replied as string | null) ?? null,
        title: (row.contact_title as string | null) ?? null,
        company: (row.contact_company as string | null) ?? null,
      });
      const cardId = row.prep_card_id
        ? null
        : await insertCard(sb, {
            title: `Prep for ${name ?? "today's call"}`,
            subtitle: "Job networking call",
            why: brief.ask,
            draft: brief.questions.join("\n"),
            href: `/outreach/browning-networking?id=${id}`,
          });
      await sb
        .from("browning_handoffs")
        .update({
          brief,
          status: "brief_ready",
          ...(cardId ? { prep_card_id: cardId } : {}),
        })
        .eq("id", id);
      briefs += 1;
    }

    if (
      startsAt &&
      !row.thank_you_body &&
      callHasEnded(endsAt, startsAt, now) &&
      etYmd(startsAt) <= today
    ) {
      const summary = await transcriptSummary(
        name,
        email,
        startsAt,
        (row.call_event_id as string | null) ?? null
      );
      if (summary) {
        const composed = await composeThankYouDraft({
          name,
          summary: summary.text,
        });
        const body = composed.body;
        const cardId = await insertCard(sb, {
          title: `Thank-you draft for ${name ?? "the call"}`,
          subtitle: summary.source,
          why: "From the call transcript. Nothing sends until you do.",
          draft: body,
          href: `/outreach/browning-networking?id=${id}`,
        });
        await sb
          .from("browning_handoffs")
          .update({
            thank_you_body: body,
            thank_you_source: summary.source,
            status: "thank_you_ready",
            ...(cardId ? { thanks_card_id: cardId } : {}),
          })
          .eq("id", id);
        thankYous += 1;
      }
    }
  }
  return { booked, briefs, thankYous };
}

async function transcriptSummary(
  name: string | null,
  email: string | null,
  aroundIso: string | null,
  calendarEventId: string | null
): Promise<{ text: string; source: string } | null> {
  if (!name) return null;
  const [granola, fireflies] = await Promise.all([
    searchGranolaForContact({ contactName: name, email, aroundIso, calendarEventId }).catch(() => ({
      found: false as const,
    })),
    searchFirefliesForContact({ contactName: name }).catch(() => ({ found: false as const })),
  ]);
  if (granola.found && granola.summary) {
    return { text: granola.summary, source: "granola" };
  }
  if (fireflies.found && fireflies.summary) {
    return { text: fireflies.summary, source: "fireflies" };
  }
  return null;
}

async function upcomingEvents(): Promise<CalendarGuestEvent[]> {
  const tokens = await listGoogleAccessTokens();
  const now = new Date();
  const timeMin = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString();
  const lists = await Promise.all(
    tokens.map((account) =>
      fetchAccountCalendarEvents({ token: account.token, timeMin, timeMax }).catch(() => ({
        events: [] as CalendarApiEvent[],
      }))
    )
  );
  const out: CalendarGuestEvent[] = [];
  for (const list of lists) {
    for (const event of list.events) {
      out.push({
        id: event.id,
        summary: event.summary,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        status: event.status,
        attendees: event.attendees,
      });
    }
  }
  return out;
}

type ContactRow = {
  id: string;
  name: string | null;
  emails: string[] | null;
  linkedin_url: string | null;
};

async function loadContacts(sb: Sb): Promise<ContactRow[]> {
  const { data, error } = await sb
    .from("contacts")
    .select("id,name,emails,linkedin_url")
    .limit(5000);
  if (error) {
    console.error("[browning-networking] contacts", error);
    return [];
  }
  return (data ?? []) as ContactRow[];
}

async function collapseDuplicateHandoffs(sb: Sb): Promise<number> {
  const { data, error } = await sb
    .from("browning_handoffs")
    .select(
      "id, contact_name, contact_email, existing_contact_id, created_contact_id, call_starts_at, call_event_id, status, received_at, created_at"
    )
    .neq("status", "dismissed");
  if (error || !data?.length) return 0;

  const rows: DedupeHandoff[] = data.map((row) => ({
    id: row.id as string,
    contactName: (row.contact_name as string | null) ?? null,
    contactEmail: (row.contact_email as string | null) ?? null,
    existingContactId: (row.existing_contact_id as string | null) ?? null,
    createdContactId: (row.created_contact_id as string | null) ?? null,
    callStartsAt: (row.call_starts_at as string | null) ?? null,
    callEventId: (row.call_event_id as string | null) ?? null,
    status: row.status as HandoffStatus,
    receivedAt: (row.received_at as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
  }));

  const plan = planDuplicateDismissals(rows);
  for (const merge of plan.merges) {
    const patch: Record<string, string | null> = {};
    if (merge.patch.contactName) patch.contact_name = merge.patch.contactName;
    if (merge.patch.contactEmail) patch.contact_email = merge.patch.contactEmail;
    if (merge.patch.existingContactId) {
      patch.existing_contact_id = merge.patch.existingContactId;
    }
    if (merge.patch.callStartsAt) patch.call_starts_at = merge.patch.callStartsAt;
    if (merge.patch.callEventId) patch.call_event_id = merge.patch.callEventId;
    if (merge.patch.status) patch.status = merge.patch.status;
    if (Object.keys(patch).length) {
      await sb.from("browning_handoffs").update(patch).eq("id", merge.keepId);
    }
  }
  if (plan.dismissIds.length) {
    await sb
      .from("browning_handoffs")
      .update({ status: "dismissed" })
      .in("id", plan.dismissIds);
  }
  return plan.dismissIds.length;
}

function matchExistingContact(
  contacts: ContactRow[],
  parsed: ParsedHandoff
): ContactRow | null {
  if (parsed.email) {
    const want = canonicalEmail(parsed.email);
    const hit = contacts.find((row) =>
      (row.emails ?? []).some((email) => email && canonicalEmail(email) === want)
    );
    if (hit) return hit;
  }
  const slug = linkedInSlug(parsed.linkedinUrl);
  if (!slug) return null;
  return (
    contacts.find((row) => linkedInSlug(row.linkedin_url) === slug) ?? null
  );
}

function linkedInSlug(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

async function renameConnectTitles(sb: Sb): Promise<void> {
  const { data, error } = await sb
    .from("browning_handoffs")
    .select("id, contact_name, call_title, call_event_id")
    .not("call_event_id", "is", null);
  if (error || !data?.length) return;
  const pending = data.filter((row) => {
    const name = ((row.contact_name as string | null) ?? "").trim();
    const title = ((row.call_title as string | null) ?? "").trim();
    return Boolean(name) && title === `Call with ${name}`;
  });
  if (!pending.length) return;
  const tokens = await listGoogleAccessTokens();
  const token = tokens.find((account) => account.accountEmail === ADVISORS_ACCOUNT_EMAIL)?.token;
  if (!token) return;
  for (const row of pending) {
    const name = ((row.contact_name as string | null) ?? "").trim();
    const oldTitle = `Call with ${name}`;
    const nextTitle = connectMeetingTitle(name);
    const eventId = row.call_event_id as string;
    const renamed = await renameGoogleCalendarEvent({ token, eventId, summary: nextTitle });
    if (!renamed.ok) continue;
    await sb.from("browning_handoffs").update({ call_title: nextTitle }).eq("id", row.id as string);
    await sb.from("meetings").update({ title: nextTitle }).eq("gcal_event_id", eventId).eq("title", oldTitle);
    await sb
      .from("meetings")
      .update({ prep_goal: nextTitle })
      .eq("gcal_event_id", eventId)
      .eq("prep_goal", oldTitle);
  }
}

async function detectChosenTimes(sb: Sb): Promise<void> {
  const { data, error } = await sb
    .from("browning_handoffs")
    .select("id, contact_email, received_at, slots, status, call_starts_at")
    .is("call_starts_at", null)
    .in("status", ["times_ready", "draft_ready", "acted_on", "follow_up"])
    .limit(12);
  if (error || !data?.length) return;
  for (const row of data) {
    const email = (row.contact_email as string | null) ?? "";
    const since = (row.received_at as string | null) ?? "";
    const slots = asStoredSlots(row.slots);
    if (!email || !since || !slots.length) continue;
    const reply = await latestReplyFrom(email, since);
    if (!reply) continue;
    const words = replyWords(reply.body);
    const chosen = matchOfferedSlot(slots, reply.body);
    await sb
      .from("browning_handoffs")
      .update({
        reply_excerpt: words.slice(0, 500) || null,
        chosen_slot_start: chosen?.start ?? null,
      })
      .eq("id", row.id as string);
  }
}

function asStoredSlots(value: unknown): { id: string; start: string; end: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.start !== "string" || typeof row.end !== "string") return [];
    return [{ id: row.id, start: row.start, end: row.end }];
  });
}

async function latestReplyFrom(
  email: string,
  sinceIso: string
): Promise<{ body: string; receivedAt: string } | null> {
  const want = canonicalEmail(email);
  const sinceMs = Date.parse(sinceIso);
  let best: { body: string; receivedAt: string } | null = null;
  const consider = (from: string, body: string, receivedAt: string) => {
    if (canonicalEmail(from) !== want) return;
    const ms = Date.parse(receivedAt);
    if (!Number.isFinite(ms) || ms < sinceMs) return;
    if (!replyWords(body)) return;
    if (!best || ms > Date.parse(best.receivedAt)) best = { body, receivedAt };
  };

  const since = new Date(sinceIso);
  const slash = `${since.getUTCFullYear()}/${since.getUTCMonth() + 1}/${since.getUTCDate()}`;
  const google = await listGoogleAccessTokens();
  for (const account of google) {
    const listed = await listGmailMessages({
      query: `from:${want} after:${slash}`,
      max: 5,
      accessToken: account.token,
    });
    if (!listed.length) continue;
    const full = await getGmailMessagesFull(listed.slice(0, 3).map((item) => item.id), account.token);
    for (const message of full) {
      const receivedAt = message.internalDate ? new Date(message.internalDate).toISOString() : "";
      if (!receivedAt || !message.from) continue;
      consider(message.from, message.plaintextBody || message.snippet || "", receivedAt);
    }
  }

  const outlook = await getOutlookAccountAccess();
  if (outlook.token) {
    const found = await searchOutlookMessages(outlook.token, [`"${want}"`], sinceIso, 2).catch(() => []);
    for (const message of found) {
      consider(message.from, message.body, message.receivedAt);
    }
  }
  return best;
}

async function browningReferrerId(sb: Sb): Promise<string | null> {
  const { data, error } = await sb
    .from("contacts")
    .select("id,name,tags")
    .contains("tags", ["referral_source"]);
  if (error) {
    console.error("[browning-networking] referral source", error);
    return null;
  }
  return findReferralSourceId(
    (data ?? []).map((row) => ({
      id: row.id as string,
      name: (row.name as string) ?? "",
      tags: (row.tags as string[] | null) ?? null,
    })),
    BROWNING_SOURCE_NAME
  );
}

async function browningReferralFields(sb: Sb): Promise<{
  referred_by_contact_id: string;
  referred_at: string;
  network_degree: number;
} | Record<string, never>> {
  const id = await browningReferrerId(sb);
  if (!id) return {};
  return {
    referred_by_contact_id: id,
    referred_at: etToday(),
    network_degree: 2,
  };
}

async function linkBrowningReferrals(sb: Sb): Promise<void> {
  const browningId = await browningReferrerId(sb);
  if (!browningId) return;
  const { data, error } = await sb
    .from("browning_handoffs")
    .select("created_contact_id, existing_contact_id");
  if (error) {
    console.error("[browning-networking] referral handoffs", error);
    return;
  }
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const created = row.created_contact_id as string | null;
    const existing = row.existing_contact_id as string | null;
    if (created && created !== browningId) ids.add(created);
    if (existing && existing !== browningId) ids.add(existing);
  }
  if (!ids.size) return;
  const contacts = await sb
    .from("contacts")
    .select("id, referred_by_contact_id, network_degree, browning_source")
    .in("id", [...ids]);
  if (contacts.error) {
    console.error("[browning-networking] referral contacts", contacts.error);
    return;
  }
  for (const contact of contacts.data ?? []) {
    if (contact.referred_by_contact_id) continue;
    await sb
      .from("contacts")
      .update({
        referred_by_contact_id: browningId,
        referred_at: etToday(),
        network_degree: (contact.network_degree as number | null) ?? 2,
        ...(contact.browning_source ? {} : { browning_source: "browning_referral" }),
      })
      .eq("id", contact.id as string);
  }
}

async function insertContact(sb: Sb, parsed: ParsedHandoff): Promise<string | null> {
  if (!parsed.name) return null;
  const title = [parsed.title, parsed.company].filter(Boolean).join(" at ") || null;
  const { data, error } = await sb
    .from("contacts")
    .insert({
      name: parsed.name,
      title,
      emails: parsed.email ? [parsed.email] : [],
      phone: parsed.phone,
      linkedin_url: parsed.linkedinUrl,
      tags: ["source:browning"],
      browning_source: "browning_referral",
      ...(await browningReferralFields(sb)),
      cadence_interval: "none",
      is_networking: true,
      vip: false,
      relationship_type: null,
      intent: null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[browning-networking] create contact", error);
    return null;
  }
  return data.id as string;
}

async function insertCard(
  sb: Sb,
  input: { title: string; subtitle: string; why: string; draft: string; href: string }
): Promise<string | null> {
  const { data, error } = await sb
    .from("cards")
    .insert({
      track: "job_search",
      module: "browning_networking",
      object_type: "outreach",
      title: input.title,
      subtitle: input.subtitle,
      body: {
        draft: input.draft,
        links: [{ label: "Open Browning Networking", href: input.href }],
      },
      linked_object_ids: { href: input.href },
      state: "open",
      vip: false,
      why_now: input.why,
      verbs: ["draft", "dismiss"],
      priority_score: 80,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[browning-networking] card", error);
    return null;
  }
  return data.id as string;
}

export async function persistDraft(input: {
  handoffId: string;
  slots: HandoffSlot[];
}): Promise<{ ok: true; url: string; savedInGmail: boolean } | { ok: false; error: string }> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("browning_handoffs")
    .select("*")
    .eq("id", input.handoffId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message || "Handoff not found." };
  if (
    !canEditOfferedTimes({
      status: data.status as HandoffStatus,
      callStartsAt: (data.call_starts_at as string | null) ?? null,
      sourceKind: (data.source_kind as string | null) ?? "intro",
    })
  ) {
    return { ok: false, error: "This meeting is already set." };
  }
  const isPacket = data.source_kind === "packet";
  if (!isPacket && !input.slots.length) {
    return { ok: false, error: "Add at least one time first." };
  }

  const name = (data.contact_name as string | null) ?? null;
  const body = isPacket
    ? packetEmailDraft({ name, slots: input.slots })
    : schedulingDraft({ name, slots: input.slots });
  const to = (data.contact_email as string | null) || "";
  const subject = isPacket
    ? packetEmailSubject(name)
    : replySubject(data.subject as string | null);
  const accountEmail = data.gmail_account as string;
  const url = replyComposeUrl({
    to,
    bcc: TRACY_EMAIL,
    subject,
    body,
  });

  let gmailDraftId: string | null = (data.gmail_draft_id as string | null) ?? null;
  let savedInGmail = false;
  if (to) {
    const tokens = await listGoogleAccessTokens();
    const token = tokens.find((account) => account.accountEmail === accountEmail)?.token;
    if (token) {
      const drafted = await createGmailDraft({
        accessToken: token,
        to,
        bcc: TRACY_EMAIL,
        subject,
        body,
        threadId: isPacket ? null : (data.gmail_thread_id as string | null) ?? null,
        inReplyTo: isPacket ? null : (data.rfc822_message_id as string | null) ?? null,
      });
      if (drafted.ok) {
        gmailDraftId = drafted.id;
        savedInGmail = true;
      }
    }
  }

  const status = data.status === "times_ready" ? "draft_ready" : data.status;
  const { error: updateError } = await sb
    .from("browning_handoffs")
    .update({
      slots: input.slots,
      draft_body: body,
      gmail_draft_id: gmailDraftId,
      gmail_draft_url: url,
      status,
    })
    .eq("id", input.handoffId);
  if (updateError) return { ok: false, error: updateError.message };

  if (data.card_id) {
    await sb
      .from("cards")
      .update({
        body: {
          draft: body,
          links: [
            { label: "Open Browning Networking", href: `/outreach/browning-networking?id=${input.handoffId}` },
            {
              label: "Open reply in Apple Mail",
              href: url,
            },
          ],
        },
      })
      .eq("id", data.card_id as string);
  }
  return { ok: true, url, savedInGmail };
}
