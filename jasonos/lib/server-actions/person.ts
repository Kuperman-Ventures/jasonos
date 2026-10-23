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
  thankYouDueBy,
  type AfterDraft,
  type AfterExtract,
  type FollowUp,
  type ReceivedContact,
} from "@/lib/meeting-prep/after";
import { asNetworkingStatus, parseSheetLines, type NetworkingStatus } from "@/lib/meeting-prep/call-sheet";
import { helpThemLine } from "@/lib/meeting-prep/live-sheet";
import {
  carryDiscussNext,
  comparePeople,
  etYmdOf,
  isOverdueNext,
  isPast48h,
  nextPlaybookFamily,
} from "@/lib/meeting-prep/people";
import { FAMILY_LABELS, asFamily, type PlaybookFamily } from "@/lib/meeting-prep/playbook-blocks";
import { applyFirstContact, applyReferral } from "@/lib/people/tracking";
import {
  draftThankYou,
  formatStoredThankYou,
  parseStoredThankYou,
  type ThankYouDraft,
} from "@/lib/meeting-prep/thank-you";
import { createCallSheet, getCallSheet, getCallSheetPerson } from "@/lib/server-actions/call-sheet";
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

/* ---------- Person and People index ---------- */

export interface PersonListRow {
  id: string;
  name: string;
  company: string | null;
  status: NetworkingStatus | null;
  touchCount: number;
  nextContact: string | null;
  overdue48h: boolean;
  overdueNext: boolean;
}

export interface PersonTimelineRow {
  id: string;
  prepId: string | null;
  occurredAt: string;
  touchNumber: number;
  playbookName: string | null;
  sheetHref: string | null;
  granolaUrl: string | null;
  conversation: string | null;
  contactsReceived: RelationshipLogEntry["contactsReceived"];
  followUpWith: FollowUp[];
  nextContactAt: string | null;
  toDiscussNext: string | null;
  thankYouSentAt: string | null;
  thankYouDueAt: string | null;
}

export interface PersonOpenItem {
  text: string;
  owner: FollowUp["owner"];
  touchNumber: number;
}

export interface PersonNextMeeting {
  prepId: string;
  title: string;
  startsAt: string;
  hasSheet: boolean;
}

export interface PersonDetail {
  contactId: string;
  name: string;
  title: string | null;
  company: string | null;
  linkedinUrl: string | null;
  referrer: { id: string; name: string } | null;
  contactHref: string;
  status: NetworkingStatus | null;
  touchCount: number;
  nextContact: string | null;
  toDiscussNext: string | null;
  updatedAt: string | null;
  referralReceivedAt: string | null;
  firstContactAt: string | null;
  overdue48h: boolean;
  overdueNext: boolean;
  nextPlaybook: { family: PlaybookFamily; label: string };
  nextMeeting: PersonNextMeeting | null;
  timeline: PersonTimelineRow[];
  openItems: { mine: PersonOpenItem[]; theirs: PersonOpenItem[] };
  lastOutcome: {
    touchNumber: number;
    occurredAt: string;
    mark: string | null;
    sentence: string | null;
    note: string | null;
  } | null;
}

const PERSON_COLUMNS =
  "id, name, title, linkedin_url, tags, networking_status, touch_count, next_touch_date, to_discuss_next, referral_received_at, first_contact_at, referred_by_contact_id, updated_at, companies(name)";

type Sb = ReturnType<typeof createServiceRoleClient>;

function companyName(row: Record<string, unknown>): string | null {
  const companies = row.companies as { name?: string } | Array<{ name?: string }> | null | undefined;
  const linked = text(Array.isArray(companies) ? companies[0]?.name : companies?.name);
  if (linked) return linked;
  const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];
  const firm = tags.find((tag) => tag.startsWith("firm:"));
  return firm ? firm.slice("firm:".length).replace(/-/g, " ") : null;
}

/** Browning handoffs carry the company for people Tracy introduced. */
async function handoffCompanies(sb: Sb, contactIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let start = 0; start < contactIds.length; start += 40) {
    const list = contactIds.slice(start, start + 40).join(",");
    const { data } = await sb
      .from("browning_handoffs")
      .select("created_contact_id, existing_contact_id, contact_company")
      .or(`created_contact_id.in.(${list}),existing_contact_id.in.(${list})`)
      .not("contact_company", "is", null);
    for (const row of data ?? []) {
      const company = text(row.contact_company);
      const id = (row.existing_contact_id as string | null) || (row.created_contact_id as string | null);
      if (company && id && !out.has(id)) out.set(id, company);
    }
  }
  return out;
}

function trackingFlags(row: Record<string, unknown>, now: number, today: string) {
  const status = asNetworkingStatus(row.networking_status);
  const nextContact = asYmd(row.next_touch_date);
  return {
    status,
    nextContact,
    overdue48h: isPast48h(
      {
        status,
        referralReceivedAt: text(row.referral_received_at),
        firstContactAt: text(row.first_contact_at),
      },
      now
    ),
    overdueNext: isOverdueNext(nextContact, today),
  };
}

/** Everyone in networking motion (status set, not closed), most urgent first. */
export async function listPeople(): Promise<PersonResult<{ people: PersonListRow[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("contacts")
    .select(PERSON_COLUMNS)
    .not("networking_status", "is", null)
    .neq("networking_status", "closed")
    .limit(1000);
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const missing = rows.filter((row) => !companyName(row)).map((row) => String(row.id));
  const fromHandoffs = await handoffCompanies(sb, missing);
  const now = Date.now();
  const today = etYmdOf(now);
  const people = rows.map((row): PersonListRow => {
    const id = String(row.id);
    const flags = trackingFlags(row, now, today);
    return {
      id,
      name: text(row.name) ?? "Unnamed",
      company: companyName(row) ?? fromHandoffs.get(id) ?? null,
      status: flags.status,
      touchCount: typeof row.touch_count === "number" ? row.touch_count : 0,
      nextContact: flags.nextContact,
      overdue48h: flags.overdue48h,
      overdueNext: flags.overdueNext,
    };
  });
  people.sort(comparePeople);
  return { ok: true, people };
}

/** The next calendar meeting with this person that has not been held. */
async function nextMeetingFor(sb: Sb, contactId: string): Promise<PersonNextMeeting | null> {
  const since = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const columns = "id, title, starts_at";
  const [primary, attendee] = await Promise.all([
    sb
      .from("meeting_preps")
      .select(columns)
      .eq("primary_contact_id", contactId)
      .is("live_ended_at", null)
      .gte("starts_at", since)
      .order("starts_at", { ascending: true })
      .limit(5),
    sb
      .from("meeting_preps")
      .select(columns)
      .filter("attendees", "cs", JSON.stringify([{ contact_id: contactId }]))
      .is("live_ended_at", null)
      .gte("starts_at", since)
      .order("starts_at", { ascending: true })
      .limit(5),
  ]);
  const byId = new Map<string, { id: string; title: string; startsAt: string }>();
  for (const row of [...(primary.data ?? []), ...(attendee.data ?? [])]) {
    byId.set(String(row.id), {
      id: String(row.id),
      title: text(row.title) ?? "Meeting",
      startsAt: String(row.starts_at),
    });
  }
  const candidates = [...byId.values()].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  if (!candidates.length) return null;
  const { data: held } = await sb
    .from("relationship_log")
    .select("prep_id")
    .in(
      "prep_id",
      candidates.map((row) => row.id)
    );
  const heldIds = new Set((held ?? []).map((row) => String(row.prep_id)));
  const next = candidates.find((row) => !heldIds.has(row.id));
  if (!next) return null;
  const { count } = await sb
    .from("call_sheet_blocks")
    .select("id", { count: "exact", head: true })
    .eq("prep_id", next.id);
  return { prepId: next.id, title: next.title, startsAt: next.startsAt, hasSheet: (count ?? 0) > 0 };
}

/** One person: header, every held call with its sheet and transcript, open items, and what comes next. */
export async function getPerson(contactId: string): Promise<PersonResult<{ person: PersonDetail }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = contactId.trim();
  if (!id) return { ok: false, error: "Person not found." };
  const sb = createServiceRoleClient();
  const { data: contact, error } = await sb.from("contacts").select(PERSON_COLUMNS).eq("id", id).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!contact) return { ok: false, error: "Person not found." };
  const row = contact as Record<string, unknown>;

  const referrerId = text(row.referred_by_contact_id);
  const [logResult, referrerResult, nextMeeting, handoff] = await Promise.all([
    sb.from("relationship_log").select(LOG_COLUMNS).eq("contact_id", id).order("occurred_at", { ascending: true }),
    referrerId
      ? sb.from("contacts").select("id, name").eq("id", referrerId).maybeSingle()
      : Promise.resolve({ data: null }),
    nextMeetingFor(sb, id),
    companyName(row) ? Promise.resolve(new Map<string, string>()) : handoffCompanies(sb, [id]),
  ]);
  if (logResult.error) return { ok: false, error: logResult.error.message };
  const logs = ((logResult.data ?? []) as Array<Record<string, unknown>>).map(toLog);

  const prepIds = logs.map((log) => log.prepId).filter((value): value is string => Boolean(value));
  const [prepsResult, reviewsResult] = prepIds.length
    ? await Promise.all([
        sb
          .from("meeting_preps")
          .select("id, ends_at, script_id, outcome_mark, outcome_sentence, outcome_note, thank_you_sent_at")
          .in("id", prepIds),
        sb.from("meeting_reviews").select("prep_id, source, source_url").in("prep_id", prepIds),
      ])
    : [{ data: [] }, { data: [] }];
  const preps = new Map(
    ((prepsResult.data ?? []) as Array<Record<string, unknown>>).map((prep) => [String(prep.id), prep])
  );
  const granola = new Map<string, string>();
  for (const review of (reviewsResult.data ?? []) as Array<Record<string, unknown>>) {
    const url = text(review.source_url);
    if (url && (review.source ?? "granola") === "granola") granola.set(String(review.prep_id), url);
  }
  const scriptIds = [
    ...new Set([...preps.values()].map((prep) => text(prep.script_id)).filter((value): value is string => Boolean(value))),
  ];
  const playbookNames = new Map<string, string>();
  if (scriptIds.length) {
    const { data: scripts } = await sb.from("live_scripts").select("id, name").in("id", scriptIds);
    for (const script of scripts ?? []) {
      const name = text(script.name);
      if (name) playbookNames.set(String(script.id), name);
    }
  }

  const timeline = logs.map((log): PersonTimelineRow => {
    const prep = log.prepId ? preps.get(log.prepId) : undefined;
    const scriptId = prep ? text(prep.script_id) : null;
    return {
      id: log.id,
      prepId: log.prepId,
      occurredAt: log.occurredAt,
      touchNumber: log.touchNumber,
      playbookName: scriptId ? playbookNames.get(scriptId) ?? null : null,
      sheetHref: log.prepId ? `/meetings/${log.prepId}` : null,
      granolaUrl: log.prepId ? granola.get(log.prepId) ?? null : null,
      conversation: log.conversation,
      contactsReceived: log.contactsReceived,
      followUpWith: log.followUpWith,
      nextContactAt: log.nextContactAt,
      toDiscussNext: log.toDiscussNext,
      thankYouSentAt: log.thankYouSentAt ?? (prep ? text(prep.thank_you_sent_at) : null),
      thankYouDueAt: prep && text(prep.ends_at) ? thankYouDueBy(String(prep.ends_at)) : null,
    };
  });

  const last = logs[logs.length - 1] ?? null;
  const lastPrep = last?.prepId ? preps.get(last.prepId) : undefined;
  const openItems: PersonDetail["openItems"] = { mine: [], theirs: [] };
  for (const item of last?.followUpWith ?? []) {
    const entry = { text: item.text, owner: item.owner, touchNumber: last?.touchNumber ?? 0 };
    if (item.owner === "them") openItems.theirs.push(entry);
    else openItems.mine.push(entry);
  }

  const now = Date.now();
  const flags = trackingFlags(row, now, etYmdOf(now));
  const touchCount = typeof row.touch_count === "number" ? row.touch_count : logs.length;
  const family = nextPlaybookFamily(flags.status, touchCount);
  const referrer = referrerResult.data as { id?: string; name?: string } | null;
  return {
    ok: true,
    person: {
      contactId: id,
      name: text(row.name) ?? "Unnamed",
      title: text(row.title),
      company: companyName(row) ?? handoff.get(id) ?? null,
      linkedinUrl: text(row.linkedin_url),
      referrer: referrer?.id && text(referrer.name) ? { id: referrer.id, name: text(referrer.name) as string } : null,
      contactHref: `/outreach/people?id=${id}`,
      status: flags.status,
      touchCount,
      nextContact: flags.nextContact ?? last?.nextContactAt ?? null,
      toDiscussNext: text(row.to_discuss_next),
      updatedAt: text(row.updated_at),
      referralReceivedAt: text(row.referral_received_at),
      firstContactAt: text(row.first_contact_at),
      overdue48h: flags.overdue48h,
      overdueNext: flags.overdueNext,
      nextPlaybook: { family, label: FAMILY_LABELS[family] },
      nextMeeting,
      timeline,
      openItems,
      lastOutcome: last
        ? {
            touchNumber: last.touchNumber,
            occurredAt: last.occurredAt,
            mark: lastPrep ? text(lastPrep.outcome_mark) : null,
            sentence: lastPrep ? text(lastPrep.outcome_sentence) : null,
            note: lastPrep ? text(lastPrep.outcome_note) ?? last.conversation : last.conversation,
          }
        : null,
    },
  };
}

function revalidatePeople(contactId: string) {
  try {
    revalidatePath("/live");
    revalidatePath("/live/people");
    revalidatePath(`/live/people/${contactId}`);
  } catch {
    // Outside a Next request revalidatePath throws.
  }
}

/** Edit what to bring up next. Also updates the latest log row so Build carries the same text. */
export async function saveToDiscussNext(input: {
  contactId: string;
  toDiscussNext: string;
}): Promise<PersonResult<{ toDiscussNext: string | null; savedAt: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const contactId = input.contactId.trim();
  if (!contactId) return { ok: false, error: "Person not found." };
  const value = input.toDiscussNext.replace(/\r\n/g, "\n").trim().slice(0, 4000) || null;
  const now = new Date().toISOString();
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("contacts")
    .update({ to_discuss_next: value, updated_at: now })
    .eq("id", contactId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Person not found." };
  const { data: latest } = await sb
    .from("relationship_log")
    .select("id")
    .eq("contact_id", contactId)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest?.id) {
    const { error: logError } = await sb
      .from("relationship_log")
      .update({ to_discuss_next: value })
      .eq("id", latest.id as string);
    if (logError) return { ok: false, error: logError.message };
  }
  revalidatePeople(contactId);
  return { ok: true, toDiscussNext: value, savedAt: now };
}

/** A Browning referral came in for this person. */
export async function recordReferral(
  contactId: string,
  receivedAt: string = new Date().toISOString()
): Promise<PersonResult<{ changed: boolean }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = contactId.trim();
  if (!id) return { ok: false, error: "Person not found." };
  const result = await applyReferral(createServiceRoleClient(), id, receivedAt);
  if (!result.ok) return result;
  if (result.changed) revalidatePeople(id);
  return { ok: true, changed: result.changed };
}

/** Jason reached a referral for the first time. */
export async function recordFirstContact(
  contactId: string,
  contactedAt: string = new Date().toISOString()
): Promise<PersonResult<{ changed: boolean }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = contactId.trim();
  if (!id) return { ok: false, error: "Person not found." };
  const result = await applyFirstContact(createServiceRoleClient(), id, contactedAt);
  if (!result.ok) return result;
  if (result.changed) revalidatePeople(id);
  return { ok: true, changed: result.changed };
}

async function carryIntoWhy(sb: Sb, blocks: CallSheetBlock[], toDiscussNext: string | null): Promise<boolean> {
  const why = blocks.find((block) => block.key === "why" && block.kind === "lines");
  if (!why || why.confirmedAt) return false;
  const lines = carryDiscussNext(why.lines, toDiscussNext);
  if (!lines) return false;
  const { error } = await sb.from("call_sheet_blocks").update({ lines }).eq("id", why.id);
  if (error) {
    console.error("[startNextSheet] carry", error.message);
    return false;
  }
  return true;
}

/**
 * Start the sheet for this person's next call. Picks the playbook from their status, puts it
 * on the next calendar meeting with them (or an unattached sheet when there is none), and
 * carries to-discuss-next into the third Why line.
 */
export async function startNextSheet(contactId: string): Promise<
  PersonResult<{
    href: string;
    prepId: string | null;
    sheetId: string | null;
    playbookName: string;
    created: boolean;
    carried: boolean;
  }>
> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = contactId.trim();
  if (!id) return { ok: false, error: "Person not found." };
  const sb = createServiceRoleClient();
  const { data: contact, error } = await sb
    .from("contacts")
    .select("id, networking_status, touch_count, to_discuss_next")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!contact) return { ok: false, error: "Person not found." };
  const touchCount = typeof contact.touch_count === "number" ? contact.touch_count : 0;
  const family = nextPlaybookFamily(asNetworkingStatus(contact.networking_status), touchCount);
  const toDiscussNext = text(contact.to_discuss_next);

  const { data: playbook } = await sb
    .from("live_scripts")
    .select("id, name")
    .eq("kind", "strategy")
    .eq("family", family)
    .order("use_count", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!playbook?.id) return { ok: false, error: `No ${FAMILY_LABELS[family]} playbook yet.` };
  const playbookName = text(playbook.name) ?? FAMILY_LABELS[family];

  const meeting = await nextMeetingFor(sb, id);
  if (meeting) {
    const href = `/meetings/${meeting.prepId}`;
    if (meeting.hasSheet) {
      const existing = await getCallSheet({ prepId: meeting.prepId });
      const carried = existing.ok && existing.sheet ? await carryIntoWhy(sb, existing.sheet.blocks, toDiscussNext) : false;
      if (carried) revalidatePerson(meeting.prepId, id);
      return { ok: true, href, prepId: meeting.prepId, sheetId: null, playbookName, created: false, carried };
    }
    await sb
      .from("meeting_preps")
      .update({ primary_contact_id: id })
      .eq("id", meeting.prepId)
      .is("primary_contact_id", null);
    const created = await createCallSheet({ prepId: meeting.prepId, playbookId: playbook.id as string });
    if (!created.ok) return created;
    const carried = await carryIntoWhy(sb, created.sheet.blocks, toDiscussNext);
    revalidatePerson(meeting.prepId, id);
    revalidatePeople(id);
    return { ok: true, href, prepId: meeting.prepId, sheetId: null, playbookName, created: true, carried };
  }

  const created = await createCallSheet({ prepId: null, playbookId: playbook.id as string });
  if (!created.ok) return created;
  const sheetId = created.sheet.sheetId as string;
  const carried = await carryIntoWhy(sb, created.sheet.blocks, toDiscussNext);
  revalidatePeople(id);
  return { ok: true, href: `/live/scripts/${sheetId}`, prepId: null, sheetId, playbookName, created: true, carried };
}
