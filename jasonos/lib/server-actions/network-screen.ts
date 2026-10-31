"use server";

import { generateText } from "ai";
import { z } from "zod";
import { JASON_CORE_VOICE, JASON_IDENTITY } from "@/lib/ai/jason-identity";
import { fastModel, hasDirectAnthropicKey, heavyModel } from "@/lib/ai/models";
import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";
import { stripEmDashes } from "@/lib/email-templates/render";
import { searchGranolaForContact } from "@/lib/integrations/granola";
import { getConnectionByLinkedInUrl } from "@/lib/integrations/leaddelta";
import { normalizeLinkedInUrl } from "@/lib/integrations/leaddelta-parse";
import { blurbWordCount, peopleInTheAsk } from "@/lib/network-screen/blurbs";
import {
  IMPORT_SIBLING_WINDOW_MS,
  importedSiblingId,
  type ScreenSnapshot,
} from "@/lib/network-screen/follow-import";
import { classifyCandidates, type ClassifiedPick } from "@/lib/network-screen/score";
import {
  BLURB_RULES,
  DRAFT_RULES,
  NETWORK_SCREEN_LANE_DEFINITIONS,
  NETWORK_SCREEN_STRATEGY,
} from "@/lib/network-screen/strategy";
import {
  isBucket,
  isLane,
  isQueueStatus,
  isScreenStatus,
  isTier,
  isWarmth,
  type Bucket,
  type NetworkBenchPerson,
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

const SCREEN_URL = "https://jasonos.vercel.app/network-screen";
const BUCKET_RANK: Record<Bucket, number> = {
  hiring_path: 0,
  recruiter: 1,
  peer_referral: 2,
  prospect: 3,
  operating_partner: 4,
  speaking_content: 5,
  industry_peer: 6,
  not_relevant: 7,
  unscored: 8,
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
  include_blurbs_in_email?: boolean | null;
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
  lane?: string | null;
  tier: string;
  why: string | null;
  ask: string | null;
  intro_blurb?: string | null;
  intro_blurb_generated_at?: string | null;
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
    includeBlurbsInEmail: Boolean(row.include_blurbs_in_email),
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
    lane: (() => {
      const value = row.lane ?? "";
      return isLane(value) ? value : "unassigned";
    })(),
    tier: isTier(row.tier) ? row.tier : "none",
    why: row.why,
    ask: row.ask,
    introBlurb: row.intro_blurb ?? null,
    introBlurbGeneratedAt: row.intro_blurb_generated_at ?? null,
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

export async function deleteNetworkScreen(
  screenId: string
): Promise<{ ok: true } | ActionError> {
  if (!ensureConfigured()) return notConfigured();
  if (!z.string().uuid().safeParse(screenId).success) {
    return { ok: false, error: "Screen not found." };
  }
  const sb = createServiceRoleClient();
  const { error } = await sb.from("network_screens").delete().eq("id", screenId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

type ClassificationEntry = {
  id?: unknown;
  lane?: unknown;
  tier?: unknown;
  bucket?: unknown;
  title?: unknown;
  company?: unknown;
  why?: unknown;
  ask?: unknown;
};

async function screenBrief(_sb: ReturnType<typeof createServiceRoleClient>): Promise<string> {
  return `Classify every connection into one of these lanes:\n${NETWORK_SCREEN_LANE_DEFINITIONS}`;
}

async function classifyConnections(
  screen: NetworkScreenDetail,
  brief: string
): Promise<ReturnType<typeof classifyCandidates>> {
  const payload = screen.candidates.map((person) => ({
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
        content: `What Jason is looking for:
${brief}

Connector: ${screen.connectorName}${screen.connectorHeadline ? `, ${screen.connectorHeadline}` : ""}${screen.connectorCompany ? ` at ${screen.connectorCompany}` : ""}.

Return STRICT JSON only:
{"people":[{"id":"","lane":"job_search|advisors|industry|none","tier":"tier1|tier2|none","bucket":"","title":"","company":"","why":"","ask":""}]}

One entry per person. Use ids from the list. Mark linkedin_degree 1st as tier2 with lane by the same rules.

Connections:
${JSON.stringify(payload)}`,
      },
    ],
    providerOptions: anthropicOptions(),
  });
  const parsed = parseJsonObject(text);
  const entries = parsed?.people;
  if (!Array.isArray(entries)) {
    throw new Error("The classification did not come back in a usable form.");
  }
  const picks: ClassifiedPick[] = (entries as ClassificationEntry[]).map((entry) => ({
    id: blank(entry.id) ?? "",
    lane: blank(entry.lane) ?? "none",
    tier: blank(entry.tier) ?? "none",
    bucket: blank(entry.bucket) ?? "not_relevant",
    title: blank(entry.title),
    company: blank(entry.company),
    why: blank(entry.why),
    ask: blank(entry.ask),
  }));
  return classifyCandidates(screen.candidates, picks);
}

export async function scoreNetworkScreen({
  screenId,
  rerun = false,
}: {
  screenId: string;
  rerun?: boolean;
}): Promise<{ ok: true; screen: NetworkScreenDetail; message?: string } | ActionError> {
  if (!ensureConfigured()) return notConfigured();
  const loaded = await getNetworkScreen(screenId);
  if (!loaded.ok) return loaded;
  if (!loaded.screen.candidates.length) {
    return { ok: false, error: "No connections to read." };
  }
  const previousStatus = loaded.screen.status;
  if (!rerun && previousStatus !== "captured") {
    return loaded;
  }
  if (rerun && previousStatus === "awaiting_capture") {
    return { ok: false, error: "Capture connections before re-running." };
  }

  const sb = createServiceRoleClient();
  if (!rerun) {
    const { data: claimed, error: claimError } = await sb
      .from("network_screens")
      .update({ status: "scored" satisfies ScreenStatus })
      .eq("id", screenId)
      .eq("status", "captured")
      .select("id");
    if (claimError) return { ok: false, error: claimError.message };
    if (!claimed?.length) return getNetworkScreen(screenId);
  }

  let classified: ReturnType<typeof classifyCandidates>;
  try {
    const brief = await screenBrief(sb);
    classified = await classifyConnections(loaded.screen, brief);
  } catch (err) {
    console.error("[network-screen.recommend]", err);
    if (!rerun) {
      await sb.from("network_screens").update({ status: "captured" satisfies ScreenStatus }).eq("id", screenId);
    }
    const message = err instanceof Error ? err.message : "";
    if (message.includes("usable form")) return { ok: false, error: message };
    return { ok: false, error: "Couldn't classify the connections. Try again." };
  }

  const tier1 = classified.filter((person) => person.tier === "tier1");
  const tier2 = classified.filter((person) => person.tier === "tier2");
  const none = classified.filter((person) => person.tier === "none");
  const ordered = [...tier1, ...tier2, ...none];

  const writes = ordered.map((person, index) =>
    sb
      .from("network_screen_candidates")
      .update({
        lane: person.lane,
        bucket: person.bucket,
        tier: person.tier,
        title: person.title,
        company: person.company,
        why: person.why,
        ask: person.ask,
        next_action: person.nextAction,
        scored_by: "ai",
        sort_order: index,
      })
      .eq("id", person.id)
      .eq("screen_id", screenId)
  );
  const results = await Promise.all(writes);
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    if (!rerun) {
      await sb.from("network_screens").update({ status: "captured" satisfies ScreenStatus }).eq("id", screenId);
    }
    return { ok: false, error: failed.error.message };
  }

  if (rerun && previousStatus !== "drafted" && previousStatus !== "requested") {
    const { error: statusError } = await sb
      .from("network_screens")
      .update({ status: "scored" satisfies ScreenStatus })
      .eq("id", screenId);
    if (statusError) return { ok: false, error: statusError.message };
  }

  const saved = await getNetworkScreen(screenId);
  if (!saved.ok) return saved;
  if (!tier1.length) {
    return {
      ok: true,
      screen: saved.screen,
      message: "Classified the list. None of the visible connections were strong enough for the intro ask.",
    };
  }
  return {
    ok: true,
    screen: saved.screen,
    message: rerun ? "Re-ran the screen and refreshed the three intros and bench." : undefined,
  };
}

export type CandidatePatch = {
  bucket?: Bucket;
  tier?: Tier;
  why?: string | null;
  ask?: string | null;
  introBlurb?: string | null;
  nextAction?: string | null;
  queueStatus?: QueueStatus;
};

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
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Person not found." };
  const current = data as CandidateRow;

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
  if ("introBlurb" in patch) next.intro_blurb = blank(patch.introBlurb);
  if ("nextAction" in patch && !("next_action" in next)) next.next_action = blank(patch.nextAction);
  if (patch.queueStatus && isQueueStatus(patch.queueStatus)) {
    next.queue_status = patch.queueStatus;
    if (patch.queueStatus === "intro_requested" && !current.intro_requested_at) {
      next.intro_requested_at = new Date().toISOString();
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
    includeBlurbsInEmail?: boolean;
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
  if ("includeBlurbsInEmail" in patch) next.include_blurbs_in_email = Boolean(patch.includeBlurbsInEmail);
  if (!Object.keys(next).length) return getNetworkScreen(screenId);
  const sb = createServiceRoleClient();
  const { error } = await sb.from("network_screens").update(next).eq("id", screenId);
  if (error) return { ok: false, error: error.message };
  return getNetworkScreen(screenId);
}

export async function saveNetworkScreenAnalysis({
  screenId,
  patch,
  recommendations,
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
  recommendations: { id: string; why: string | null; ask: string | null }[];
}): Promise<{ ok: true; screen: NetworkScreenDetail } | ActionError> {
  if (!ensureConfigured()) return notConfigured();
  if (!z.string().uuid().safeParse(screenId).success) {
    return { ok: false, error: "Screen not found." };
  }
  const people = z
    .array(
      z.object({
        id: z.string().uuid(),
        why: z.string().max(4000).nullable(),
        ask: z.string().max(4000).nullable(),
      })
    )
    .max(3)
    .safeParse(recommendations);
  if (!people.success) return { ok: false, error: "Could not save the analysis." };

  const sb = createServiceRoleClient();
  const { data: existing, error: existingError } = await sb
    .from("network_screens")
    .select("id, status")
    .eq("id", screenId)
    .maybeSingle();
  if (existingError) return { ok: false, error: existingError.message };
  if (!existing) return { ok: false, error: "Screen not found." };

  for (const person of people.data) {
    const { error } = await sb
      .from("network_screen_candidates")
      .update({ why: blank(person.why), ask: blank(person.ask) })
      .eq("id", person.id)
      .eq("screen_id", screenId);
    if (error) return { ok: false, error: error.message };
  }

  const next: Record<string, unknown> = {};
  if (patch.relationshipWarmth && isWarmth(patch.relationshipWarmth)) {
    next.relationship_warmth = patch.relationshipWarmth;
  }
  if ("meetingNotesSummary" in patch) next.meeting_notes_summary = blank(patch.meetingNotesSummary);
  if ("openCommitments" in patch) next.open_commitments = blank(patch.openCommitments);
  if ("partnerNote" in patch) next.partner_note = blank(patch.partnerNote);
  if ("draftSubject" in patch) next.draft_subject = blank(patch.draftSubject);
  if ("draftBody" in patch) next.draft_body = patch.draftBody ? stripEmDashes(patch.draftBody) : null;
  const status = typeof existing.status === "string" ? existing.status : "";
  const hasDraft = Boolean(blank(patch.draftSubject) || (patch.draftBody ? stripEmDashes(patch.draftBody) : null));
  if (hasDraft && (status === "scored" || status === "captured")) {
    next.status = "drafted" satisfies ScreenStatus;
  }
  if (Object.keys(next).length) {
    const { error } = await sb.from("network_screens").update(next).eq("id", screenId);
    if (error) return { ok: false, error: error.message };
  }
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

export async function generateIntroBlurbs({
  screenId,
  candidateIds,
}: {
  screenId: string;
  candidateIds?: string[];
}): Promise<{ ok: true; screen: NetworkScreenDetail } | ActionError> {
  if (!ensureConfigured()) return notConfigured();
  const loaded = await getNetworkScreen(screenId);
  if (!loaded.ok) return loaded;
  const screen = loaded.screen;
  const tier1 = tier1ForDraft(screen);
  const wanted = candidateIds?.length
    ? new Set(candidateIds.filter((id) => z.string().uuid().safeParse(id).success))
    : null;
  const people = wanted ? tier1.filter((person) => wanted.has(person.id)) : peopleInTheAsk(screen);
  if (!people.length) return { ok: false, error: "No intro recommendations to write about." };

  const system = `${JASON_IDENTITY}

${NO_AI_SLOP_WRITING_RULES}

${BLURB_RULES}

Return STRICT JSON only: {"blurbs":[{"id":"...","blurb":"..."}]}`;
  const listed = people
    .map(
      (person) =>
        `id: ${person.id}\nname: ${person.name}\ntitle: ${person.title || "(none)"}\ncompany: ${person.company || "(none)"}\nbucket: ${person.bucket}\nwhy: ${person.why || "(none)"}\nask: ${person.ask || "(none)"}`
    )
    .join("\n\n");
  const prompt = `Write one forwardable intro blurb for each person below. The voice is ${screen.connectorName}, not Jason.

Connector: ${screen.connectorName}
Headline: ${screen.connectorHeadline || "(none)"}
Company: ${screen.connectorCompany || "(none)"}

Meeting notes:
${screen.meetingNotesSummary || "(none)"}

Partner note:
${screen.partnerNote || "(none)"}

People:
${listed}`;

  try {
    const { text } = await generateText({
      model: heavyModel(),
      maxOutputTokens: 2000,
      system,
      messages: [{ role: "user", content: prompt }],
      providerOptions: anthropicOptions(),
    });
    const parsed = parseJsonObject(text);
    const raw = parsed?.blurbs;
    if (!Array.isArray(raw)) {
      return { ok: false, error: "The blurbs did not come back in a usable form. Try again." };
    }
    const byId = new Map(people.map((person) => [person.id, person]));
    const writes: { id: string; blurb: string }[] = [];
    const tooLong: string[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as { id?: unknown; blurb?: unknown };
      const id = blank(record.id);
      const blurb = stripEmDashes(blank(record.blurb) ?? "");
      const person = id ? byId.get(id) : undefined;
      if (!person || !blurb) continue;
      if (blurbWordCount(blurb) > 160) {
        tooLong.push(person.name);
        continue;
      }
      writes.push({ id: person.id, blurb });
    }
    if (!writes.length && !tooLong.length) {
      return { ok: false, error: "The blurbs did not come back in a usable form. Try again." };
    }
    const sb = createServiceRoleClient();
    const now = new Date().toISOString();
    for (const write of writes) {
      const { error } = await sb
        .from("network_screen_candidates")
        .update({ intro_blurb: write.blurb, intro_blurb_generated_at: now })
        .eq("id", write.id)
        .eq("screen_id", screenId);
      if (error) return { ok: false, error: error.message };
    }
    if (tooLong.length) {
      const names = tooLong.join(", ");
      return {
        ok: false,
        error: `The intro for ${names} is over 160 words. Try again.`,
      };
    }
    return getNetworkScreen(screenId);
  } catch (err) {
    console.error("[network-screen.blurbs]", err);
    return { ok: false, error: "Couldn't reach the drafting model. Try again." };
  }
}

export async function draftIntroRequest({
  screenId,
}: {
  screenId: string;
}): Promise<
  | { ok: true; subject: string; body: string; screen: NetworkScreenDetail; blurbError: string | null }
  | ActionError
> {
  if (!ensureConfigured()) return notConfigured();
  const loaded = await getNetworkScreen(screenId);
  if (!loaded.ok) return loaded;
  const tier1 = tier1ForDraft(loaded.screen);
  if (!tier1.length) return { ok: false, error: "No intro recommendations to ask about." };
  const screen = loaded.screen;
  const asked = peopleInTheAsk(screen);
  const sizing =
    asked.length === tier1.length
      ? "Ask for an introduction to each of these people."
      : "Ask for an introduction to the first person only. Mention the other names in one line as the other people worth an introduction. Do not ask for all of them at once.";
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

The people Jason should ask to be introduced to, strongest first:
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
    const firstDraft = !blank(screen.draftBody);
    const { error } = await sb
      .from("network_screens")
      .update({
        draft_subject: subject,
        draft_body: body,
        status: "drafted" satisfies ScreenStatus,
        ...(firstDraft
          ? {
              include_blurbs_in_email:
                screen.relationshipWarmth === "warm" ||
                screen.relationshipWarmth === "expecting_review",
            }
          : {}),
      })
      .eq("id", screenId);
    if (error) return { ok: false, error: error.message };
    const blurbs = await generateIntroBlurbs({ screenId });
    const saved = await getNetworkScreen(screenId);
    if (!saved.ok) return saved;
    return {
      ok: true,
      subject,
      body,
      screen: saved.screen,
      blurbError: blurbs.ok ? null : blurbs.error,
    };
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

export async function listNetworkBench(): Promise<
  | {
      ok: true;
      bench: {
        job_search: NetworkBenchPerson[];
        advisors: NetworkBenchPerson[];
        industry: NetworkBenchPerson[];
      };
    }
  | ActionError
> {
  if (!ensureConfigured()) return notConfigured();
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("network_screen_candidates")
    .select(
      "id, screen_id, name, title, company, headline, linkedin_url, lane, bucket, why, next_action, queue_status, network_screens(connector_name)"
    )
    .eq("tier", "tier2")
    .in("lane", ["job_search", "advisors", "industry"])
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };

  type Acc = NetworkBenchPerson & { key: string };
  const byKey = new Map<string, Acc>();
  for (const row of data ?? []) {
    const joined = row.network_screens as { connector_name?: string } | { connector_name?: string }[] | null;
    const connectorName =
      (Array.isArray(joined) ? joined[0]?.connector_name : joined?.connector_name) || "Unknown";
    const lane = isLane(row.lane as string) ? (row.lane as Acc["lane"]) : "none";
    if (lane !== "job_search" && lane !== "advisors" && lane !== "industry") continue;
    const linkedinUrl = blank(row.linkedin_url);
    const key = linkedinUrl
      ? `url:${linkedinUrl.toLowerCase().replace(/\/$/, "")}`
      : `name:${String(row.name ?? "").trim().toLowerCase()}`;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.connectors.includes(connectorName)) existing.connectors.push(connectorName);
      continue;
    }
    byKey.set(key, {
      key,
      id: row.id as string,
      screenId: row.screen_id as string,
      name: row.name as string,
      title: blank(row.title),
      company: blank(row.company),
      headline: blank(row.headline),
      linkedinUrl,
      lane,
      bucket: isBucket(row.bucket as string) ? (row.bucket as Bucket) : "not_relevant",
      why: blank(row.why),
      nextAction: blank(row.next_action),
      queueStatus: isQueueStatus(row.queue_status as string)
        ? (row.queue_status as QueueStatus)
        : "queued",
      connectors: [connectorName],
    });
  }

  const people = [...byKey.values()].map((entry) => {
    const { key, ...person } = entry;
    void key;
    return person;
  });
  return {
    ok: true,
    bench: {
      job_search: people.filter((person) => person.lane === "job_search"),
      advisors: people.filter((person) => person.lane === "advisors"),
      industry: people.filter((person) => person.lane === "industry"),
    },
  };
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
    screen_url: `${SCREEN_URL}?screen=${input.screen_id}`,
  };
}
