"use server";

import { revalidatePath } from "next/cache";
import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";
import { callClaude } from "@/lib/ai/models";
import {
  EMPTY_AFTER,
  acceptedContacts,
  afterDraftFromLines,
  afterDraftToLines,
  afterExtractSystemPrompt,
  asYmd,
  buildAfterExtractMessage,
  parseAfterExtract,
  statusAfterTouch,
  type AfterDraft,
  type AfterExtract,
  type FollowUp,
  type ReceivedContact,
} from "@/lib/meeting-prep/after";
import { asNetworkingStatus, parseSheetLines, type NetworkingStatus } from "@/lib/meeting-prep/call-sheet";
import { helpThemLine } from "@/lib/meeting-prep/live-sheet";
import { asFamily } from "@/lib/meeting-prep/playbook-blocks";
import {
  draftThankYou,
  formatStoredThankYou,
  parseStoredThankYou,
  type ThankYouDraft,
} from "@/lib/meeting-prep/thank-you";
import { getCallSheet, getCallSheetPerson } from "@/lib/server-actions/call-sheet";
import { createContactUnclassified } from "@/lib/server-actions/contacts";
import { getMeetingPoints } from "@/lib/server-actions/meeting-points";
import { narrativesForTrack } from "@/lib/server-actions/narratives";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { CallSheetBlock } from "@/lib/meeting-prep/call-sheet";
import type { Track } from "@/lib/types";

type PersonResult<T> = ({ ok: true } & T) | { ok: false; error: string };

export interface RelationshipLogEntry {
  id: string;
  contactId: string;
  prepId: string | null;
  occurredAt: string;
  touchNumber: number;
  conversation: string | null;
  contactsReceived: Array<{ name: string; company: string | null; note: string | null; contactId: string | null }>;
  followUpWith: FollowUp[];
  nextContactAt: string | null;
  toDiscussNext: string | null;
  thankYouSentAt: string | null;
  loggedAt: string;
}

const LOG_COLUMNS =
  "id, contact_id, prep_id, occurred_at, touch_number, conversation, contacts_received, follow_up_with, next_contact_at, to_discuss_next, thank_you_sent_at, created_at";

function hasConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function revalidatePerson(prepId: string, contactId?: string | null) {
  try {
    revalidatePath("/live");
    revalidatePath("/live/people");
    revalidatePath(`/meetings/${prepId}`);
    revalidatePath("/meetings/[id]", "page");
    if (contactId) revalidatePath("/outreach/people");
  } catch {
    // Outside a Next request revalidatePath throws.
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toLog(row: Record<string, unknown>): RelationshipLogEntry {
  const received = Array.isArray(row.contacts_received) ? row.contacts_received : [];
  const follow = Array.isArray(row.follow_up_with) ? row.follow_up_with : [];
  return {
    id: String(row.id),
    contactId: String(row.contact_id),
    prepId: text(row.prep_id),
    occurredAt: String(row.occurred_at),
    touchNumber: typeof row.touch_number === "number" ? row.touch_number : 1,
    conversation: text(row.conversation),
    contactsReceived: received
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        name: text(item.name) ?? "",
        company: text(item.company),
        note: text(item.note),
        contactId: text(item.contactId ?? item.contact_id),
      }))
      .filter((item) => item.name),
    followUpWith: follow
      .map((item): FollowUp | null => {
        if (typeof item === "string") return item.trim() ? { text: item.trim(), owner: "me" } : null;
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const body = text(row.text);
        return body ? { text: body, owner: row.owner === "them" ? "them" : "me" } : null;
      })
      .filter((item): item is FollowUp => Boolean(item)),
    nextContactAt: asYmd(row.next_contact_at),
    toDiscussNext: text(row.to_discuss_next),
    thankYouSentAt: text(row.thank_you_sent_at),
    loggedAt: String(row.created_at),
  };
}

export async function getRelationshipLogForMeeting(
  prepId: string
): Promise<PersonResult<{ log: RelationshipLogEntry | null }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };
  const sb = createServiceRoleClient();
  const { data, error } = await sb.from("relationship_log").select(LOG_COLUMNS).eq("prep_id", id).maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, log: data ? toLog(data as Record<string, unknown>) : null };
}

function cleanDraft(input: AfterDraft): AfterDraft {
  const contacts: ReceivedContact[] = (input.contactsReceived ?? [])
    .map((row): ReceivedContact => ({
      name: String(row.name ?? "").trim(),
      company: row.company?.trim() || null,
      note: row.note?.trim() || null,
      status: row.status === "accepted" || row.status === "dismissed" ? row.status : "suggested",
    }))
    .filter((row) => row.name);
  const follow: FollowUp[] = (input.followUpWith ?? [])
    .map((row): FollowUp => ({ text: String(row.text ?? "").trim(), owner: row.owner === "them" ? "them" : "me" }))
    .filter((row) => row.text);
  return {
    conversation: String(input.conversation ?? "").replace(/\r\n/g, "\n").trim(),
    contactsReceived: contacts,
    followUpWith: follow,
    nextContactAt: asYmd(input.nextContactAt),
    toDiscussNext: String(input.toDiscussNext ?? "").replace(/\r\n/g, "\n").trim(),
  };
}

/** Write the draft onto the meeting's After block, adding the block when the sheet has none. */
async function writeAfterBlock(prepId: string, draft: AfterDraft): Promise<PersonResult<{ block: CallSheetBlock }>> {
  const sb = createServiceRoleClient();
  const lines = afterDraftToLines(draft);
  const { data: rows, error } = await sb
    .from("call_sheet_blocks")
    .select("id, position, kind")
    .eq("prep_id", prepId)
    .order("position", { ascending: true });
  if (error) return { ok: false, error: error.message };
  if (!rows?.length) return { ok: false, error: "Start a call sheet first." };
  const after = rows.find((row) => row.kind === "after");
  let blockId = after?.id as string | undefined;
  if (blockId) {
    const { error: updateError } = await sb.from("call_sheet_blocks").update({ lines }).eq("id", blockId);
    if (updateError) return { ok: false, error: updateError.message };
  } else {
    const last = rows.reduce((max, row) => Math.max(max, Number(row.position) || 0), 0);
    const { data: inserted, error: insertError } = await sb
      .from("call_sheet_blocks")
      .insert({
        prep_id: prepId,
        position: last + 1,
        key: "after",
        title: "After",
        kind: "after",
        required: false,
        body: null,
        lines,
        rule: null,
      })
      .select("id")
      .single();
    if (insertError) return { ok: false, error: insertError.message };
    blockId = inserted.id as string;
  }
  const sheet = await getCallSheet({ prepId });
  if (!sheet.ok) return sheet;
  const block = sheet.sheet?.blocks.find((item) => item.id === blockId);
  if (!block) return { ok: false, error: "Could not read the After block." };
  return { ok: true, block };
}

/** Save the After fields on the sheet. Nothing is logged and the person does not change. */
export async function saveAfterDraft(input: {
  prepId: string;
  draft: AfterDraft;
}): Promise<PersonResult<{ block: CallSheetBlock; draft: AfterDraft }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const prepId = input.prepId.trim();
  if (!prepId) return { ok: false, error: "Meeting prep not found." };
  const draft = cleanDraft(input.draft);
  const written = await writeAfterBlock(prepId, draft);
  if (!written.ok) return written;
  revalidatePerson(prepId);
  return { ok: true, block: written.block, draft: afterDraftFromLines(written.block.lines) ?? draft };
}

/** Read the review's transcript or summary and draft the After fields from it. Nothing is saved. */
export async function prefillAfterFromReview(
  prepId: string
): Promise<PersonResult<{ extract: AfterExtract; sourceKind: "transcript" | "summary" }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };
  const sb = createServiceRoleClient();
  const [{ data: review, error }, { data: prep }, points, person] = await Promise.all([
    sb.from("meeting_reviews").select("source_text, source_kind").eq("prep_id", id).maybeSingle(),
    sb.from("meeting_preps").select("outcome_sentence").eq("id", id).maybeSingle(),
    getMeetingPoints(id),
    getCallSheetPerson(id),
  ]);
  if (error) return { ok: false, error: error.message };
  const source = text(review?.source_text);
  const kind = review?.source_kind === "transcript" ? "transcript" : "summary";
  if (!source) return { ok: false, error: "No transcript yet. Review the transcript first." };

  let reply: string;
  try {
    reply = await callClaude({
      model: "claude-sonnet-4-6",
      maxTokens: 1500,
      system: afterExtractSystemPrompt(NO_AI_SLOP_WRITING_RULES),
      messages: [
        {
          role: "user",
          content: buildAfterExtractMessage({
            personName: person.ok ? person.person?.name ?? null : null,
            outcomeSentence: text(prep?.outcome_sentence),
            points: points.ok
              ? points.points
                  .filter((point) => point.kind !== "agenda")
                  .map((point) => ({ headline: point.headline, state: point.state, note: point.note }))
              : [],
            source: source.slice(0, 60_000),
          }),
        },
      ],
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not read the transcript." };
  }
  const extract = parseAfterExtract(reply);
  if (!extract) return { ok: false, error: "Could not read the drafted After fields." };
  return { ok: true, extract, sourceKind: kind };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/** Accepted names become People rows referred by this person. An existing row with the same name is reused. */
async function ensureReferralContacts(
  rows: ReceivedContact[],
  referrerId: string
): Promise<{ contacts: RelationshipLogEntry["contactsReceived"]; warnings: string[] }> {
  const sb = createServiceRoleClient();
  const now = new Date().toISOString();
  const contacts: RelationshipLogEntry["contactsReceived"] = [];
  const warnings: string[] = [];
  for (const row of rows) {
    const { data: found } = await sb
      .from("contacts")
      .select("id, referred_by_contact_id, networking_status, referral_received_at")
      .ilike("name", escapeLike(row.name))
      .limit(1)
      .maybeSingle();
    let contactId = (found?.id as string | undefined) ?? null;
    if (!contactId) {
      const created = await createContactUnclassified({ name: row.name, firm: row.company });
      if (!created.ok) {
        warnings.push(`${row.name}: ${created.error}`);
        contacts.push({ name: row.name, company: row.company, note: row.note, contactId: null });
        continue;
      }
      contactId = created.contactId;
    }
    if (contactId === referrerId) continue;
    const patch: Record<string, unknown> = {};
    if (!found?.referred_by_contact_id) patch.referred_by_contact_id = referrerId;
    if (!found?.networking_status) patch.networking_status = "referral";
    if (!found?.referral_received_at) patch.referral_received_at = now;
    if (Object.keys(patch).length) {
      const { error } = await sb.from("contacts").update({ ...patch, updated_at: now }).eq("id", contactId);
      if (error) warnings.push(`${row.name}: ${error.message}`);
    }
    contacts.push({ name: row.name, company: row.company, note: row.note, contactId });
  }
  return { contacts, warnings };
}

async function thankYouInputs(prepId: string, draft: AfterDraft) {
  const sb = createServiceRoleClient();
  const [{ data: prep }, sheet, points, person] = await Promise.all([
    sb
      .from("meeting_preps")
      .select("id, title, track, primary_contact_id, script_id")
      .eq("id", prepId)
      .maybeSingle(),
    getCallSheet({ prepId }),
    getMeetingPoints(prepId),
    getCallSheetPerson(prepId),
  ]);
  if (!prep) return null;
  const contactId = person.ok ? person.person?.contactId ?? null : null;
  let company: string | null = null;
  let referrerName: string | null = null;
  if (contactId) {
    const { data: contact } = await sb
      .from("contacts")
      .select("referred_by_contact_id, companies(name)")
      .eq("id", contactId)
      .maybeSingle();
    const companies = contact?.companies as { name?: string } | Array<{ name?: string }> | null | undefined;
    company = text(Array.isArray(companies) ? companies[0]?.name : companies?.name);
    if (contact?.referred_by_contact_id) {
      const { data: referrer } = await sb
        .from("contacts")
        .select("name")
        .eq("id", contact.referred_by_contact_id as string)
        .maybeSingle();
      referrerName = text(referrer?.name)?.split(/\s+/)[0] ?? null;
    }
  }
  const blocks = sheet.ok ? sheet.sheet?.blocks ?? [] : [];
  const afterBlock = blocks.find((block) => block.kind === "after") ?? null;
  const topics = points.ok
    ? points.points
        .filter(
          (point) =>
            point.kind !== "agenda" &&
            point.kind !== "ask" &&
            (point.confirmedState === "covered" || (!point.confirmedState && point.state === "covered"))
        )
        .map((point) => point.headline)
    : [];
  const narratives = await narrativesForTrack((prep.track as Track | null) ?? null);
  return {
    prep: {
      title: String(prep.title ?? ""),
      personName: person.ok ? person.person?.name ?? null : null,
      company,
      role: null,
      family: sheet.ok && sheet.sheet?.playbook ? sheet.sheet.playbook.family : asFamily(null),
      topics,
      helpThem: helpThemLine(blocks),
      referrerName,
    },
    afterBlock: { template: afterBlock?.body ?? null, draft },
    narratives: narratives.ok ? narratives.narratives : [],
  };
}

async function draftFor(prepId: string, draft: AfterDraft): Promise<PersonResult<{ thankYou: ThankYouDraft; warning: string | null }>> {
  const input = await thankYouInputs(prepId, draft);
  if (!input) return { ok: false, error: "Meeting prep not found." };
  const drafted = await draftThankYou(input, {
    writingRules: NO_AI_SLOP_WRITING_RULES,
    generate: ({ system, message }) =>
      callClaude({ model: "claude-sonnet-4-6", maxTokens: 800, system, messages: [{ role: "user", content: message }] }),
  });
  return { ok: true, thankYou: { subject: drafted.subject, body: drafted.body }, warning: drafted.warning };
}

async function savedDraft(prepId: string): Promise<AfterDraft> {
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("call_sheet_blocks")
    .select("lines")
    .eq("prep_id", prepId)
    .eq("kind", "after")
    .limit(1)
    .maybeSingle();
  return afterDraftFromLines(parseSheetLines(data?.lines)) ?? EMPTY_AFTER;
}

/** Draft the five-part thank-you from the saved After fields. Nothing is saved or sent. */
export async function draftThankYouForMeeting(
  prepId: string,
  draft?: AfterDraft | null
): Promise<PersonResult<{ thankYou: ThankYouDraft; warning: string | null }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };
  return draftFor(id, draft ? cleanDraft(draft) : await savedDraft(id));
}

export async function saveThankYouDraft(input: {
  prepId: string;
  subject: string;
  body: string;
}): Promise<PersonResult<{ thankYou: ThankYouDraft; savedAt: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const prepId = input.prepId.trim();
  if (!prepId) return { ok: false, error: "Meeting prep not found." };
  const thankYou = { subject: input.subject.trim().replace(/\s+/g, " ").slice(0, 160), body: input.body.replace(/\r\n/g, "\n").trim() };
  if (!thankYou.body) return { ok: false, error: "Write the note first." };
  const now = new Date().toISOString();
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_preps")
    .update({ thank_you_draft: formatStoredThankYou(thankYou), updated_at: now })
    .eq("id", prepId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Meeting prep not found." };
  revalidatePerson(prepId);
  return { ok: true, thankYou, savedAt: now };
}

function easternYmd(iso: string): string | null {
  const at = Date.parse(iso);
  return Number.isNaN(at) ? null : new Date(at).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/**
 * One click after the call: save the After fields, write or update this meeting's
 * relationship_log row, move the person (touch count, status, next touch, to discuss next),
 * add the people they pointed Jason to, and store the thank-you draft. Nothing is sent.
 */
export async function confirmAfter(input: {
  prepId: string;
  conversation: string;
  contactsReceived: ReceivedContact[];
  followUpWith: FollowUp[];
  nextContactAt: string | null;
  toDiscussNext: string;
  thankYouDraft?: string | null;
}): Promise<
  PersonResult<{
    log: RelationshipLogEntry;
    block: CallSheetBlock;
    thankYou: ThankYouDraft;
    touchCount: number;
    networkingStatus: NetworkingStatus | null;
    warnings: string[];
  }>
> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const prepId = input.prepId.trim();
  if (!prepId) return { ok: false, error: "Meeting prep not found." };
  const draft = cleanDraft(input);
  const sb = createServiceRoleClient();

  const { data: prep, error: prepError } = await sb
    .from("meeting_preps")
    .select("id, starts_at, thank_you_draft, thank_you_sent_at")
    .eq("id", prepId)
    .maybeSingle();
  if (prepError) return { ok: false, error: prepError.message };
  if (!prep) return { ok: false, error: "Meeting prep not found." };
  const personResult = await getCallSheetPerson(prepId);
  if (!personResult.ok) return personResult;
  const person = personResult.person;
  if (!person) return { ok: false, error: "Link this meeting to a person before you confirm." };

  const written = await writeAfterBlock(prepId, draft);
  if (!written.ok) return written;

  const warnings: string[] = [];
  const received = await ensureReferralContacts(acceptedContacts(draft), person.contactId);
  warnings.push(...received.warnings);

  const fields = {
    conversation: draft.conversation || null,
    contacts_received: received.contacts,
    follow_up_with: draft.followUpWith,
    next_contact_at: draft.nextContactAt,
    to_discuss_next: draft.toDiscussNext || null,
    thank_you_sent_at: (prep.thank_you_sent_at as string | null) ?? null,
  };
  const { data: existing, error: existingError } = await sb
    .from("relationship_log")
    .select("id")
    .eq("prep_id", prepId)
    .maybeSingle();
  if (existingError) return { ok: false, error: existingError.message };
  let logRow: Record<string, unknown> | null = null;
  if (existing) {
    const { data, error } = await sb
      .from("relationship_log")
      .update({ ...fields, contact_id: person.contactId })
      .eq("id", existing.id as string)
      .select(LOG_COLUMNS)
      .single();
    if (error) return { ok: false, error: error.message };
    logRow = data as Record<string, unknown>;
  } else {
    const { count, error: countError } = await sb
      .from("relationship_log")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", person.contactId);
    if (countError) return { ok: false, error: countError.message };
    const { data, error } = await sb
      .from("relationship_log")
      .insert({
        ...fields,
        contact_id: person.contactId,
        prep_id: prepId,
        occurred_at: prep.starts_at as string,
        touch_number: (count ?? 0) + 1,
      })
      .select(LOG_COLUMNS)
      .single();
    if (error) return { ok: false, error: error.message };
    logRow = data as Record<string, unknown>;
  }
  const log = toLog(logRow);

  const { count: touchCount } = await sb
    .from("relationship_log")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", person.contactId);
  const { data: contact } = await sb
    .from("contacts")
    .select("networking_status, last_touch_date, first_contact_at")
    .eq("id", person.contactId)
    .maybeSingle();
  const touches = touchCount ?? log.touchNumber;
  const status = statusAfterTouch(asNetworkingStatus(contact?.networking_status), touches);
  const meetingDay = easternYmd(prep.starts_at as string);
  const lastTouch = text(contact?.last_touch_date);
  const now = new Date().toISOString();
  const contactPatch: Record<string, unknown> = {
    touch_count: touches,
    to_discuss_next: draft.toDiscussNext || null,
    networking_status: status,
    updated_at: now,
  };
  if (draft.nextContactAt) {
    contactPatch.next_touch_date = draft.nextContactAt;
    contactPatch.next_touch_is_manual = true;
  }
  if (meetingDay && (!lastTouch || lastTouch < meetingDay)) {
    contactPatch.last_touch_date = meetingDay;
    contactPatch.last_touch_channel = "meeting";
  }
  if (!contact?.first_contact_at) contactPatch.first_contact_at = prep.starts_at;
  const { error: contactError } = await sb.from("contacts").update(contactPatch).eq("id", person.contactId);
  if (contactError) return { ok: false, error: contactError.message };

  let thankYou = parseStoredThankYou(input.thankYouDraft) ?? parseStoredThankYou(prep.thank_you_draft as string | null);
  if (!thankYou?.body) {
    const drafted = await draftFor(prepId, draft);
    if (!drafted.ok) return drafted;
    thankYou = drafted.thankYou;
    if (drafted.warning) warnings.push(drafted.warning);
  }
  const { error: thankError } = await sb
    .from("meeting_preps")
    .update({ thank_you_draft: formatStoredThankYou(thankYou), updated_at: now })
    .eq("id", prepId);
  if (thankError) return { ok: false, error: thankError.message };

  revalidatePerson(prepId, person.contactId);
  return {
    ok: true,
    log,
    block: written.block,
    thankYou,
    touchCount: touches,
    networkingStatus: status,
    warnings,
  };
}

/** Jason sent the note himself. Records when, on the meeting and on its log row. */
export async function markThankYouSent(prepId: string): Promise<PersonResult<{ sentAt: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };
  const now = new Date().toISOString();
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_preps")
    .update({ thank_you_sent_at: now, updated_at: now })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Meeting prep not found." };
  const { error: logError } = await sb.from("relationship_log").update({ thank_you_sent_at: now }).eq("prep_id", id);
  if (logError) return { ok: false, error: logError.message };
  revalidatePerson(id);
  return { ok: true, sentAt: now };
}
