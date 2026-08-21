"use server";

import { createPublicServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  getHubSpotContactActivities,
  getHubSpotContactById,
  searchHubSpotContact,
  type HubSpotActivity,
} from "@/lib/integrations/hubspot";
import {
  getGmailThread,
  searchGmailThreads,
  type GmailThread,
  type GmailThreadFull,
} from "@/lib/integrations/gmail";
import { listGoogleAccessTokens } from "@/lib/integrations/google-tokens";
import { gmailThreadUrl } from "@/lib/integrations/gmail-links";
import { searchGranolaForContact } from "@/lib/integrations/granola";
import { searchFirefliesForContact } from "@/lib/integrations/fireflies";
import { callClaude } from "@/lib/ai/models";
import { JASON_CORE_VOICE } from "@/lib/ai/jason-identity";
import { extractFirstName, generateDraft as templateFallback } from "@/lib/triage/draft-templates";
import type { Intent } from "@/lib/triage/types";

export interface DraftSource {
  source: "hubspot" | "gmail" | "granola" | "fireflies" | "rr_recruiter" | "template_fallback";
  found: boolean;
  summary?: string;
  url?: string;
}

export interface DraftResult {
  ok: true;
  draft: string;
  channel: "linkedin" | "email_reply" | "email_new" | "linkedin_reply";
  sources: DraftSource[];
  rationale: string;
}

export interface DraftError {
  ok: false;
  error: string;
  fallbackDraft?: string;
}

type DraftChannel = DraftResult["channel"];

export interface ContactContext {
  id: string;
  name: string;
  emails: string[];
  linkedin_url: string | null;
  title: string | null;
  intent: Intent | null;
  personal_goal: string | null;
  last_touch_date: string | null;
  source_ids: Record<string, unknown>;
  tags: string[];
  firm: string | null;
  specialty: string | null;
  recruiterStrategicNotes: string | null;
  recruiterScores: {
    strategic: number | null;
    firm_fit: number | null;
    practice_match: number | null;
    signal: number | null;
  } | null;
  hubspotContactId: string | null;
  primaryEmail: string | null;
}

export interface GmailHistory {
  found: boolean;
  summary?: string;
  threadId?: string;
  threadUrl?: string;
  lastReplyFromContact?: boolean;
  threadCount?: number;
  fullMostRecentBody?: string;
}

export interface HubSpotHistory {
  found: boolean;
  summary?: string;
  contactUrl?: string;
  lastContacted?: string | null;
  leadStatus?: string | null;
}

export interface SearchHistory {
  found: boolean;
  summary?: string;
  url?: string;
}

export async function generateDraftFromHistory(input: {
  contactId: string;
}): Promise<DraftResult | DraftError> {
  const ctx = await loadContactContext(input.contactId);
  if (!ctx) return { ok: false, error: "Contact not found" };
  if (!ctx.intent) return { ok: false, error: "Set an intent before drafting from history." };

  const fallbackDraft = buildTemplateFallback(ctx);

  try {
    const [hubspot, gmail, granola, fireflies] = await Promise.allSettled([
      withTimeout(gatherHubSpotHistory(ctx), 5_000, { found: false } satisfies HubSpotHistory),
      withTimeout(gatherGmailHistory(ctx), 5_000, { found: false } satisfies GmailHistory),
      withTimeout(gatherGranolaHistory(ctx), 5_000, { found: false } satisfies SearchHistory),
      withTimeout(gatherFirefliesHistory(ctx), 5_000, { found: false } satisfies SearchHistory),
    ]);

    const sources: DraftSource[] = [
      resolveSource("hubspot", hubspot),
      resolveSource("gmail", gmail),
      resolveSource("granola", granola),
      resolveSource("fireflies", fireflies),
      {
        source: "rr_recruiter",
        found: !!ctx.recruiterStrategicNotes,
        summary: ctx.recruiterStrategicNotes ?? undefined,
      },
    ];

    const channel = decideChannel(gmail, ctx);
    const draft = await synthesizeDraftWithClaude({
      contact: ctx,
      sources,
      channel,
      intent: ctx.intent,
      personalGoal: ctx.personal_goal,
    });

    if (!draft?.body.trim()) {
      return {
        ok: false,
        error: "AI synthesis returned empty",
        fallbackDraft,
      };
    }

    return {
      ok: true,
      draft: draft.body,
      channel,
      sources,
      rationale: draft.rationale,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
      fallbackDraft,
    };
  }
}

export async function loadContactContext(contactId: string): Promise<ContactContext | null> {
  const sb = createServiceRoleClient();
  const { data: contact, error } = await sb
    .from("contacts")
    .select("id,name,emails,linkedin_url,title,intent,personal_goal,last_touch_date,source_ids,tags")
    .eq("id", contactId)
    .maybeSingle();

  if (error || !contact) return null;

  const contactRow = contact as {
    id: string;
    name: string;
    emails?: string[] | null;
    linkedin_url?: string | null;
    title?: string | null;
    intent?: string | null;
    personal_goal?: string | null;
    last_touch_date?: string | null;
    source_ids?: Record<string, unknown> | null;
    tags?: string[] | null;
  };

  const sourceIds = contactRow.source_ids ?? {};
  const recruiterPipelineId =
    getString(sourceIds.recruiter_pipeline_id) ??
    getString(sourceIds.leaddelta) ??
    (await getRecruiterPipelineIdFromCard(contactId));

  let recruiter: {
    firm?: string | null;
    specialty?: string | null;
    strategic_score?: number | null;
    firm_fit_score?: number | null;
    practice_match_score?: number | null;
    signal_score?: number | null;
    strategic_recommended_approach?: string | null;
    summary_of_prior_comms?: string | null;
    outlook_history?: string | null;
    hubspot_contact_id?: string | null;
  } | null = null;

  if (recruiterPipelineId) {
    const sbPublic = createPublicServiceRoleClient();
    const { data } = await sbPublic
      .from("rr_recruiters")
      .select(
        "firm,firm_normalized,specialty,strategic_score,firm_fit_score,practice_match_score,signal_score,strategic_priority,strategic_recommended_approach,summary_of_prior_comms,outlook_history,other_contacts_at_firm,hubspot_contact_id"
      )
      .eq("id", recruiterPipelineId)
      .maybeSingle();
    recruiter = data;
  }

  return {
    id: contactRow.id,
    name: contactRow.name,
    emails: contactRow.emails ?? [],
    linkedin_url: contactRow.linkedin_url ?? null,
    title: contactRow.title ?? null,
    intent: isIntent(contactRow.intent) ? contactRow.intent : null,
    personal_goal: contactRow.personal_goal ?? null,
    last_touch_date: contactRow.last_touch_date ?? null,
    source_ids: sourceIds,
    tags: contactRow.tags ?? [],
    firm: recruiter?.firm ?? getFirmFromTags(contactRow.tags) ?? null,
    specialty: recruiter?.specialty ?? null,
    recruiterStrategicNotes:
      recruiter?.outlook_history ??
      recruiter?.summary_of_prior_comms ??
      recruiter?.strategic_recommended_approach ??
      null,
    recruiterScores: recruiter
      ? {
          strategic: recruiter.strategic_score ?? null,
          firm_fit: recruiter.firm_fit_score ?? null,
          practice_match: recruiter.practice_match_score ?? null,
          signal: recruiter.signal_score ?? null,
        }
      : null,
    hubspotContactId: recruiter?.hubspot_contact_id ?? getString(sourceIds.hubspot) ?? null,
    primaryEmail: contactRow.emails?.[0] ?? null,
  };
}

async function getRecruiterPipelineIdFromCard(contactId: string) {
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("cards")
    .select("linked_object_ids")
    .eq("module", "reconnect")
    .filter("linked_object_ids->>contact_id", "eq", contactId)
    .limit(1)
    .maybeSingle();

  const linked = data?.linked_object_ids as Record<string, unknown> | null | undefined;
  return linked ? getString(linked.recruiter_pipeline_id) : null;
}

export async function gatherGmailHistory(ctx: ContactContext): Promise<GmailHistory> {
  if (!ctx.primaryEmail) return { found: false };

  const mailboxTokens = await listGoogleAccessTokens();
  const collected: { thread: GmailThread; token: string }[] = [];
  for (const { token } of mailboxTokens) {
    const threads = await searchGmailThreads({
      query: `from:${ctx.primaryEmail} OR to:${ctx.primaryEmail}`,
      pageSize: 5,
      accessToken: token,
    });
    for (const thread of threads) collected.push({ thread, token });
  }
  const threads = dedupeThreads(collected.map((row) => row.thread));
  if (!threads.length) return { found: false };

  const mostRecent = threads[0];
  const tokenForThread =
    collected.find((row) => row.thread.id === mostRecent.id)?.token;
  const fullThread = await getGmailThread(mostRecent.id, tokenForThread);
  const lastMessage = fullThread?.messages?.[fullThread.messages.length - 1];

  return {
    found: true,
    summary: summarizeThreads(threads, fullThread),
    threadId: mostRecent.id,
    threadUrl: gmailThreadUrl(mostRecent.id),
    lastReplyFromContact: detectLastReply(fullThread, ctx.primaryEmail),
    threadCount: threads.length,
    fullMostRecentBody: lastMessage?.plaintextBody?.slice(0, 4000),
  };
}

export async function gatherHubSpotHistory(ctx: ContactContext): Promise<HubSpotHistory> {
  if (!ctx.hubspotContactId && !ctx.primaryEmail) return { found: false };

  const contact = ctx.hubspotContactId
    ? await getHubSpotContactById(ctx.hubspotContactId)
    : await searchHubSpotContact({ email: ctx.primaryEmail, name: ctx.name });
  if (!contact) return { found: false };

  const activities = await getHubSpotContactActivities(contact.id, { limit: 20 });

  return {
    found: true,
    contactUrl: contact.url,
    lastContacted: contact.properties.notes_last_contacted ?? null,
    leadStatus: contact.properties.hs_lead_status ?? null,
    summary: summarizeHubSpotActivities(activities),
  };
}

export async function gatherGranolaHistory(ctx: ContactContext): Promise<SearchHistory> {
  const result = await searchGranolaForContact({
    contactName: ctx.name,
    email: ctx.primaryEmail,
  });
  return {
    found: result.found,
    summary: result.summary,
    url: result.url,
  };
}

export async function gatherFirefliesHistory(ctx: ContactContext): Promise<SearchHistory> {
  const result = await searchFirefliesForContact({ contactName: ctx.name });
  return {
    found: result.found,
    summary: result.summary,
    url: result.url,
  };
}

function decideChannel(
  gmail: PromiseSettledResult<GmailHistory>,
  ctx: ContactContext
): DraftChannel {
  if (gmail.status === "fulfilled" && gmail.value.found && (gmail.value.threadCount ?? 0) > 0) {
    return "email_reply";
  }
  if (ctx.linkedin_url) return "linkedin";
  return "email_new";
}

async function synthesizeDraftWithClaude(params: {
  contact: ContactContext;
  sources: DraftSource[];
  channel: DraftChannel;
  intent: Intent;
  personalGoal: string | null;
}): Promise<{ body: string; rationale: string } | null> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(params);
  const first = await callClaude({
    model: "claude-sonnet-4-6",
    maxTokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const parsed = parseDraftResponse(first);

  if (parsed && !hasBannedPhrases(parsed.body)) return parsed;

  const second = await callClaude({
    model: "claude-sonnet-4-6",
    maxTokens: 1500,
    system: `${systemPrompt}\n\nSTRICT REWRITE: The previous draft used banned outreach filler. Remove all banned phrases and return only valid JSON.`,
    messages: [{ role: "user", content: userPrompt }],
  });
  return parseDraftResponse(second);
}

function buildSystemPrompt(): string {
  return `${JASON_CORE_VOICE}

REFACTOR SPRINT POSITIONING:
- DISQUALIFICATION FRAME: position as eligibility assessment, not sales
- ICP: B2B SaaS/Tech/Fintech, $2-50M ARR, Series A-B, CRM with 12+ months data, $20k+/mo marketing spend, sales/marketing disconnect
- NOT a fit: pre-revenue, transactional SMB, commodity, no CRM data
- Selling frame: "$2,500 to save the $50,000 you're about to waste"
- Cost-of-waiting argument > feature-selling

OUTPUT RULES:
- 75-150 words, no exceptions
- If there's an existing email thread, the draft is a REPLY (don't restate prior content)
- If LinkedIn-only relationship, draft is a LinkedIn DM (no signature line, max 1200 chars)
- If cold (no prior contact), explicit acknowledgement: "Direct reach - [specific reason]"
- End with one specific ask + "- Jason"
- Return JSON: { "body": "...", "rationale": "1-2 sentence explanation of choice of frame" }`;
}

function buildUserPrompt(params: {
  contact: ContactContext;
  sources: DraftSource[];
  channel: DraftChannel;
  intent: Intent;
  personalGoal: string | null;
}): string {
  const lines: string[] = [];

  lines.push(`CONTACT: ${params.contact.name}`);
  if (params.contact.title) lines.push(`Title: ${params.contact.title}`);
  if (params.contact.firm) lines.push(`Firm: ${params.contact.firm}`);
  if (params.contact.specialty) lines.push(`Specialty: ${params.contact.specialty}`);
  if (params.contact.linkedin_url) lines.push(`LinkedIn: ${params.contact.linkedin_url}`);
  lines.push("");

  lines.push(`INTENT (Jason's captured intent for this contact): ${params.intent}`);
  if (params.personalGoal) {
    lines.push(`GOAL (Jason's one-line goal): ${params.personalGoal}`);
  }
  if (params.contact.recruiterScores) {
    lines.push(`SCORES: ${JSON.stringify(params.contact.recruiterScores)}`);
  }
  lines.push("");

  lines.push(`CHANNEL: ${params.channel}`);
  lines.push("");

  lines.push("HISTORY FROM SOURCES:");
  for (const source of params.sources) {
    if (source.found && source.summary) {
      lines.push(`[${source.source}]`);
      lines.push(source.summary);
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("Draft the message. Return only valid JSON.");

  return lines.join("\n");
}

function parseDraftResponse(response: string): { body: string; rationale: string } | null {
  const cleaned = response
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as { body?: unknown; rationale?: unknown };
    if (typeof parsed.body !== "string") return null;
    return {
      body: parsed.body.trim(),
      rationale: typeof parsed.rationale === "string" ? parsed.rationale.trim() : "",
    };
  } catch {
    return null;
  }
}

function resolveSource<T extends { found?: boolean; summary?: string; url?: string; contactUrl?: string; threadUrl?: string }>(
  source: DraftSource["source"],
  result: PromiseSettledResult<T>
): DraftSource {
  if (result.status !== "fulfilled") return { source, found: false };
  return {
    source,
    found: Boolean(result.value.found),
    summary: result.value.summary,
    url: result.value.url ?? result.value.contactUrl ?? result.value.threadUrl,
  };
}

function summarizeThreads(threads: GmailThread[], fullThread: GmailThreadFull | null) {
  const latest = fullThread?.messages?.slice(-3) ?? [];
  const messageSummary = latest
    .map((message) =>
      [
        message.date ? `Date: ${message.date}` : null,
        message.from ? `From: ${message.from}` : null,
        message.subject ? `Subject: ${message.subject}` : null,
        (message.plaintextBody || message.snippet || "").slice(0, 1200),
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");

  return [`Found ${threads.length} Gmail thread(s).`, messageSummary].filter(Boolean).join("\n\n");
}

function summarizeHubSpotActivities(activities: HubSpotActivity[]) {
  if (!activities.length) return "HubSpot contact found, but no recent activities were returned.";
  return activities
    .slice(0, 8)
    .map((activity) =>
      [
        `${activity.type.toUpperCase()}${activity.createdAt ? ` ${activity.createdAt}` : ""}`,
        activity.subject,
        activity.body?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 700),
      ]
        .filter(Boolean)
        .join(": ")
    )
    .join("\n");
}

function detectLastReply(thread: GmailThreadFull | null, email: string) {
  const last = thread?.messages?.[thread.messages.length - 1];
  return Boolean(last?.from?.toLowerCase().includes(email.toLowerCase()));
}

function dedupeThreads(threads: GmailThread[]) {
  return [...new Map(threads.map((thread) => [thread.id, thread])).values()];
}

function buildTemplateFallback(ctx: ContactContext) {
  if (!ctx.intent) return "";
  return templateFallback(ctx.intent, {
    firstName: extractFirstName(ctx.name),
    firm: ctx.firm ?? undefined,
    specialty: ctx.specialty ?? undefined,
    personalGoal: ctx.personal_goal ?? undefined,
    channel: "linkedin",
  });
}

function hasBannedPhrases(body: string) {
  return /\b(i hope this finds you well|circling back|just wanted to|touching base|let'?s connect)\b/i.test(
    body
  );
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

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getFirmFromTags(tags: string[] | null | undefined) {
  const firmTag = tags?.find((tag) => tag.trim().toLowerCase().startsWith("firm:"));
  if (!firmTag) return null;
  return firmTag.slice(firmTag.indexOf(":") + 1).trim() || null;
}

function isIntent(value: unknown): value is Intent {
  return (
    value === "warm" ||
    value === "intel" ||
    value === "door" ||
    value === "pipeline" ||
    value === "role_inquiry"
  );
}
