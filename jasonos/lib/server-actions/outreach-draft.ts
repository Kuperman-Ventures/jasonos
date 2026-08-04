"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  loadContactContext,
  gatherGmailHistory,
  gatherHubSpotHistory,
  gatherGranolaHistory,
  gatherFirefliesHistory,
  type ContactContext,
  type DraftSource,
  type GmailHistory,
  type HubSpotHistory,
  type SearchHistory,
} from "@/lib/server-actions/draft-from-history";
import { callClaude } from "@/lib/ai/models";
import { JASON_CORE_VOICE } from "@/lib/ai/jason-identity";
import type { CadenceInterval, RelationshipType } from "@/lib/outreach/types";
import type {
  OutreachContact,
  OutreachDraftChannel,
  OutreachDraftError,
  OutreachDraftMode,
  OutreachDraftResult,
  RecentTouch,
} from "@/lib/outreach/draft-types";

// ---------------------------------------------------------------------------
// Public: loadOutreachContext — surface the 4-source history + recent touches
// without invoking Claude. Cheaper than generateOutreachDraft and useful for
// "show me recent context" before the user decides to compose.
// ---------------------------------------------------------------------------

export interface OutreachContextResult {
  ok: true;
  contact: OutreachContact;
  sources: DraftSource[];
  recentTouches: RecentTouch[];
  suggestedMode: OutreachDraftMode;
}

export async function loadOutreachContext(input: {
  contactId: string;
}): Promise<OutreachContextResult | OutreachDraftError> {
  const contact = await loadOutreachContactRow(input.contactId);
  if (!contact) return { ok: false, error: "Contact not found." };

  const baseCtx = await loadContactContext(input.contactId);
  const stubCtx = baseCtx ?? stubContextFor(contact);

  const [hubspot, gmail, granola, fireflies, recentTouches] =
    await Promise.allSettled([
      withTimeout(gatherHubSpotHistory(stubCtx), 5_000, {
        found: false,
      } as HubSpotHistory),
      withTimeout(gatherGmailHistory(stubCtx), 5_000, {
        found: false,
      } as GmailHistory),
      withTimeout(gatherGranolaHistory(stubCtx), 5_000, {
        found: false,
      } as SearchHistory),
      withTimeout(gatherFirefliesHistory(stubCtx), 5_000, {
        found: false,
      } as SearchHistory),
      withTimeout(getRecentTouches(stubCtx), 3_000, [] as RecentTouch[]),
    ]);

  const gmailResult = settledValue(gmail, { found: false } as GmailHistory);
  const hubspotResult = settledValue(hubspot, { found: false } as HubSpotHistory);
  const granolaResult = settledValue(granola, { found: false } as SearchHistory);
  const firefliesResult = settledValue(fireflies, {
    found: false,
  } as SearchHistory);
  const touches = settledValue(recentTouches, [] as RecentTouch[]);

  const sources: DraftSource[] = [
    {
      source: "gmail",
      found: gmailResult.found,
      summary: gmailResult.summary,
      url: gmailResult.threadUrl,
    },
    {
      source: "hubspot",
      found: hubspotResult.found,
      summary: hubspotResult.summary,
      url: hubspotResult.contactUrl,
    },
    {
      source: "granola",
      found: granolaResult.found,
      summary: granolaResult.summary,
      url: granolaResult.url,
    },
    {
      source: "fireflies",
      found: firefliesResult.found,
      summary: firefliesResult.summary,
      url: firefliesResult.url,
    },
    {
      source: "rr_recruiter",
      found: !!stubCtx.recruiterStrategicNotes,
      summary: stubCtx.recruiterStrategicNotes ?? undefined,
    },
  ];

  // Replace the raw email/CRM dumps with a short, clear AI summary for the card.
  // (Draft generation builds its own raw sources separately, so this is
  // display-only and never starves the draft prompt of detail.)
  await Promise.all(
    sources.map(async (s) => {
      if (!s.found || !s.summary) return;
      if (s.source !== "gmail" && s.source !== "hubspot") return;
      s.summary = await summarizeSourceForCard(
        s.summary,
        s.source === "gmail" ? "email thread" : "CRM activity log"
      );
    })
  );

  const suggestedMode = autoSelectMode({
    contact,
    gmail: gmailResult,
    recentTouches: touches,
  });

  return {
    ok: true,
    contact,
    sources,
    recentTouches: touches,
    suggestedMode,
  };
}

// Compress a raw email thread / CRM activity dump into a short, clear blurb for
// the contact card. Falls back to the raw text if the model call fails or the
// content is already short.
async function summarizeSourceForCard(raw: string, kind: string): Promise<string> {
  const trimmed = raw.trim();
  if (trimmed.length < 200) return trimmed;
  try {
    const text = await callClaude({
      model: "claude-sonnet-4-6",
      maxTokens: 180,
      system:
        "You compress raw communication history into a crisp summary for a networking CRM card. Reply with 1-2 short, plain sentences stating what the exchange is about and the latest status or next step. No preamble, no bullet points, no quotes, no greeting.",
      messages: [
        { role: "user", content: `Summarize this ${kind}:\n\n${trimmed.slice(0, 4000)}` },
      ],
    });
    const out = text.trim();
    return out.length > 0 ? out : trimmed;
  } catch {
    return trimmed;
  }
}

function stubContextFor(contact: OutreachContact): ContactContext {
  return {
    id: contact.id,
    name: contact.name,
    emails: contact.primaryEmail ? [contact.primaryEmail] : [],
    linkedin_url: contact.linkedinUrl,
    title: contact.title,
    intent: null,
    personal_goal: null,
    last_touch_date: contact.lastTouchDate,
    source_ids: {},
    tags: [],
    firm: contact.firm,
    specialty: null,
    recruiterStrategicNotes: null,
    recruiterScores: null,
    hubspotContactId: null,
    primaryEmail: contact.primaryEmail,
  };
}

// ---------------------------------------------------------------------------
// Public: generateOutreachDraft
// ---------------------------------------------------------------------------

export async function generateOutreachDraft(input: {
  contactId: string;
  mode?: OutreachDraftMode;
}): Promise<OutreachDraftResult | OutreachDraftError> {
  const contact = await loadOutreachContactRow(input.contactId);
  if (!contact) return { ok: false, error: "Contact not found." };

  // Reuse the existing loader to pick up firm / recruiter notes / hubspotContactId
  // even though we don't actually require intent for outreach drafts.
  const baseCtx = await loadContactContext(input.contactId);
  const stubCtx: ContactContext = baseCtx ?? stubContextFor(contact);

  const [hubspot, gmail, granola, fireflies, recentTouches] =
    await Promise.allSettled([
      withTimeout(gatherHubSpotHistory(stubCtx), 5_000, { found: false }),
      withTimeout(gatherGmailHistory(stubCtx), 5_000, { found: false }),
      withTimeout(gatherGranolaHistory(stubCtx), 5_000, { found: false }),
      withTimeout(gatherFirefliesHistory(stubCtx), 5_000, { found: false }),
      withTimeout(getRecentTouches(stubCtx), 3_000, [] as RecentTouch[]),
    ]);

  const gmailResult = settledValue(gmail, { found: false } as GmailHistory);
  const hubspotResult = settledValue(hubspot, { found: false } as HubSpotHistory);
  const granolaResult = settledValue(granola, { found: false } as SearchHistory);
  const firefliesResult = settledValue(fireflies, {
    found: false,
  } as SearchHistory);
  const touchesResult = settledValue(recentTouches, [] as RecentTouch[]);

  const sources: DraftSource[] = [
    {
      source: "gmail",
      found: gmailResult.found,
      summary: gmailResult.summary,
      url: gmailResult.threadUrl,
    },
    {
      source: "hubspot",
      found: hubspotResult.found,
      summary: hubspotResult.summary,
      url: hubspotResult.contactUrl,
    },
    {
      source: "granola",
      found: granolaResult.found,
      summary: granolaResult.summary,
      url: granolaResult.url,
    },
    {
      source: "fireflies",
      found: firefliesResult.found,
      summary: firefliesResult.summary,
      url: firefliesResult.url,
    },
    {
      source: "rr_recruiter",
      found: !!stubCtx.recruiterStrategicNotes,
      summary: stubCtx.recruiterStrategicNotes ?? undefined,
    },
  ];

  const autoMode = autoSelectMode({
    contact,
    gmail: gmailResult,
    recentTouches: touchesResult,
  });
  const mode = input.mode ?? autoMode;
  const channel = decideChannel(gmailResult, contact);

  try {
    const draft = await synthesizeDraft({
      contact,
      mode,
      channel,
      sources,
    });
    if (!draft || !draft.body.trim()) {
      return { ok: false, error: "AI synthesis returned an empty draft." };
    }
    return {
      ok: true,
      draft: draft.body,
      rationale: draft.rationale,
      channel,
      mode,
      modeAutoSelected: !input.mode,
      sources,
      recentTouches: touchesResult,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown draft error",
    };
  }
}

// ---------------------------------------------------------------------------
// Auto-mode selection
// ---------------------------------------------------------------------------

function autoSelectMode(input: {
  contact: OutreachContact;
  gmail: GmailHistory;
  recentTouches: RecentTouch[];
}): OutreachDraftMode {
  const { contact, gmail, recentTouches } = input;
  const hasAnyHistory = gmail.found || recentTouches.length > 0;

  if (!hasAnyHistory) return "first_outreach";

  // If the latest Gmail message is from the contact, we owe them a reply.
  if (gmail.found && gmail.lastReplyFromContact) {
    return "follow_up_no_reply";
  }

  // Recruiter / hiring manager warm follow-up with no recent reply → check-in.
  if (
    contact.relationshipType === "recruiter" ||
    contact.relationshipType === "hiring_manager"
  ) {
    return "cadence_touchpoint";
  }

  // Prospect → if we've sent and they didn't reply, follow up.
  if (contact.relationshipType === "prospect") {
    return "follow_up_no_reply";
  }

  // Personal / mentor / operator peer → rhythm check-in is the default.
  return "cadence_touchpoint";
}

function decideChannel(
  gmail: GmailHistory,
  contact: OutreachContact
): OutreachDraftChannel {
  if (gmail.found && (gmail.threadCount ?? 0) > 0) return "email_reply";
  if (contact.linkedinUrl) return "linkedin";
  return "email_new";
}

// ---------------------------------------------------------------------------
// Claude synthesis
// ---------------------------------------------------------------------------

async function synthesizeDraft(params: {
  contact: OutreachContact;
  mode: OutreachDraftMode;
  channel: OutreachDraftChannel;
  sources: DraftSource[];
}): Promise<{ body: string; rationale: string } | null> {
  const systemPrompt = buildSystemPrompt(params.mode);
  const userPrompt = buildUserPrompt(params);
  const response = await callClaude({
    model: "claude-sonnet-4-6",
    maxTokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  return parseDraftResponse(response);
}

const MODE_INSTRUCTIONS: Record<OutreachDraftMode, string> = {
  first_outreach: `MODE: first_outreach
- This is a COLD reach. There is no prior history.
- Open with explicit acknowledgement: "Direct reach — [specific reason / mutual]"
- One concrete reason you're reaching out (signal, mutual, role, content of theirs).
- End with one specific micro-ask (15-min intro? answer one question?).`,
  cadence_touchpoint: `MODE: cadence_touchpoint
- This is a WARM rhythm check-in. You already have a relationship.
- Do NOT restate prior context. Assume they remember you.
- Lead with a recent signal (their news, your news, something specific you saw / heard).
- Optional: one specific update from your side worth sharing.
- Close with a low-friction ask (coffee, 15 min, quick answer) OR just "wanted to stay on your radar".`,
  follow_up_no_reply: `MODE: follow_up_no_reply
- There's an open thread. They haven't replied (or you owe them).
- Be short. Do NOT apologize, do NOT use filler.
- Either: (a) move the ball forward with a new piece of info, OR
        (b) restate the ask in a way that's easier to say yes to (give them an out).
- 60-90 words max.`,
  meeting_request: `MODE: meeting_request
- Explicit ask for time on calendar.
- Propose 2-3 specific windows or offer to send a Calendly.
- One sentence: why this conversation, why now.`,
};

function buildSystemPrompt(mode: OutreachDraftMode): string {
  return `${JASON_CORE_VOICE}

${MODE_INSTRUCTIONS[mode]}

OUTPUT RULES:
- 60-150 words, no exceptions
- If there's an existing email thread, the draft is a REPLY (don't restate prior content)
- If LinkedIn-only relationship, draft is a LinkedIn DM (no signature line, max 1200 chars)
- Never use these phrases: "I hope this finds you well", "circling back", "just wanted to", "touching base", "let's connect", "reaching out to see"
- End with one specific ask + "- Jason"
- Return JSON: { "body": "...", "rationale": "1-2 sentence explanation of frame choice" }`;
}

function buildUserPrompt(params: {
  contact: OutreachContact;
  mode: OutreachDraftMode;
  channel: OutreachDraftChannel;
  sources: DraftSource[];
}): string {
  const lines: string[] = [];
  lines.push(`CONTACT: ${params.contact.name}`);
  if (params.contact.title) lines.push(`Title: ${params.contact.title}`);
  if (params.contact.firm) lines.push(`Firm: ${params.contact.firm}`);
  if (params.contact.linkedinUrl)
    lines.push(`LinkedIn: ${params.contact.linkedinUrl}`);
  if (params.contact.relationshipType)
    lines.push(`Relationship: ${params.contact.relationshipType}`);
  if (params.contact.cadenceInterval !== "none")
    lines.push(`Cadence: ${params.contact.cadenceInterval}`);
  if (params.contact.lastTouchDate)
    lines.push(`Last touch: ${params.contact.lastTouchDate}`);
  lines.push("");
  lines.push(`CHANNEL: ${params.channel}`);
  lines.push("");
  lines.push("HISTORY FROM SOURCES:");
  let anyHistory = false;
  for (const source of params.sources) {
    if (source.found && source.summary) {
      anyHistory = true;
      lines.push(`[${source.source}]`);
      lines.push(source.summary);
      lines.push("");
    }
  }
  if (!anyHistory) lines.push("(No prior history found from any source.)");
  lines.push("---");
  lines.push("Draft the message. Return only valid JSON.");
  return lines.join("\n");
}

function parseDraftResponse(
  response: string
): { body: string; rationale: string } | null {
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
      rationale: typeof parsed.rationale === "string"
        ? parsed.rationale.trim()
        : "",
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadOutreachContactRow(
  contactId: string
): Promise<OutreachContact | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("contacts")
    .select(
      `id,name,emails,linkedin_url,title,
       relationship_type,cadence_interval,next_touch_date,
       last_touch_date,tags,source_ids`
    )
    .eq("id", contactId)
    .maybeSingle();
  if (error || !data) return null;

  const emails = (data.emails as string[] | null) ?? [];
  const tags = (data.tags as string[] | null) ?? [];
  const firmTag = tags.find((t) => t.startsWith("firm:"));
  const firm = firmTag ? firmTag.slice(5).replace(/-/g, " ") : null;

  return {
    id: data.id as string,
    name: data.name as string,
    title: (data.title as string) ?? null,
    firm,
    primaryEmail: emails[0] ?? null,
    linkedinUrl: (data.linkedin_url as string) ?? null,
    relationshipType: (data.relationship_type as RelationshipType | null) ?? null,
    cadenceInterval: (data.cadence_interval as CadenceInterval | null) ?? "none",
    nextTouchDate: (data.next_touch_date as string | null) ?? null,
    lastTouchDate: (data.last_touch_date as string | null) ?? null,
  };
}

async function getRecentTouches(ctx: ContactContext): Promise<RecentTouch[]> {
  const sb = createServiceRoleClient();

  // Primary source of truth (Phase 4): jasonos.contact_touches keyed on
  // the canonical jasonos.contacts.id.
  const { data, error } = await sb
    .from("contact_touches")
    .select("id,channel,direction,touched_at,brief,subject,thread_url,source")
    .eq("contact_id", ctx.id)
    .order("touched_at", { ascending: false })
    .limit(40);

  if (error) {
    console.error("[outreach.getRecentTouches.contact_touches]", error);
  } else if (data && data.length) {
    return data.map((row): RecentTouch => ({
      id: row.id as string,
      channel: row.channel as string,
      direction: row.direction as string,
      touched_at: row.touched_at as string,
      brief: (row.brief as string) ?? null,
      subject: (row.subject as string) ?? null,
      thread_url: (row.thread_url as string) ?? null,
      source: (row.source as string) ?? null,
    }));
  }

  // Fallback for environments where the 0014 backfill hasn't been applied
  // yet — read directly from rr_touches via the recruiter_pipeline_id link.
  const recruiterId = getStringField(ctx.source_ids?.recruiter_pipeline_id);
  if (!recruiterId) return [];

  const { data: legacy } = await sb
    .from("rr_touches")
    .select("id,channel,direction,touched_at,brief,subject,thread_url,source")
    .eq("contact_id", recruiterId)
    .order("touched_at", { ascending: false })
    .limit(40);

  return (legacy ?? []).map((row): RecentTouch => ({
    id: row.id as string,
    channel: row.channel as string,
    direction: row.direction as string,
    touched_at: row.touched_at as string,
    brief: (row.brief as string) ?? null,
    subject: (row.subject as string) ?? null,
    thread_url: (row.thread_url as string) ?? null,
    source: (row.source as string) ?? null,
  }));
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((v) => resolve(v))
      .catch(() => resolve(fallback))
      .finally(() => clearTimeout(timer));
  });
}

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

function getStringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
