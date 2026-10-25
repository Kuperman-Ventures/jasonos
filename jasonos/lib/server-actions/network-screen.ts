"use server";

import { generateText } from "ai";
import { z } from "zod";
import { JASON_CORE_VOICE } from "@/lib/ai/jason-identity";
import { fastModel, hasDirectAnthropicKey, heavyModel } from "@/lib/ai/models";
import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";
import { stripEmDashes } from "@/lib/email-templates/render";
import { searchGranolaForContact } from "@/lib/integrations/granola";
import { getConnectionByLinkedInUrl } from "@/lib/integrations/leaddelta";
import { normalizeLinkedInUrl } from "@/lib/integrations/leaddelta-parse";
import {
  IMPORT_SIBLING_WINDOW_MS,
  importedSiblingId,
  type ScreenSnapshot,
} from "@/lib/network-screen/follow-import";
import { applyScoreRules } from "@/lib/network-screen/score";
import { DRAFT_RULES, NETWORK_SCREEN_STRATEGY } from "@/lib/network-screen/strategy";
import {
  isBucket,
  isQueueStatus,
  isScreenStatus,
  isTier,
  isWarmth,
  type Bucket,
  type NetworkScreen,
  type NetworkScreenCandidate,
  type NetworkScreenDetail,
  type NetworkScreenListItem,
  type PendingIntro,
  type QueueStatus,
  type RelationshipWarmth,
  type ScreenStatus,
  type Tier,
} from "@/lib/network-screen/types";
import { createServiceRoleClient } from "@/lib/supabase/server";

type ActionError = { ok: false; error: string };

const SCREEN_URL = "https://jasonos.vercel.app/email-templates";
const SCORE_CHUNK = 120;
const BUCKET_RANK: Record<Bucket, number> = {
  hiring_path: 0,
  recruiter: 1,
  peer_referral: 2,
  speaking_content: 3,
  not_relevant: 4,
  unscored: 5,
};

function ensureConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function notConfigured(): ActionError {
  return { ok: false, error: "Not configured." };
}

function todayEt(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function anthropicOptions() {
  return hasDirectAnthropicKey()
    ? { anthropic: { thinking: { type: "disabled" as const } } }
    : undefined;
}

function blank(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeConnectorUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const canonical = normalizeLinkedInUrl(trimmed);
  if (canonical) return canonical;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProto);
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString().replace(/\/$/, "");
  } catch {
    const stripped = trimmed.replace(/[?#].*$/, "").replace(/\/+$/, "");
    return stripped || null;
  }
}

function asDegree(value: unknown): string | null {
  const text = blank(value)?.toLowerCase();
  if (!text) return null;
  if (text === "1st" || text.startsWith("1")) return "1st";
  if (text === "2nd" || text.startsWith("2")) return "2nd";
  if (text === "3rd" || text.startsWith("3")) return "3rd";
  return null;
}

function companyName(value: unknown): string | null {
  const company = value as { name?: string } | { name?: string }[] | null;
  const name = Array.isArray(company) ? company[0]?.name : company?.name;
  return blank(name);
}

function firstEmail(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const email = value.find((entry) => typeof entry === "string" && entry.includes("@"));
  return typeof email === "string" ? email : null;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

type ScreenRow = {
  id: string;
  connector_contact_id: string;
  connector_linkedin_url: string;
  connector_name: string;
  connector_headline: string | null;
  connector_company: string | null;
  connector_location: string | null;
  connector_degree: string | null;
  partner_note: string | null;
  relationship_warmth: string;
  meeting_notes_summary: string | null;
  open_commitments: string | null;
  visible_count: number;
  total_count_label: string | null;
  status: string;
  draft_subject: string | null;
  draft_body: string | null;
  requested_at: string | null;
  created_at: string;
  updated_at: string;
};

type CandidateRow = {
  id: string;
  screen_id: string;
  name: string;
  headline: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  linkedin_url: string | null;
  linkedin_degree: string | null;
  mutual_connections: string | null;
  bucket: string;
  tier: string;
  why: string | null;
  ask: string | null;
  next_action: string | null;
  queue_status: string;
  intro_requested_at: string | null;
  contact_id: string | null;
  scored_by: string | null;
  sort_order: number;
};

function mapScreen(row: ScreenRow, connectorEmail: string | null): NetworkScreen {
  return {
    id: row.id,
    connectorContactId: row.connector_contact_id,
    connectorLinkedinUrl: row.connector_linkedin_url,
    connectorName: row.connector_name,
    connectorHeadline: row.connector_headline,
    connectorCompany: row.connector_company,
    connectorLocation: row.connector_location,
    connectorDegree: row.connector_degree,
    connectorEmail,
    partnerNote: row.partner_note,
    relationshipWarmth: isWarmth(row.relationship_warmth) ? row.relationship_warmth : "new",
    meetingNotesSummary: row.meeting_notes_summary,
    openCommitments: row.open_commitments,
    visibleCount: row.visible_count,
    totalCountLabel: row.total_count_label,
    status: isScreenStatus(row.status) ? row.status : "awaiting_capture",
    draftSubject: row.draft_subject,
    draftBody: row.draft_body,
    requestedAt: row.requested_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCandidate(row: CandidateRow): NetworkScreenCandidate {
  return {
    id: row.id,
    screenId: row.screen_id,
    name: row.name,
    headline: row.headline,
    title: row.title,
    company: row.company,
    location: row.location,
    linkedinUrl: row.linkedin_url,
    linkedinDegree: row.linkedin_degree,
    mutualConnections: row.mutual_connections,
    bucket: isBucket(row.bucket) ? row.bucket : "unscored",
    tier: isTier(row.tier) ? row.tier : "none",
    why: row.why,
    ask: row.ask,
    nextAction: row.next_action,
    queueStatus: isQueueStatus(row.queue_status) ? row.queue_status : "queued",
    introRequestedAt: row.intro_requested_at,
    contactId: row.contact_id,
    scoredBy: row.scored_by,
    sortOrder: row.sort_order,
  };
}

async function connectorEmail(
  sb: ReturnType<typeof createServiceRoleClient>,
  contactId: string
): Promise<string | null> {
  const { data } = await sb.from("contacts").select("emails").eq("id", contactId).maybeSingle();
  return firstEmail(data?.emails);
}

function snapshotOf(row: {
  id: string;
  status: string;
  visible_count: number;
  created_at: string;
}): ScreenSnapshot {
  return {
    id: row.id,
    createdAt: row.created_at,
    visibleCount: row.visible_count,
    status: row.status,
  };
}

async function loadResolved(
  sb: ReturnType<typeof createServiceRoleClient>,
  screenId: string
): Promise<NetworkScreenDetail | null> {
  const screen = await loadDetail(sb, screenId);
  if (!screen) return null;
  const { data, error } = await sb
    .from("network_screens")
    .select("id, status, visible_count, created_at")
    .eq("connector_contact_id", screen.connectorContactId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    id: string;
    status: string;
    visible_count: number;
    created_at: string;
  }[];
  const siblingId = importedSiblingId(snapshotOf({
    id: screen.id,
    status: screen.status,
    visible_count: screen.visibleCount,
    created_at: screen.createdAt,
  }), rows.map(snapshotOf));
  if (!siblingId || siblingId === screen.id) return screen;
  return (await loadDetail(sb, siblingId)) ?? screen;
}

async function findRecentEmptyScreen(
  sb: ReturnType<typeof createServiceRoleClient>,
  contactId: string
): Promise<string | null> {
  const since = new Date(Date.now() - IMPORT_SIBLING_WINDOW_MS).toISOString();
  const { data, error } = await sb
    .from("network_screens")
    .select("id")
    .eq("connector_contact_id", contactId)
    .eq("status", "awaiting_capture")
    .eq("visible_count", 0)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return typeof data?.id === "string" ? data.id : null;
}

async function loadDetail(
  sb: ReturnType<typeof createServiceRoleClient>,
  screenId: string
): Promise<NetworkScreenDetail | null> {
  const { data, error } = await sb
    .from("network_screens")
    .select("*")
    .eq("id", screenId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as ScreenRow;
  const [{ data: people, error: peopleError }, email] = await Promise.all([
    sb
      .from("network_screen_candidates")
      .select("*")
      .eq("screen_id", screenId)
      .order("sort_order", { ascending: true }),
    connectorEmail(sb, row.connector_contact_id),
  ]);
  if (peopleError) throw new Error(peopleError.message);
  return {
    ...mapScreen(row, email),
    candidates: ((people ?? []) as CandidateRow[]).map(mapCandidate),
  };
}

async function readMeetingContext(name: string, emails: string[]): Promise<{
  summary: string | null;
  openCommitments: string | null;
  warmth: RelationshipWarmth;
}> {
  const notes = await searchGranolaForContact({
    contactName: name,
    emails,
    lookbackDays: 60,
  });
  const raw = notes.found ? blank(notes.summary) : null;
  if (!notes.found || !raw) {
    return { summary: raw, openCommitments: null, warmth: notes.found ? "warm" : "new" };
  }
  try {
    const { text } = await generateText({
      model: fastModel(),
      maxOutputTokens: 700,
      system:
        'Return JSON only: {"summary":"...","open_commitments":"...","expects_review":false}. Do not invent commitments or goals.',
      messages: [
        {
          role: "user",
          content: `Meeting notes for ${name}. Summarize what Jason should remember before asking this person for intros. open_commitments is anything Jason promised them. expects_review is true only if the notes say they are waiting on Jason to review something.\n\n${raw.slice(0, 8000)}`,
        },
      ],
      providerOptions: anthropicOptions(),
    });
    const parsed = parseJsonObject(text);
    if (!parsed) {
      return { summary: raw.slice(0, 2000), openCommitments: null, warmth: "warm" };
    }
    const expects = parsed.expects_review === true;
    return {
      summary: blank(parsed.summary) ?? raw.slice(0, 2000),
      openCommitments: blank(parsed.open_commitments),
      warmth: expects ? "expecting_review" : "warm",
    };
  } catch (err) {
    console.error("[network-screen.meeting-notes]", err);
    return { summary: raw.slice(0, 2000), openCommitments: null, warmth: "warm" };
  }
}

export async function createNetworkScreen({
  contactId,
}: {
  contactId: string;
}): Promise<{ ok: true; screen: NetworkScreenDetail } | ActionError> {
  if (!ensureConfigured()) return notConfigured();
  if (!z.string().uuid().safeParse(contactId).success) {
    return { ok: false, error: "Contact not found." };
  }
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("contacts")
    .select("id, name, linkedin_url, emails, title, companies(name)")
    .eq("id", contactId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Contact not found." };
  const linkedin = blank(data.linkedin_url);
  if (!linkedin) {
    return {
      ok: false,
      error: "This contact has no LinkedIn URL. Add one in Contact info.",
    };
  }
  const url = normalizeConnectorUrl(linkedin);
  if (!url) {
    return {
      ok: false,
      error: "This contact has no LinkedIn URL. Add one in Contact info.",
    };
  }

  let headline = blank(data.title);
  let company = companyName(data.companies);
  try {
    const lead = await getConnectionByLinkedInUrl(url);
    if (lead.configured && lead.data) {
      headline = blank(lead.data.headline) ?? headline;
      company = blank(lead.data.company) ?? company;
    }
  } catch (err) {
    console.error("[network-screen.leaddelta]", err);
  }

  const name = blank(data.name) ?? "Untitled";
  const emails = Array.isArray(data.emails)
    ? data.emails.filter((entry): entry is string => typeof entry === "string")
    : [];

  try {
    const existingId = await findRecentEmptyScreen(sb, contactId);
    if (existingId) {
      const existing = await loadResolved(sb, existingId);
      if (existing) return { ok: true, screen: existing };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not load the screen." };
  }

  const context = await readMeetingContext(name, emails);

  try {
    const existingId = await findRecentEmptyScreen(sb, contactId);
    if (existingId) {
      const existing = await loadResolved(sb, existingId);
      if (existing) return { ok: true, screen: existing };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not load the screen." };
  }

  const { data: inserted, error: insertError } = await sb
    .from("network_screens")
    .insert({
      connector_contact_id: contactId,
      connector_linkedin_url: url,
      connector_name: name,
      connector_headline: headline,
      connector_company: company,
      relationship_warmth: context.warmth,
      meeting_notes_summary: context.summary,
      open_commitments: context.openCommitments,
      status: "awaiting_capture",
    })
    .select("id")
    .single();
  if (insertError) return { ok: false, error: insertError.message };
  const screen = await loadDetail(sb, inserted.id as string);
  if (!screen) return { ok: false, error: "Screen not found." };
  return { ok: true, screen };
}

export async function getNetworkScreen(
  screenId: string
): Promise<{ ok: true; screen: NetworkScreenDetail } | ActionError> {
  if (!ensureConfigured()) return notConfigured();
  if (!z.string().uuid().safeParse(screenId).success) {
    return { ok: false, error: "Screen not found." };
  }
  try {
    const screen = await loadResolved(createServiceRoleClient(), screenId);
    if (!screen) return { ok: false, error: "Screen not found." };
    return { ok: true, screen };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not load the screen." };
  }
}

export async function listNetworkScreens(): Promise<
  { ok: true; screens: NetworkScreenListItem[] } | ActionError
> {
  if (!ensureConfigured()) return notConfigured();
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("network_screens")
    .select("id, connector_contact_id, connector_name, status, visible_count, created_at")
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as {
    id: string;
    connector_contact_id: string;
    connector_name: string;
    status: string;
    visible_count: number;
    created_at: string;
  }[];
  const screens = rows.filter((screen) => {
    const sameContact = rows.filter(
      (other) => other.connector_contact_id === screen.connector_contact_id
    );
    return importedSiblingId(snapshotOf(screen), sameContact.map(snapshotOf)) === null;
  });
  const ids = screens.map((screen) => screen.id);
  const counts = new Map<string, { tier1: number; queued: number }>();
  if (ids.length) {
    const { data: people, error: peopleError } = await sb
      .from("network_screen_candidates")
      .select("screen_id, tier, queue_status")
      .in("screen_id", ids);
    if (peopleError) return { ok: false, error: peopleError.message };
    for (const person of people ?? []) {
      const current = counts.get(person.screen_id as string) ?? { tier1: 0, queued: 0 };
      if (person.tier === "tier1") {
        current.tier1 += 1;
        if (person.queue_status === "queued") current.queued += 1;
      }
      counts.set(person.screen_id as string, current);
    }
  }
  return {
    ok: true,
    screens: screens.map((screen) => ({
      id: screen.id,
      connectorName: screen.connector_name,
      status: isScreenStatus(screen.status) ? screen.status : "awaiting_capture",
      visibleCount: screen.visible_count,
      tier1Count: counts.get(screen.id)?.tier1 ?? 0,
      queuedCount: counts.get(screen.id)?.queued ?? 0,
      createdAt: screen.created_at,
    })),
  };
}

type ScoredPerson = {
  id?: unknown;
  bucket?: unknown;
  tier?: unknown;
  title?: unknown;
  company?: unknown;
  why?: unknown;
  ask?: unknown;
  next_action?: unknown;
};

async function scoreChunk(
  screen: NetworkScreenDetail,
  people: NetworkScreenCandidate[]
): Promise<{ partnerNote: string | null; rows: Map<string, ReturnType<typeof applyScoreRules>> }> {
  const payload = people.map((person) => ({
    id: person.id,
    name: person.name,
    headline: person.headline,
    location: person.location,
    linkedin_degree: person.linkedinDegree,
    mutual_connections: person.mutualConnections,
  }));
  const { text } = await generateText({
    model: heavyModel(),
    maxOutputTokens: 16000,
    system: NETWORK_SCREEN_STRATEGY,
    messages: [
      {
        role: "user",
        content: `Connector: ${screen.connectorName}${screen.connectorHeadline ? `, ${screen.connectorHeadline}` : ""}${screen.connectorCompany ? ` at ${screen.connectorCompany}` : ""}.

Return STRICT JSON only:
{"partner_note":"","candidates":[{"id":"","bucket":"hiring_path|recruiter|peer_referral|speaking_content|not_relevant","tier":"tier1|tier2|none","title":"","company":"","why":"","ask":"","next_action":""}]}

why and ask are one line each and only for tier1. partner_note is empty unless the connector's own work is adjacent to Jason's.

People:
${JSON.stringify(payload)}`,
      },
    ],
    providerOptions: anthropicOptions(),
  });
  const parsed = parseJsonObject(text);
  if (!parsed || !Array.isArray(parsed.candidates)) {
    throw new Error("The scoring model did not return a usable list.");
  }
  const byId = new Map(people.map((person) => [person.id, person]));
  const rows = new Map<string, ReturnType<typeof applyScoreRules>>();
  for (const entry of parsed.candidates as ScoredPerson[]) {
    const id = blank(entry.id);
    const person = id ? byId.get(id) : undefined;
    if (!id || !person) continue;
    rows.set(
      id,
      applyScoreRules({
        linkedinDegree: person.linkedinDegree,
        bucket: blank(entry.bucket) ?? "not_relevant",
        tier: blank(entry.tier) ?? "none",
        title: blank(entry.title),
        company: blank(entry.company),
        why: blank(entry.why),
        ask: blank(entry.ask),
        nextAction: blank(entry.next_action),
      })
    );
  }
  return { partnerNote: blank(parsed.partner_note), rows };
}

export async function scoreNetworkScreen({
  screenId,
}: {
  screenId: string;
}): Promise<{ ok: true; screen: NetworkScreenDetail } | ActionError> {
  if (!ensureConfigured()) return notConfigured();
  const loaded = await getNetworkScreen(screenId);
  if (!loaded.ok) return loaded;
  if (!loaded.screen.candidates.length) {
    return { ok: false, error: "No connections to score." };
  }
  const chunks: NetworkScreenCandidate[][] = [];
  for (let i = 0; i < loaded.screen.candidates.length; i += SCORE_CHUNK) {
    chunks.push(loaded.screen.candidates.slice(i, i + SCORE_CHUNK));
  }
  let partnerNote: string | null = null;
  const scored = new Map<string, ReturnType<typeof applyScoreRules>>();
  try {
    for (const chunk of chunks) {
      const result = await scoreChunk(loaded.screen, chunk);
      if (!partnerNote && result.partnerNote) partnerNote = result.partnerNote;
      for (const [id, row] of result.rows) scored.set(id, row);
    }
  } catch (err) {
    console.error("[network-screen.score]", err);
    const message = err instanceof Error ? err.message : "";
    if (message.includes("usable list")) return { ok: false, error: message };
    return { ok: false, error: "Couldn't reach the scoring model. Try again." };
  }
  if (!scored.size) {
    return { ok: false, error: "The scoring model did not return a usable list. Try again." };
  }

  const sb = createServiceRoleClient();
  const writes = [...scored.entries()].map(([id, row]) =>
    sb
      .from("network_screen_candidates")
      .update({
        bucket: row.bucket,
        tier: row.tier,
        title: row.title,
        company: row.company,
        why: row.why,
        ask: row.ask,
        next_action: row.nextAction,
        scored_by: "ai",
      })
      .eq("id", id)
  );
  const results = await Promise.all(writes);
  const failed = results.find((result) => result.error);
  if (failed?.error) return { ok: false, error: failed.error.message };

  const { error } = await sb
    .from("network_screens")
    .update({
      partner_note: partnerNote ?? loaded.screen.partnerNote,
      status: "scored" satisfies ScreenStatus,
    })
    .eq("id", screenId);
  if (error) return { ok: false, error: error.message };
  return getNetworkScreen(screenId);
}

export type CandidatePatch = {
  bucket?: Bucket;
  tier?: Tier;
  why?: string | null;
  ask?: string | null;
  nextAction?: string | null;
  queueStatus?: QueueStatus;
};

async function ensureContactForCandidate(
  sb: ReturnType<typeof createServiceRoleClient>,
  candidate: CandidateRow,
  connectorName: string
): Promise<string> {
  const note = `From Network Screen via ${connectorName}`;
  const linkedin = candidate.linkedin_url ? normalizeConnectorUrl(candidate.linkedin_url) : null;
  if (linkedin) {
    const { data: existing, error } = await sb
      .from("contacts")
      .select("id, tracks, notes, title")
      .eq("linkedin_url", linkedin)
      .limit(1);
    if (error) throw new Error(error.message);
    const row = existing?.[0] as
      | { id: string; tracks: string[] | null; notes: string | null; title: string | null }
      | undefined;
    if (row) {
      const tracks = Array.isArray(row.tracks) ? row.tracks : [];
      const notes = row.notes?.includes(note) ? row.notes : [row.notes, note].filter(Boolean).join("\n");
      const { error: updateError } = await sb
        .from("contacts")
        .update({
          tracks: tracks.includes("job_search") ? tracks : [...tracks, "job_search"],
          notes,
          title: row.title || candidate.title,
        })
        .eq("id", row.id);
      if (updateError) throw new Error(updateError.message);
      return row.id;
    }
  }
  const { data: inserted, error: insertError } = await sb
    .from("contacts")
    .insert({
      name: candidate.name,
      title: candidate.title,
      linkedin_url: linkedin,
      tracks: ["job_search"],
      notes: note,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);
  return inserted.id as string;
}

export async function updateCandidate({
  id,
  patch,
}: {
  id: string;
  patch: CandidatePatch;
}): Promise<{ ok: true; candidate: NetworkScreenCandidate } | ActionError> {
  if (!ensureConfigured()) return notConfigured();
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Person not found." };
  }
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("network_screen_candidates")
    .select("*, network_screens(connector_name)")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Person not found." };
  const current = data as CandidateRow & { network_screens?: { connector_name?: string } | { connector_name?: string }[] | null };
  const connector = Array.isArray(current.network_screens)
    ? current.network_screens[0]?.connector_name
    : current.network_screens?.connector_name;

  const next: Record<string, unknown> = {};
  if (patch.bucket && isBucket(patch.bucket) && patch.bucket !== current.bucket) {
    next.bucket = patch.bucket;
    next.scored_by = "user";
  }
  let tier = patch.tier && isTier(patch.tier) ? patch.tier : undefined;
  if (tier && tier !== current.tier) {
    if (current.linkedin_degree === "1st" && tier === "tier1") {
      tier = "tier2";
      next.next_action = "Reactivate directly";
    }
    next.tier = tier;
    next.scored_by = "user";
  }
  if ("why" in patch) next.why = blank(patch.why);
  if ("ask" in patch) next.ask = blank(patch.ask);
  if ("nextAction" in patch && !("next_action" in next)) next.next_action = blank(patch.nextAction);
  if (patch.queueStatus && isQueueStatus(patch.queueStatus)) {
    next.queue_status = patch.queueStatus;
    if (patch.queueStatus === "intro_requested" && !current.intro_requested_at) {
      next.intro_requested_at = new Date().toISOString();
    }
  }
  const queue = (next.queue_status as QueueStatus | undefined) ?? (isQueueStatus(current.queue_status) ? current.queue_status : "queued");
  if (
    (queue === "intro_made" || queue === "reached_out_direct") &&
    !current.contact_id
  ) {
    try {
      next.contact_id = await ensureContactForCandidate(sb, current, connector || "the connector");
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not save the contact." };
    }
  }
  if (Object.keys(next).length) {
    const { error: updateError } = await sb.from("network_screen_candidates").update(next).eq("id", id);
    if (updateError) return { ok: false, error: updateError.message };
  }
  const { data: saved, error: reloadError } = await sb
    .from("network_screen_candidates")
    .select("*")
    .eq("id", id)
    .single();
  if (reloadError) return { ok: false, error: reloadError.message };
  return { ok: true, candidate: mapCandidate(saved as CandidateRow) };
}

export async function updateNetworkScreen({
  screenId,
  patch,
}: {
  screenId: string;
  patch: {
    relationshipWarmth?: RelationshipWarmth;
    meetingNotesSummary?: string | null;
    openCommitments?: string | null;
    partnerNote?: string | null;
    draftSubject?: string | null;
    draftBody?: string | null;
  };
}): Promise<{ ok: true; screen: NetworkScreenDetail } | ActionError> {
  if (!ensureConfigured()) return notConfigured();
  const next: Record<string, unknown> = {};
  if (patch.relationshipWarmth && isWarmth(patch.relationshipWarmth)) {
    next.relationship_warmth = patch.relationshipWarmth;
  }
  if ("meetingNotesSummary" in patch) next.meeting_notes_summary = blank(patch.meetingNotesSummary);
  if ("openCommitments" in patch) next.open_commitments = blank(patch.openCommitments);
  if ("partnerNote" in patch) next.partner_note = blank(patch.partnerNote);
  if ("draftSubject" in patch) next.draft_subject = blank(patch.draftSubject);
  if ("draftBody" in patch) next.draft_body = patch.draftBody ? stripEmDashes(patch.draftBody) : null;
  if (!Object.keys(next).length) return getNetworkScreen(screenId);
  const sb = createServiceRoleClient();
  const { error } = await sb.from("network_screens").update(next).eq("id", screenId);
  if (error) return { ok: false, error: error.message };
  return getNetworkScreen(screenId);
}

function tier1ForDraft(screen: NetworkScreenDetail): NetworkScreenCandidate[] {
  return screen.candidates
    .filter((person) => person.tier === "tier1")
    .sort(
      (a, b) =>
        BUCKET_RANK[a.bucket] - BUCKET_RANK[b.bucket] || a.sortOrder - b.sortOrder
    );
}

export async function draftIntroRequest({
  screenId,
}: {
  screenId: string;
}): Promise<{ ok: true; subject: string; body: string; screen: NetworkScreenDetail } | ActionError> {
  if (!ensureConfigured()) return notConfigured();
  const loaded = await getNetworkScreen(screenId);
  if (!loaded.ok) return loaded;
  const tier1 = tier1ForDraft(loaded.screen);
  if (!tier1.length) return { ok: false, error: "No Tier 1 people to ask about." };
  const screen = loaded.screen;
  const warm = screen.relationshipWarmth === "warm" || screen.relationshipWarmth === "expecting_review";
  const sizing = warm
    ? "Include every Tier 1 name in the ask."
    : "Ask for an intro to the first person only. List the rest in one FYI line. Do not ask for intros to all of them.";
  const people = tier1
    .map(
      (person, index) =>
        `${index + 1}. ${person.name}${person.title ? `, ${person.title}` : ""}${person.company ? ` at ${person.company}` : ""}. Why: ${person.why || "(none)"}. Ask: ${person.ask || "(none)"}.`
    )
    .join("\n");
  const system = `${JASON_CORE_VOICE}

${NO_AI_SLOP_WRITING_RULES}

${DRAFT_RULES}

Return STRICT JSON only: {"subject":"...","body":"..."}
Greet by first name. Sign off "- Jason". Hyphens, not em dashes.`;
  const prompt = `Write the intro-request email FROM Jason TO ${screen.connectorName}.
Warmth: ${screen.relationshipWarmth}.
${sizing}

Meeting notes:
${screen.meetingNotesSummary || "(none)"}

Open commitments:
${screen.openCommitments || "(none)"}

Partner note:
${screen.partnerNote || "(none)"}

Tier 1, highest value first:
${people}`;

  try {
    const { text } = await generateText({
      model: heavyModel(),
      maxOutputTokens: 1200,
      system,
      messages: [{ role: "user", content: prompt }],
      providerOptions: anthropicOptions(),
    });
    const parsed = parseJsonObject(text);
    const subject = stripEmDashes(blank(parsed?.subject) ?? "");
    const body = stripEmDashes(blank(parsed?.body) ?? "");
    if (!body) {
      return { ok: false, error: "The draft did not come back in a usable form. Try again." };
    }
    const sb = createServiceRoleClient();
    const { error } = await sb
      .from("network_screens")
      .update({
        draft_subject: subject,
        draft_body: body,
        status: "drafted" satisfies ScreenStatus,
      })
      .eq("id", screenId);
    if (error) return { ok: false, error: error.message };
    const saved = await getNetworkScreen(screenId);
    if (!saved.ok) return saved;
    return { ok: true, subject, body, screen: saved.screen };
  } catch (err) {
    console.error("[network-screen.draft]", err);
    return { ok: false, error: "Couldn't reach the drafting model. Try again." };
  }
}

export async function markIntrosRequested({
  screenId,
  candidateIds,
}: {
  screenId: string;
  candidateIds: string[];
}): Promise<{ ok: true; screen: NetworkScreenDetail } | ActionError> {
  if (!ensureConfigured()) return notConfigured();
  const ids = candidateIds.filter((id) => z.string().uuid().safeParse(id).success);
  if (!ids.length) return { ok: false, error: "Pick at least one person." };
  const sb = createServiceRoleClient();
  const now = new Date().toISOString();
  const { error } = await sb
    .from("network_screen_candidates")
    .update({ queue_status: "intro_requested", intro_requested_at: now })
    .eq("screen_id", screenId)
    .in("id", ids);
  if (error) return { ok: false, error: error.message };
  const { data: screen, error: screenError } = await sb
    .from("network_screens")
    .update({ requested_at: now, status: "requested" })
    .eq("id", screenId)
    .select("connector_contact_id")
    .single();
  if (screenError) return { ok: false, error: screenError.message };
  const { error: touchError } = await sb
    .from("contacts")
    .update({ last_touch_date: todayEt(), last_touch_channel: "email" })
    .eq("id", screen.connector_contact_id as string);
  if (touchError) return { ok: false, error: touchError.message };
  return getNetworkScreen(screenId);
}

export async function listPendingIntros(): Promise<
  { ok: true; intros: PendingIntro[] } | ActionError
> {
  if (!ensureConfigured()) return notConfigured();
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("network_screen_candidates")
    .select("id, screen_id, name, title, company, queue_status, intro_requested_at, network_screens(connector_name)")
    .eq("tier", "tier1")
    .in("queue_status", ["queued", "intro_requested"])
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  const intros: PendingIntro[] = (data ?? []).map((row) => {
    const joined = row.network_screens as { connector_name?: string } | { connector_name?: string }[] | null;
    const connectorName = Array.isArray(joined) ? joined[0]?.connector_name : joined?.connector_name;
    return {
      id: row.id as string,
      screenId: row.screen_id as string,
      name: row.name as string,
      title: blank(row.title),
      company: blank(row.company),
      connectorName: connectorName || "Unknown",
      queueStatus: isQueueStatus(row.queue_status as string) ? (row.queue_status as QueueStatus) : "queued",
      introRequestedAt: (row.intro_requested_at as string | null) ?? null,
    };
  });
  return { ok: true, intros };
}

const importCandidate = z.object({
  name: z.string().min(1).max(200),
  headline: z.string().max(500).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  linkedin_degree: z.string().max(20).nullable().optional(),
  mutual_connections: z.string().max(500).nullable().optional(),
  linkedin_url: z.string().max(500).nullable().optional(),
});

export async function importNetworkScreen(input: {
  screen_id: string;
  connector_degree?: string | null;
  total_count_label?: string | null;
  candidates: z.infer<typeof importCandidate>[];
}): Promise<{ ok: true; stored_count: number; screen_url: string } | ActionError> {
  if (!ensureConfigured()) return notConfigured();
  if (!z.string().uuid().safeParse(input.screen_id).success) {
    return { ok: false, error: "Screen not found." };
  }
  const parsedCandidates = z.array(importCandidate).max(200).safeParse(input.candidates);
  if (!parsedCandidates.success) {
    return { ok: false, error: "Each person needs a name. Send at most 200." };
  }
  const candidates = parsedCandidates.data;
  const sb = createServiceRoleClient();
  const { data: existing, error: existingError } = await sb
    .from("network_screens")
    .select("id")
    .eq("id", input.screen_id)
    .maybeSingle();
  if (existingError) return { ok: false, error: existingError.message };
  if (!existing) return { ok: false, error: "Screen not found." };

  const rows = candidates
    .map((person, index) => ({
      screen_id: input.screen_id,
      name: person.name.trim(),
      headline: blank(person.headline),
      location: blank(person.location),
      linkedin_degree: asDegree(person.linkedin_degree),
      mutual_connections: blank(person.mutual_connections),
      linkedin_url: person.linkedin_url ? normalizeConnectorUrl(person.linkedin_url) : null,
      sort_order: index,
    }))
    .filter((person) => person.name);

  const { data: inserted, error: insertError } = rows.length
    ? await sb.from("network_screen_candidates").insert(rows).select("id")
    : { data: [] as { id: string }[], error: null };
  if (insertError) return { ok: false, error: insertError.message };
  const keep = new Set((inserted ?? []).map((row) => row.id as string));
  const { data: previous, error: previousError } = await sb
    .from("network_screen_candidates")
    .select("id")
    .eq("screen_id", input.screen_id);
  if (previousError) return { ok: false, error: previousError.message };
  const stale = (previous ?? []).map((row) => row.id as string).filter((id) => !keep.has(id));
  if (stale.length) {
    const { error: deleteError } = await sb.from("network_screen_candidates").delete().in("id", stale);
    if (deleteError) return { ok: false, error: deleteError.message };
  }
  const { error: updateError } = await sb
    .from("network_screens")
    .update({
      connector_degree: asDegree(input.connector_degree),
      total_count_label: blank(input.total_count_label),
      visible_count: rows.length,
      status: "captured" satisfies ScreenStatus,
    })
    .eq("id", input.screen_id);
  if (updateError) return { ok: false, error: updateError.message };
  return {
    ok: true,
    stored_count: rows.length,
    screen_url: `${SCREEN_URL}?section=network-screen&screen=${input.screen_id}`,
  };
}
