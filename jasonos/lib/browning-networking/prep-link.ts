import "server-only";

import { callClaude } from "@/lib/ai/models";
import { gmailThreadUrl } from "@/lib/meeting-prep/context-model";
import type { TodaysMeeting } from "@/lib/meeting-prep/today";
import { ensureMeetingPrepForEvent } from "@/lib/server-actions/meeting-prep";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { BookedCall } from "./booking";
import { packetForPrompt, type PacketDocument } from "./packet";
import { chooseBrowningStrategyName, shouldSkipPlanBuild } from "./prep-choice";

export {
  BROWNING_FIRST_CALL,
  BROWNING_SECOND_CALL,
  chooseBrowningStrategyName,
  shouldSkipPlanBuild,
} from "./prep-choice";

type Sb = ReturnType<typeof createServiceRoleClient>;

export type HandoffPrepRow = {
  id: string;
  contact_name?: string | null;
  contact_email?: string | null;
  subject?: string | null;
  gmail_account?: string | null;
  gmail_message_id?: string | null;
  gmail_thread_id?: string | null;
  resume_message_id?: string | null;
  resume_filename?: string | null;
  resume_text?: string | null;
  intro_reason?: string | null;
  linkedin_urls?: string[] | null;
  linkedin_url?: string | null;
  other_documents?: PacketDocument[] | unknown;
  packet_stored_at?: string | null;
  prep_id?: string | null;
  plan_built_at?: string | null;
  created_contact_id?: string | null;
  existing_contact_id?: string | null;
  call_event_id?: string | null;
  call_starts_at?: string | null;
  call_ends_at?: string | null;
  call_title?: string | null;
};

function asDocuments(value: unknown): PacketDocument[] {
  if (!Array.isArray(value)) return [];
  const out: PacketDocument[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const filename = typeof row.filename === "string" ? row.filename : "";
    const messageId = typeof row.messageId === "string" ? row.messageId : "";
    const text = typeof row.text === "string" ? row.text : "";
    if (!filename || !text) continue;
    out.push({ filename, messageId, text });
  }
  return out;
}

function contactIdOf(handoff: HandoffPrepRow): string | null {
  return handoff.existing_contact_id || handoff.created_contact_id || null;
}

function introEmailUrl(handoff: HandoffPrepRow): string | null {
  const account = (handoff.gmail_account ?? "").trim();
  const threadId = (handoff.gmail_thread_id ?? "").trim();
  if (account && threadId && !/@(outlook|hotmail|live)\.com$/i.test(account)) {
    return gmailThreadUrl(account, threadId);
  }
  return null;
}

export async function ensurePrepForHandoff(
  sb: Sb,
  handoff: HandoffPrepRow,
  match: BookedCall
): Promise<{ ok: true; prepId: string } | { ok: false; error: string }> {
  const contactId = contactIdOf(handoff);
  const email = (handoff.contact_email ?? "").trim();
  const name = (handoff.contact_name ?? "").trim() || null;
  const meeting: TodaysMeeting = {
    gcalEventId: match.id,
    icalUid: null,
    calendarSource: "google",
    title: match.title || "Networking call",
    startsAt: match.startsAt,
    endsAt: match.endsAt || match.startsAt,
    calendarUrl: null,
    conferenceUrl: null,
    location: null,
    description: null,
    attendees:
      email || contactId
        ? [
            {
              email: email || "unknown@example.com",
              name,
              contactId,
            },
          ]
        : [],
  };

  const ensured = await ensureMeetingPrepForEvent(meeting);
  if (!ensured.ok) return ensured;
  const prepId = ensured.prepId;
  const purpose =
    name
      ? `First networking call via Browning with ${name}`
      : "First networking call via Browning";

  const { data: prep } = await sb
    .from("meeting_preps")
    .select("id, purpose, handoff_id")
    .eq("id", prepId)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    handoff_id: handoff.id,
  };
  if (!(prep?.purpose as string | null)?.trim()) {
    patch.purpose = purpose;
    patch.purpose_source = "suggested";
  }
  await sb.from("meeting_preps").update(patch).eq("id", prepId);

  await sb.from("browning_handoffs").update({ prep_id: prepId }).eq("id", handoff.id);

  await writePacketSources(sb, prepId, handoff);
  return { ok: true, prepId };
}

async function writePacketSources(
  sb: Sb,
  prepId: string,
  handoff: HandoffPrepRow
): Promise<void> {
  const contactId = contactIdOf(handoff);
  const resumeExternal =
    (handoff.resume_message_id as string | null) ||
    (handoff.gmail_message_id as string | null) ||
    `resume:${handoff.id}`;
  const rows: Array<Record<string, unknown>> = [];

  if (handoff.resume_text?.trim()) {
    rows.push({
      prep_id: prepId,
      source_type: "document",
      external_id: resumeExternal,
      account_email: handoff.gmail_account ?? null,
      title: handoff.resume_filename || "Resume",
      url: contactId
        ? `/api/browning-networking/resume?contactId=${encodeURIComponent(contactId)}`
        : null,
      snippet: handoff.resume_text.slice(0, 40_000),
      relevance: 3,
      relevance_reason: "Browning resume",
    });
  }

  for (const doc of asDocuments(handoff.other_documents)) {
    rows.push({
      prep_id: prepId,
      source_type: "document",
      external_id: doc.messageId || `doc:${doc.filename}`,
      account_email: handoff.gmail_account ?? null,
      title: doc.filename,
      url: null,
      snippet: doc.text.slice(0, 40_000),
      relevance: 2,
      relevance_reason: "Browning attachment",
    });
  }

  if (handoff.intro_reason?.trim() || handoff.gmail_message_id) {
    rows.push({
      prep_id: prepId,
      source_type: "intro_email",
      external_id: (handoff.gmail_message_id as string | null) || `intro:${handoff.id}`,
      account_email: handoff.gmail_account ?? null,
      title: (handoff.subject as string | null) || "Tracy intro",
      url: introEmailUrl(handoff),
      snippet: (handoff.intro_reason ?? "").slice(0, 8_000) || null,
      relevance: 3,
      relevance_reason: "Browning intro",
    });
  }

  for (const row of rows) {
    const externalId = String(row.external_id ?? "");
    const sourceType = String(row.source_type ?? "");
    const { data: existing } = await sb
      .from("meeting_prep_sources")
      .select("id")
      .eq("prep_id", prepId)
      .eq("source_type", sourceType)
      .eq("external_id", externalId)
      .maybeSingle();
    if (existing?.id) continue;
    const { error } = await sb.from("meeting_prep_sources").insert(row);
    if (error) console.error("[browning-networking] prep source", error);
  }
}

async function generatePacketHighlights(resumeText: string | null): Promise<string[]> {
  if (!resumeText?.trim()) return [];
  try {
    const raw = await callClaude({
      model: "claude-haiku-4-5",
      maxTokens: 300,
      system:
        "Return JSON only: {\"highlights\":[\"...\",\"...\",\"...\"]}. Three facts worth mentioning on a first networking call. Each under 15 words. True to the resume. No invented claims.",
      messages: [{ role: "user", content: resumeText.slice(0, 6000) }],
    });
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as { highlights?: unknown };
    if (!Array.isArray(parsed.highlights)) return [];
    return parsed.highlights
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim().replace(/\s+/g, " ").slice(0, 120))
      .slice(0, 3);
  } catch (err) {
    console.error("[browning-networking] packet highlights", err);
    return [];
  }
}

export async function buildBrowningPlan(
  prepId: string,
  handoff: HandoffPrepRow,
  options?: { force?: boolean }
): Promise<{ ok: true; built: boolean; strategyName?: string } | { ok: false; error: string }> {
  const sb = createServiceRoleClient();
  const force = Boolean(options?.force);
  if (shouldSkipPlanBuild({ planBuiltAt: handoff.plan_built_at, force })) {
    return { ok: true, built: false };
  }

  const highlights = await generatePacketHighlights(handoff.resume_text ?? null);
  const nowIso = new Date().toISOString();
  await sb
    .from("meeting_preps")
    .update({
      plan_source: "playbook",
      packet_highlights: highlights.length ? highlights : null,
      handoff_id: handoff.id,
    })
    .eq("id", prepId);
  await sb
    .from("browning_handoffs")
    .update({ plan_built_at: nowIso, prep_id: prepId })
    .eq("id", handoff.id);

  return { ok: true, built: true, strategyName: chooseBrowningStrategyName(false) };
}

/** Reload handoff packet columns after booking for plan build. */
export async function loadHandoffForPrep(
  sb: Sb,
  handoffId: string
): Promise<HandoffPrepRow | null> {
  const { data, error } = await sb
    .from("browning_handoffs")
    .select(
      "id, contact_name, contact_email, subject, gmail_account, gmail_message_id, gmail_thread_id, resume_message_id, resume_filename, resume_text, intro_reason, linkedin_urls, linkedin_url, other_documents, packet_stored_at, prep_id, plan_built_at, created_contact_id, existing_contact_id, call_event_id, call_starts_at, call_ends_at, call_title"
    )
    .eq("id", handoffId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[browning-networking] load handoff", error);
    return null;
  }
  return data as HandoffPrepRow;
}

export function packetPromptFromHandoff(handoff: HandoffPrepRow) {
  return packetForPrompt({
    resumeText: handoff.resume_text ?? null,
    introReason: handoff.intro_reason ?? null,
    linkedinUrls: handoff.linkedin_urls ?? null,
    otherDocuments: asDocuments(handoff.other_documents),
  });
}
