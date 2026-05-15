"use server";

import { revalidatePath } from "next/cache";
import { callClaude } from "@/lib/ai/models";
import { JASON_CORE_VOICE } from "@/lib/ai/prompts";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  gatherFirefliesHistory,
  gatherGmailHistory,
  gatherGranolaHistory,
  gatherHubSpotHistory,
  loadContactContext,
  type ContactContext,
  type DraftSource,
} from "@/lib/server-actions/draft-from-history";
import type { Intent } from "@/lib/triage/types";
import type {
  FirstContactDraftStage,
  FirstContactStage,
  FirstContactStageEvent,
  FirstContactState,
} from "@/lib/first-contact/types";
import type { CadenceInterval, RelationshipType } from "@/lib/outreach/types";
import { nextTouchFromCadence } from "@/lib/outreach/types";

type ActionResult = { ok: true } | { ok: false; error: string };
type Track = "advisors" | "job_search" | "venture" | "personal";

interface FirstContactCardBody {
  firm?: string | null;
  specialty?: string | null;
  why_target?: string | null;
  first_contact?: FirstContactState;
}

export async function addColdTarget(input: {
  name: string;
  firm: string;
  title?: string;
  linkedinUrl?: string;
  email?: string;
  intent: Intent;
  personalGoal?: string;
  track?: Track;
  whyTarget?: string;
  specialty?: string;
  /** Optional outreach sorting fields (defaults: prospect / no cadence / false). */
  relationshipType?: RelationshipType | null;
  cadence?: CadenceInterval | null;
  vip?: boolean;
}): Promise<{ ok: true; contactId: string; cardId: string } | { ok: false; error: string }> {
  if (!input.name.trim() || !input.firm.trim()) {
    return { ok: false, error: "Name and firm are required." };
  }
  if (!hasSupabaseServiceRole()) {
    return { ok: false, error: "Supabase service role is not configured." };
  }

  const sb = createServiceRoleClient();
  const firmTag = `firm:${slugify(input.firm)}`;
  const track = input.track ?? "job_search";
  const linkedinUrl = input.linkedinUrl?.trim() || null;
  const email = input.email?.trim() || null;
  const relationshipType: RelationshipType = input.relationshipType ?? "prospect";
  const cadence: CadenceInterval = input.cadence ?? "none";
  const nextTouch = cadence === "none" ? null : nextTouchFromCadence(cadence);
  const vip = input.vip === true;

  const existingContact = linkedinUrl
    ? await sb
        .from("contacts")
        .select("id,tags")
        .eq("linkedin_url", linkedinUrl)
        .maybeSingle()
    : await sb
        .from("contacts")
        .select("id,tags")
        .eq("name", input.name.trim())
        .contains("tags", [firmTag])
        .maybeSingle();

  if (existingContact.error) return { ok: false, error: existingContact.error.message };

  let contactId: string;
  if (existingContact.data) {
    contactId = existingContact.data.id as string;
    const tags = addTags((existingContact.data.tags as string[] | null) ?? [], [
      "role:cold_target",
      firmTag,
    ]);
    const { error } = await sb
      .from("contacts")
      .update({
        name: input.name.trim(),
        title: input.title?.trim() || null,
        linkedin_url: linkedinUrl,
        emails: email ? [email] : undefined,
        tracks: [track],
        tags,
        intent: input.intent,
        personal_goal: input.personalGoal?.trim() || null,
        relationship_type: relationshipType,
        cadence_interval: cadence,
        next_touch_date: nextTouch,
        vip,
      })
      .eq("id", contactId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: newContact, error } = await sb
      .from("contacts")
      .insert({
        name: input.name.trim(),
        title: input.title?.trim() || null,
        linkedin_url: linkedinUrl,
        emails: email ? [email] : [],
        tracks: [track],
        tags: ["role:cold_target", firmTag],
        intent: input.intent,
        personal_goal: input.personalGoal?.trim() || null,
        relationship_type: relationshipType,
        cadence_interval: cadence,
        next_touch_date: nextTouch,
        vip,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    contactId = newContact.id as string;
  }

  const existingCard = await sb
    .from("cards")
    .select("id")
    .eq("module", "reconnect")
    .eq("object_type", "cold_target")
    .eq("linked_object_ids->>contact_id", contactId)
    .maybeSingle();

  if (existingCard.data?.id) {
    revalidateReconnect();
    return { ok: true, contactId, cardId: existingCard.data.id as string };
  }

  const { data: newCard, error: cardError } = await sb
    .from("cards")
    .insert({
      track,
      module: "reconnect",
      object_type: "cold_target",
      title: `${input.name.trim()} (${input.firm.trim()})`,
      subtitle: input.title?.trim() || null,
      body: {
        firm: input.firm.trim(),
        specialty: input.specialty?.trim() || null,
        why_target: input.whyTarget?.trim() || null,
        first_contact: {
          stage: "identified",
          history: [{ stage: "identified", at: new Date().toISOString() }],
        } satisfies FirstContactState,
      },
      linked_object_ids: { contact_id: contactId },
      state: "open",
      priority_score: 0,
      verbs: ["draft", "send", "snooze", "message"],
    })
    .select("id")
    .single();

  if (cardError) return { ok: false, error: cardError.message };

  revalidateReconnect();
  return { ok: true, contactId, cardId: newCard.id as string };
}

export async function advanceFirstContactStage(input: {
  contactId: string;
  newStage: FirstContactStage;
  draft?: string;
  note?: string;
}): Promise<ActionResult & { state?: FirstContactState }> {
  if (!hasSupabaseServiceRole()) {
    return { ok: false, error: "Supabase service role is not configured." };
  }

  const cardResult = await getFirstContactCard(input.contactId);
  if (!cardResult) return { ok: false, error: "No reconnect card found for contact" };

  const currentBody = cardResult.body ?? {};
  const currentState = normalizeFirstContactState(currentBody.first_contact);
  const newEvent: FirstContactStageEvent = {
    stage: input.newStage,
    at: new Date().toISOString(),
    draft: input.draft,
    note: input.note,
  };
  const newState: FirstContactState = {
    stage: input.newStage,
    history: [...currentState.history, newEvent],
  };

  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("cards")
    .update({
      body: { ...currentBody, first_contact: newState },
      state:
        input.newStage === "completed"
          ? "actioned"
          : input.newStage === "closed_no_response"
            ? "archived"
            : "open",
    })
    .eq("id", cardResult.id);

  if (error) return { ok: false, error: error.message };

  await sb.from("runner_artifacts").insert({
    runner_id: "first_contact",
    task_id: input.contactId,
    schema_version: "v1",
    payload: newEvent,
  });

  revalidateReconnect();
  return { ok: true, state: newState };
}

export async function generateFirstContactDraft(input: {
  contactId: string;
  stage: FirstContactDraftStage;
}): Promise<
  | { ok: true; draft: string; channel: string; rationale: string; subject?: string }
  | { ok: false; error: string }
> {
  if (!hasSupabaseServiceRole()) {
    return { ok: false, error: "Supabase service role is not configured." };
  }

  const ctx = await loadContactContext(input.contactId);
  if (!ctx) return { ok: false, error: "Contact not found" };

  const card = await getFirstContactCard(input.contactId);
  const cardBody = card?.body ?? {};
  const firstContact = normalizeFirstContactState(cardBody.first_contact);
  const contact = enrichContactContext(ctx, cardBody);

  const [hubspot, gmail, granola, fireflies] = await Promise.allSettled([
    withTimeout(gatherHubSpotHistory(contact), 5_000, { found: false }),
    withTimeout(gatherGmailHistory(contact), 5_000, { found: false }),
    withTimeout(gatherGranolaHistory(contact), 5_000, { found: false }),
    withTimeout(gatherFirefliesHistory(contact), 5_000, { found: false }),
  ]);

  const sources: DraftSource[] = [
    resolveFirstContactSource("hubspot", hubspot),
    resolveFirstContactSource("gmail", gmail),
    resolveFirstContactSource("granola", granola),
    resolveFirstContactSource("fireflies", fireflies),
  ];
  const priorDrafts = firstContact.history
    .filter((event) => event.draft)
    .map((event) => ({ stage: event.stage, draft: event.draft }));

  const system = buildStageSystemPrompt(input.stage);
  const user = buildStageUserPrompt({ contact, cardBody, sources, priorDrafts });
  const response = await callClaude({
    model: "claude-sonnet-4-6",
    maxTokens: input.stage === "connect_request" ? 600 : 900,
    system,
    messages: [{ role: "user", content: user }],
  });

  let parsed = parseStageResponse(response, input.stage);
  if (!parsed) return { ok: false, error: "Claude returned an invalid draft response." };

  if (input.stage === "connect_request" && parsed.body.length > 300) {
    const retry = await callClaude({
      model: "claude-sonnet-4-6",
      maxTokens: 500,
      system: `${system}\n\nSTRICT RETRY: The prior draft exceeded 300 characters. Return a complete note under 280 characters. No extra text.`,
      messages: [{ role: "user", content: user }],
    });
    parsed = parseStageResponse(retry, input.stage) ?? parsed;
    if (parsed.body.length > 300) parsed.body = truncateConnectionRequest(parsed.body);
  }

  return {
    ok: true,
    draft: parsed.subject ? `Subject: ${parsed.subject}\n\n${parsed.body}` : parsed.body,
    subject: parsed.subject,
    channel: input.stage,
    rationale: parsed.rationale,
  };
}

async function getFirstContactCard(contactId: string) {
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("cards")
    .select("id,body")
    .eq("module", "reconnect")
    .eq("linked_object_ids->>contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id as string,
    body: (data.body ?? {}) as FirstContactCardBody,
  };
}

function buildStageSystemPrompt(stage: FirstContactDraftStage) {
  if (stage === "connect_request") return buildConnectionRequestSystemPrompt();
  if (stage === "linkedin_dm") return buildLinkedInDmSystemPrompt();
  return buildEmailFollowupSystemPrompt();
}

function buildConnectionRequestSystemPrompt(): string {
  return `${JASON_CORE_VOICE}

YOU ARE GENERATING: A LinkedIn connection request note.

HARD CONSTRAINTS:
- Maximum 300 characters total (LinkedIn's hard limit)
- One short paragraph, no salutation line
- Must include: (a) specific reason for connecting (their role/practice), (b) one-line Jason positioning, (c) "wanted to connect" framing - NO ASK in the note itself
- End with "- Jason"
- No "I hope this finds you well", no "circling back", no exclamation points

OUTPUT JSON: { "body": "...", "rationale": "1-line explanation of why this hook" }`;
}

function buildLinkedInDmSystemPrompt(): string {
  return `${JASON_CORE_VOICE}

YOU ARE GENERATING: A LinkedIn DM sent within hours of the contact accepting Jason's connection request.

CONSTRAINTS:
- 100-150 words
- Open with "Thanks for connecting" or similar - acknowledge the just-completed step
- Then 2-3 metric-anchored proof points from Jason's career (OUTFRONT MTA $3.2B / 20x ROAS, Omnicom APAC 16 markets, Refactor Sprint 45+ engagements)
- Specific ask: 20 min to walk through methodology / a one-pager
- End with "- Jason"
- Reference the contact's role/practice ONCE to show this isn't a copy-paste

OUTPUT JSON: { "body": "...", "rationale": "..." }`;
}

function buildEmailFollowupSystemPrompt(): string {
  return `${JASON_CORE_VOICE}

YOU ARE GENERATING: An email follow-up sent after the LinkedIn DM has been replied to (channel has opened).

CONSTRAINTS:
- 200-250 words
- Subject line at the top: "Subject: ..."
- Open with "Following our LinkedIn connection" or similar - establish the chain
- Use bullet points for forwardability - recruiters often forward to colleagues
- Bullet 1: 2-3 line career capsule (OUTFRONT, Omnicom, Apple/Gehry roots)
- Bullet 2: Current state (Fractional CMO + Refactor Sprint as proof of operator currency)
- Bullet 3: Where Jason is relevant for THEIR practice specifically (use the contact's specialty)
- TWO specific asks at the bottom (numbered): (1) walk-through call, (2) any active searches
- End with "- Jason" (no calendar link auto-inserted; user can add)

OUTPUT JSON: { "subject": "...", "body": "...", "rationale": "..." }`;
}

function buildStageUserPrompt({
  contact,
  cardBody,
  sources,
  priorDrafts,
}: {
  contact: ContactContext;
  cardBody: FirstContactCardBody;
  sources: DraftSource[];
  priorDrafts: Array<{ stage: FirstContactStage; draft?: string }>;
}) {
  const lines = [
    `CONTACT: ${contact.name}`,
    contact.title ? `Title: ${contact.title}` : null,
    contact.firm ? `Firm: ${contact.firm}` : null,
    contact.specialty ? `Specialty: ${contact.specialty}` : null,
    contact.linkedin_url ? `LinkedIn: ${contact.linkedin_url}` : null,
    contact.personal_goal ? `Goal: ${contact.personal_goal}` : null,
    cardBody.why_target ? `Why target: ${cardBody.why_target}` : null,
    "",
    "HISTORY FROM SOURCES:",
    ...sources.flatMap((source) =>
      source.found && source.summary ? [`[${source.source}]`, source.summary, ""] : []
    ),
    "PRIOR FIRST-CONTACT DRAFTS:",
    ...(priorDrafts.length
      ? priorDrafts.map((draft) => `${draft.stage}: ${draft.draft}`)
      : ["None yet."]),
    "",
    "Return only valid JSON.",
  ];

  return lines.filter((line): line is string => line !== null).join("\n");
}

function parseStageResponse(
  response: string,
  stage: FirstContactDraftStage
): { body: string; rationale: string; subject?: string } | null {
  const cleaned = response
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as {
      body?: unknown;
      subject?: unknown;
      rationale?: unknown;
    };
    if (typeof parsed.body !== "string") return null;
    if (stage === "email_followup" && typeof parsed.subject !== "string") return null;
    return {
      body: parsed.body.trim(),
      subject: typeof parsed.subject === "string" ? parsed.subject.trim() : undefined,
      rationale: typeof parsed.rationale === "string" ? parsed.rationale.trim() : "",
    };
  } catch {
    return null;
  }
}

function enrichContactContext(ctx: ContactContext, body: FirstContactCardBody): ContactContext {
  return {
    ...ctx,
    firm: body.firm ?? ctx.firm,
    specialty: body.specialty ?? ctx.specialty,
    recruiterStrategicNotes: body.why_target ?? ctx.recruiterStrategicNotes,
  };
}

function normalizeFirstContactState(value: unknown): FirstContactState {
  const maybe = value as Partial<FirstContactState> | undefined;
  return {
    stage: isFirstContactStage(maybe?.stage) ? maybe.stage : "identified",
    history: Array.isArray(maybe?.history) ? maybe.history : [],
  };
}

function isFirstContactStage(value: unknown): value is FirstContactStage {
  return (
    typeof value === "string" &&
    [
      "identified",
      "connect_sent",
      "connect_accepted",
      "dm_sent",
      "dm_replied",
      "email_sent",
      "email_replied",
      "meeting_scheduled",
      "completed",
      "closed_no_response",
    ].includes(value)
  );
}

function resolveFirstContactSource<T extends {
  found?: boolean;
  summary?: string;
  url?: string;
  contactUrl?: string;
  threadUrl?: string;
}>(source: DraftSource["source"], result: PromiseSettledResult<T>): DraftSource {
  if (result.status !== "fulfilled") return { source, found: false };
  return {
    source,
    found: Boolean(result.value.found),
    summary: result.value.summary,
    url: result.value.url ?? result.value.contactUrl ?? result.value.threadUrl,
  };
}

function truncateConnectionRequest(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 300) return trimmed;
  const sentences = trimmed.match(/[^.!?]+[.!?]?/g) ?? [trimmed];
  let out = "";
  for (const sentence of sentences) {
    if ((out + sentence).trim().length > 290) break;
    out = `${out}${sentence}`.trim();
  }
  return out || `${trimmed.slice(0, 287).trim()}...`;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((value) => resolve(value))
      .catch(() => resolve(fallback))
      .finally(() => clearTimeout(timer));
  });
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function addTags(existing: string[], tags: string[]) {
  return [...new Set([...existing, ...tags])];
}

function revalidateReconnect() {
  revalidatePath("/reconnect");
  revalidatePath("/reconnect/contacts");
  revalidatePath("/outreach/queue");
  revalidatePath("/outreach/schedule");
  revalidatePath("/outreach/people");
  revalidatePath("/outreach/firms");
}

function hasSupabaseServiceRole() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
