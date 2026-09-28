import "server-only";

import { etToday, etYmd } from "@/lib/dates";
import { createGmailDraft, getGmailMessagesFull, listGmailMessages } from "@/lib/integrations/gmail";
import { latestOutlookSentTo, searchOutlookMessages } from "@/lib/integrations/outlook";
import { getOutlookAccountAccess } from "@/lib/integrations/outlook-tokens";
import {
  fetchAccountCalendarEvents,
  type CalendarApiEvent,
} from "@/lib/integrations/google-calendar";
import { listGoogleAccessTokens } from "@/lib/integrations/google-tokens";
import { searchFirefliesForContact } from "@/lib/integrations/fireflies";
import { searchGranolaForContact } from "@/lib/integrations/granola";
import { canonicalEmail } from "@/lib/outreach/contact-lookup";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { findBookedCall, type CalendarGuestEvent } from "./booking";
import {
  briefFromHandoff,
  callHasEnded,
  isCallMorning,
  replyComposeUrl,
  followUpDraft,
  replySubject,
  schedulingDraft,
  thankYouDraft,
} from "./draft";
import { chooseHandoffs, handoffKind, type HandoffMail } from "./parse";
import { loadBusy } from "./data";
import { firstEligibleYmd, lastEligibleYmd, proposeSlots } from "./slots";
import { isAlreadyTracked, FOLLOW_UP_LOOKBACK_DAYS, shouldQueueFollowUp } from "./follow-up";
import { HANDOFF_OPENING, TRACY_EMAIL, type HandoffSlot, type ParsedHandoff } from "./types";

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
  error?: string;
};

function gmailSearches(days: number): string[] {
  return [
    `from:${TRACY_EMAIL} newer_than:${days}d`,
    `"${HANDOFF_OPENING}" newer_than:${days}d`,
    `"Attached please find the resume for" newer_than:${days}d`,
  ];
}
const OUTLOOK_SEARCHES = [
  `"${HANDOFF_OPENING}"`,
  `"Attached please find the resume for"`,
];

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
  };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ...result, error: "Supabase is not configured." };
  }
  result.configured = true;
  const sb = createServiceRoleClient();

  try {
    const harvested = await harvestHandoffs(sb);
    result.found = harvested.found;
    result.created = harvested.created;
    result.skippedExisting = harvested.skippedExisting;
    const followedUp = await harvestFollowUps(sb);
    result.followUps = followedUp;
    const followed = await followBookedCalls(sb);
    result.booked = followed.booked;
    result.briefs = followed.briefs;
    result.thankYous = followed.thankYous;
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
  const busy = await loadBusy(firstEligibleYmd(now), lastEligibleYmd(now));
  const chosen = chooseHandoffs(collected.messages);

  for (const item of chosen) {
    found += 1;
    const mail = item.mail;
    const parsed = item.parsed;
    const existing = await sb
      .from("browning_handoffs")
      .select("id")
      .eq("gmail_account", mail.accountEmail)
      .eq("gmail_message_id", mail.messageId)
      .maybeSingle();
    if (existing.data?.id) continue;

    const match = matchExistingContact(contacts, parsed);
    let createdContactId: string | null = null;
    if (!match && parsed.name) {
      createdContactId = await insertContact(sb, parsed);
    }
    if (match) skippedExisting += 1;

    const slots = proposeSlots({
      now,
      busy,
      availabilityNote: parsed.availabilityNote,
    });
    const draft = schedulingDraft({ name: parsed.name, slots });

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
        slots,
        draft_body: draft,
        status: "times_ready",
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) {
      console.error("[browning-networking] insert", inserted.error);
      continue;
    }
    const handoffId = inserted.data.id as string;
    const cardId = await insertCard(sb, {
      title: `Reply to ${parsed.name ?? "Browning contact"}`,
      subtitle: parsed.availabilityNote || "Pick times, then open the reply.",
      why: "Tracy's handoff is in. Nothing sends until you do.",
      draft,
      href: `/outreach/browning-networking?id=${handoffId}`,
    });
    if (cardId) {
      await sb.from("browning_handoffs").update({ card_id: cardId }).eq("id", handoffId);
    }
    created += 1;
  }
  return { found, created, skippedExisting };
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
      if (!handoffKind(body) || !message.from) continue;
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
      const found = await searchOutlookMessages(
        outlook.token,
        OUTLOOK_SEARCHES,
        since,
        lookbackDays > 30 ? 6 : 2
      );
      for (const message of found) {
        if (!handoffKind(message.body)) continue;
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

async function harvestFollowUps(sb: Sb): Promise<number> {
  const collected = await collectHandoffMail(FOLLOW_UP_LOOKBACK_DAYS);
  if (!collected.searched) return 0;
  const chosen = chooseHandoffs(collected.messages);
  const { data: existingRows, error } = await sb
    .from("browning_handoffs")
    .select("gmail_account, gmail_message_id, contact_email, contact_name");
  if (error) {
    console.error("[browning-networking] follow-up existing", error);
    return 0;
  }
  const seenMessages = new Set(
    (existingRows ?? []).map((row) => `${row.gmail_account}:${row.gmail_message_id}`)
  );
  const tracked = (existingRows ?? []).map((row) => ({
    email: (row.contact_email as string | null) ?? null,
    name: (row.contact_name as string | null) ?? null,
  }));
  const contacts = await loadContacts(sb);
  const events = await calendarEventsBetween(
    new Date(Date.now() - FOLLOW_UP_LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
  );
  let created = 0;

  for (const item of chosen) {
    const mail = item.mail;
    const parsed = item.parsed;
    if (!parsed.email || !parsed.name) continue;
    if (seenMessages.has(`${mail.accountEmail}:${mail.messageId}`)) continue;
    const alreadyTracked = isAlreadyTracked(tracked, { email: parsed.email, name: parsed.name });
    const hasMeeting = Boolean(
      findBookedCall(events, { email: parsed.email, name: parsed.name }, new Date(), true)
    );
    const outreach = alreadyTracked || hasMeeting ? null : await lastOutreachTo(parsed.email, mail.receivedAt);
    if (
      !shouldQueueFollowUp({
        alreadyTracked,
        hasMeeting,
        hasOutreach: Boolean(outreach),
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
    created += 1;
  }
  return created;
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

  const events = await upcomingEvents();
  const now = new Date();
  const today = etToday();
  let booked = 0;
  let briefs = 0;
  let thankYous = 0;

  for (const row of data) {
    const id = row.id as string;
    const name = (row.contact_name as string | null) ?? null;
    const email = (row.contact_email as string | null) ?? null;
    let startsAt = (row.call_starts_at as string | null) ?? null;
    let endsAt = (row.call_ends_at as string | null) ?? null;
    let status = row.status as string;

    if (!startsAt) {
      const match = findBookedCall(events, { email, name }, now);
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
      const summary = await transcriptSummary(name, email);
      if (summary) {
        const body = thankYouDraft({ name, summary: summary.text });
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
  email: string | null
): Promise<{ text: string; source: string } | null> {
  if (!name) return null;
  const [granola, fireflies] = await Promise.all([
    searchGranolaForContact({ contactName: name, email }).catch(() => ({ found: false as const })),
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
  emails: string[] | null;
  linkedin_url: string | null;
};

async function loadContacts(sb: Sb): Promise<ContactRow[]> {
  const { data, error } = await sb
    .from("contacts")
    .select("id,emails,linkedin_url")
    .limit(5000);
  if (error) {
    console.error("[browning-networking] contacts", error);
    return [];
  }
  return (data ?? []) as ContactRow[];
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
  if (!input.slots.length) return { ok: false, error: "Add at least one time first." };

  const body = schedulingDraft({
    name: (data.contact_name as string | null) ?? null,
    slots: input.slots,
  });
  const to = (data.contact_email as string | null) || "";
  const subject = replySubject(data.subject as string | null);
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
        threadId: (data.gmail_thread_id as string | null) ?? null,
        inReplyTo: (data.rfc822_message_id as string | null) ?? null,
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
