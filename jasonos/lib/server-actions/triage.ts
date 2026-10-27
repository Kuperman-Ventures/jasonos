"use server";

import { revalidatePath } from "next/cache";
import { recordUserAction } from "@/lib/actions/action-log";
import {
  createPublicServiceRoleClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import type { Track, Verb } from "@/lib/types";
import type {
  Intent,
  ReconnectCardBody,
  TrackFilter,
  TriageTrackCounts,
  UntriagedReconnectCard,
} from "@/lib/triage/types";

type ActionResult = { ok: true } | { ok: false; error: string };
const TRACKS: Track[] = ["venture", "advisors", "job_search", "personal"];

export async function setContactTriage(input: {
  contactId: string;
  intent: Intent | null;
  personalGoal: string | null;
}): Promise<ActionResult> {
  if (!hasSupabaseConfig()) {
    return { ok: false, error: "Supabase service role env vars are not configured." };
  }

  const supabase = createServiceRoleClient();
  const triagedAt = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("contacts")
    .update({
      intent: input.intent,
      personal_goal: input.personalGoal,
      updated_at: triagedAt,
    })
    .eq("id", input.contactId);

  if (updateErr) return { ok: false, error: updateErr.message };

  const { error: artifactErr } = await supabase.from("runner_artifacts").insert({
    runner_id: "triage",
    task_id: "contact_triage",
    schema_version: "v1",
    payload: {
      contact_id: input.contactId,
      intent: input.intent,
      personal_goal: input.personalGoal,
      triaged_at: triagedAt,
    },
  });

  if (artifactErr) return { ok: false, error: artifactErr.message };

  revalidatePath("/runner/triage");
  revalidatePath("/reconnect");
  return { ok: true };
}

/**
 * Returns the next un-triaged reconnect card, ordered by priority. Skipped
 * contacts are excluded only for this browser session via the route query.
 */
export async function getNextUntriagedCard(
  skippedContactIds: string[] = [],
  track: TrackFilter = null
): Promise<UntriagedReconnectCard | null> {
  if (!hasSupabaseConfig()) return null;

  const supabase = createServiceRoleClient();
  const skipped = new Set(skippedContactIds.filter(Boolean));

  const { data, error } = await supabase.rpc(
    "next_untriaged_reconnect_card",
    track ? { track_filter: track } : undefined
  );
  if (error) {
    console.error("[triage] getNextUntriagedCard error", error);
    const fallbackCount = await getOpenReconnectCardCount(supabase, track);
    return getNextUntriagedCardAfterSkips(skipped, fallbackCount, track);
  }

  const rpcCard = normalizeCard(Array.isArray(data) ? data[0] : data);
  if (!rpcCard) return null;
  if (skipped.has(rpcCard.contact_id)) {
    return getNextUntriagedCardAfterSkips(skipped, rpcCard.remaining_count, track);
  }
  const firmContext = await getFirmContextForContact(rpcCard.contact_id);
  return { ...rpcCard, firm_context: firmContext };
}

export async function getUntriagedReconnectCount(
  track: TrackFilter = null
): Promise<number> {
  if (!hasSupabaseConfig()) return 0;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc(
    "next_untriaged_reconnect_card",
    track ? { track_filter: track } : undefined
  );
  if (error) {
    console.error("[triage] getUntriagedReconnectCount error", error);
    return getOpenReconnectCardCount(supabase, track);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return Number(row?.remaining_count ?? 0) || getOpenReconnectCardCount(supabase, track);
}

export async function getUntriagedReconnectCountsByTrack(): Promise<TriageTrackCounts> {
  const empty = emptyTrackCounts();
  if (!hasSupabaseConfig()) return empty;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("untriaged_reconnect_counts_by_track");
  if (error) {
    console.error("[triage] getUntriagedReconnectCountsByTrack error", error);
    return getOpenReconnectCountsByTrack(supabase);
  }

  const counts = emptyTrackCounts();
  for (const row of (data ?? []) as Array<{ track: Track; untriaged_count: number }>) {
    if (!TRACKS.includes(row.track)) continue;
    counts.by_track[row.track] = Number(row.untriaged_count ?? 0);
  }
  counts.total = TRACKS.reduce((sum, t) => sum + counts.by_track[t], 0);
  return counts.total > 0 ? counts : getOpenReconnectCountsByTrack(supabase);
}

/**
 * Puts a contact into the "Needs to Be Scheduled" queue on the Communications
 * page and closes the triage card so it does not show again.
 * Called by the right-arrow action in the Triage runner.
 */
export async function addContactToNeedsSchedulingQueue(input: {
  contactId: string;
  cardId: string;
}): Promise<ActionResult> {
  if (!hasSupabaseConfig()) {
    return { ok: false, error: "Supabase service role env vars are not configured." };
  }

  const supabase = createServiceRoleClient();
  const sbPublic = createPublicServiceRoleClient();

  // Close the triage card so it no longer appears in the queue
  const { error: cardErr } = await supabase
    .from("cards")
    .update({ state: "actioned", updated_at: new Date().toISOString() })
    .eq("id", input.cardId);
  if (cardErr) return { ok: false, error: cardErr.message };

  // Resolve the rr_recruiters.id via contacts.source_ids.recruiter_pipeline_id
  const { data: contact } = await supabase
    .from("contacts")
    .select("source_ids")
    .eq("id", input.contactId)
    .maybeSingle();

  const recruiterId = (contact?.source_ids as Record<string, unknown> | null)
    ?.recruiter_pipeline_id;

  if (typeof recruiterId === "string" && recruiterId) {
    // Ensure this recruiter is active (not dismissed) with no next-touch date
    // → computeUrgency returns "needs_scheduling" on the Communications page
    await sbPublic.from("rr_contact_state").upsert(
      {
        contact_id: recruiterId,
        status: "queue",
        next_action_due_date: null,
        status_updated_at: new Date().toISOString(),
      },
      { onConflict: "contact_id" }
    );
  }

  await supabase.from("runner_artifacts").insert({
    runner_id: "triage",
    task_id: "contact_triage",
    schema_version: "v1",
    payload: {
      contact_id: input.contactId,
      card_id: input.cardId,
      action: "added_to_needs_scheduling",
      recruiter_id: recruiterId ?? null,
      triaged_at: new Date().toISOString(),
    },
  });

  revalidatePath("/runner/triage");
  revalidatePath("/communications");
  return { ok: true };
}

/**
 * Permanently closes a triage card without adding the contact to the
 * scheduling queue. Called by the left-arrow action in the Triage runner.
 */
export async function skipContactFromTriage(input: {
  contactId: string;
  cardId: string;
}): Promise<ActionResult> {
  if (!hasSupabaseConfig()) {
    return { ok: false, error: "Supabase service role env vars are not configured." };
  }

  const supabase = createServiceRoleClient();
  const sbPublic = createPublicServiceRoleClient();

  const { error: cardErr } = await supabase
    .from("cards")
    .update({ state: "actioned", updated_at: new Date().toISOString() })
    .eq("id", input.cardId);
  if (cardErr) return { ok: false, error: cardErr.message };

  // Resolve rr_recruiters.id and dismiss the contact from Communications so
  // they are removed from the Needs to Be Scheduled list.
  const { data: contact } = await supabase
    .from("contacts")
    .select("source_ids,name")
    .eq("id", input.contactId)
    .maybeSingle();

  const recruiterId = (contact?.source_ids as Record<string, unknown> | null)
    ?.recruiter_pipeline_id;

  if (typeof recruiterId === "string" && recruiterId) {
    await sbPublic.from("rr_contact_state").upsert(
      {
        contact_id: recruiterId,
        status: "dismissed",
        status_updated_at: new Date().toISOString(),
      },
      { onConflict: "contact_id" }
    );
  }

  await supabase.from("runner_artifacts").insert({
    runner_id: "triage",
    task_id: "contact_triage",
    schema_version: "v1",
    payload: {
      contact_id: input.contactId,
      card_id: input.cardId,
      action: "skipped_and_dismissed",
      recruiter_id: recruiterId ?? null,
      triaged_at: new Date().toISOString(),
    },
  });

  const skippedName =
    typeof contact?.name === "string" && contact.name.trim() ? contact.name.trim() : "Contact";
  await recordUserAction({
    verb: "Skipped",
    area: "Triage",
    subject: skippedName,
    targetTable: "contacts",
    targetId: input.contactId,
  });

  revalidatePath("/runner/triage");
  revalidatePath("/communications");
  return { ok: true };
}

export async function sendContactToTriage(input: {
  contactId: string;
  track?: Track;
}): Promise<ActionResult & { alreadyExists?: boolean }> {
  if (!hasSupabaseConfig()) {
    return { ok: false, error: "Supabase service role env vars are not configured." };
  }

  const supabase = createServiceRoleClient();
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id,name,title,vip,tracks")
    .eq("id", input.contactId)
    .maybeSingle();

  if (contactError) return { ok: false, error: contactError.message };
  if (!contact) return { ok: false, error: "Contact not found." };

  const { data: existingCards, error: existingError } = await supabase
    .from("cards")
    .select("id,state")
    .eq("module", "reconnect")
    .filter("linked_object_ids->>contact_id", "eq", input.contactId)
    .limit(20);

  if (existingError) return { ok: false, error: existingError.message };

  if (existingCards?.some((card) => card.state === "open")) {
    return { ok: true, alreadyExists: true };
  }

  const now = new Date().toISOString();
  const existing = existingCards?.[0];

  if (existing) {
    const { error: reopenError } = await supabase
      .from("cards")
      .update({ state: "open", updated_at: now })
      .eq("id", existing.id);

    if (reopenError) return { ok: false, error: reopenError.message };
  } else {
    const cardTrack = resolveCardTrack(input.track, contact.tracks);
    const verbs: Verb[] = ["draft", "snooze", "message"];
    const { error: insertError } = await supabase.from("cards").insert({
      track: cardTrack,
      module: "reconnect",
      object_type: "manual",
      title: contact.name,
      subtitle: contact.title,
      state: "open",
      vip: Boolean(contact.vip),
      priority_score: 0,
      verbs,
      linked_object_ids: { contact_id: input.contactId },
    });

    if (insertError) return { ok: false, error: insertError.message };
  }

  const { error: artifactError } = await supabase.from("runner_artifacts").insert({
    runner_id: "send_to_triage",
    task_id: "manual_add",
    schema_version: "v1",
    payload: {
      contact_id: input.contactId,
      track: input.track ?? null,
      action: existing ? "reopened" : "created",
      sent_at: now,
    },
  });

  if (artifactError) return { ok: false, error: artifactError.message };

  revalidatePath("/runner/triage");
  revalidatePath("/reconnect");
  revalidatePath("/contacts");
  return { ok: true };
}

async function getNextUntriagedCardAfterSkips(
  skipped: Set<string>,
  totalRemaining: number,
  track: TrackFilter
): Promise<UntriagedReconnectCard | null> {
  if (!hasSupabaseConfig()) return null;

  const supabase = createServiceRoleClient();
  let cardsQuery = supabase
    .from("cards")
    .select("id,title,subtitle,body,priority_score,linked_object_ids,track")
    .eq("module", "reconnect")
    .eq("state", "open")
    .order("priority_score", { ascending: false, nullsFirst: false });

  if (track) cardsQuery = cardsQuery.eq("track", track);
  const { data: cards, error: cardsError } = await cardsQuery.limit(50);

  if (cardsError || !cards?.length) {
    if (cardsError) console.error("[triage] fallback cards error", cardsError);
    return null;
  }

  const cardRows = cards
    .map((card) => {
      const contactId = getLinkedContactId(card.linked_object_ids);
      return contactId ? { ...card, contact_id: contactId } : null;
    })
    .filter((card): card is NonNullable<typeof card> => !!card && !skipped.has(card.contact_id));

  const contactIds = cardRows.map((card) => card.contact_id);
  if (!contactIds.length) return null;

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id,name,title,tags,intent,personal_goal,last_touch_date,company:companies(id,name)")
    .in("id", contactIds)
    .is("intent", null);

  if (contactsError || !contacts?.length) {
    if (contactsError) console.error("[triage] fallback contacts error", contactsError);
    return null;
  }

  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
  const card = cardRows.find((row) => contactsById.has(row.contact_id));
  if (!card) return null;

  const contact = contactsById.get(card.contact_id);
  const normalized = normalizeCard({
    card_id: card.id,
    contact_id: card.contact_id,
    title: card.title,
    subtitle: card.subtitle,
    body: card.body,
    priority_score: card.priority_score,
    contact_name: contact?.name,
    contact_title: contact?.title,
    contact_company: getCompanyName(contact?.company),
    contact_tags: contact?.tags,
    contact_track: card.track,
    current_intent: contact?.intent,
    current_goal: contact?.personal_goal,
    days_since_contact: getDaysSinceContact(contact?.last_touch_date),
    remaining_count: Math.max(totalRemaining - skipped.size, 1),
  });
  if (!normalized) return null;
  const firmContext = await getFirmContextForContact(normalized.contact_id);
  return { ...normalized, firm_context: firmContext };
}

// ---------------------------------------------------------------------------
// Firm context
// ---------------------------------------------------------------------------

export interface FirmContext {
  firm_name: string;
  total_at_firm: number;
  current_contact_practice: string | null;
  already_engaged: Array<{
    name: string;
    practice: string;
    status: string;
    last_action: string | null;
  }>;
  triaged_not_sent: Array<{
    name: string;
    practice: string;
    intent: string;
  }>;
  untriaged_count: number;
  practices_at_firm: string[];
  practices_already_covered: string[];
  strategic_hint: string;
}

export async function getFirmContextForContact(
  contactId: string
): Promise<FirmContext | null> {
  if (!hasSupabaseConfig()) return null;

  const sb = createServiceRoleClient();
  const sbPublic = createPublicServiceRoleClient();

  const { data: contact } = await sb
    .from("contacts")
    .select("source_ids,intent")
    .eq("id", contactId)
    .single();
  if (!contact) return null;

  const recruiterId = (contact.source_ids as Record<string, unknown> | null)
    ?.recruiter_pipeline_id;
  if (typeof recruiterId !== "string") return null;

  const { data: currentRr } = await sbPublic
    .from("rr_recruiters")
    .select("firm,firm_normalized,specialty")
    .eq("id", recruiterId)
    .single();
  if (!currentRr?.firm_normalized) return null;

  const firmNormalized = currentRr.firm_normalized as string;
  const currentPractice = (currentRr.specialty as string | null) ?? null;

  const { data: peers } = await sbPublic
    .from("rr_recruiters")
    .select("id,name,specialty,strategic_score")
    .eq("firm_normalized", firmNormalized)
    .neq("id", recruiterId)
    .order("strategic_score", { ascending: false, nullsFirst: false });

  if (!peers?.length) {
    return {
      firm_name: (currentRr.firm as string) ?? firmNormalized,
      total_at_firm: 1,
      current_contact_practice: currentPractice,
      already_engaged: [],
      triaged_not_sent: [],
      untriaged_count: 0,
      practices_at_firm: currentPractice ? [currentPractice] : [],
      practices_already_covered: [],
      strategic_hint:
        "Only contact at this firm in your pipeline — standalone decision.",
    };
  }

  const peerIds = peers.map((p) => p.id as string);

  const [statesRes, intentsRes] = await Promise.all([
    sbPublic
      .from("rr_contact_state")
      .select("contact_id,status,status_updated_at")
      .in("contact_id", peerIds),
    sb
      .from("contacts")
      .select("source_ids,intent")
      .not("intent", "is", null),
  ]);

  const statusByRrId = new Map<
    string,
    { status: string; updated_at: string | null }
  >();
  for (const s of statesRes.data ?? []) {
    statusByRrId.set(s.contact_id as string, {
      status: (s.status as string) ?? "queue",
      updated_at: (s.status_updated_at as string | null) ?? null,
    });
  }

  const intentByRrId = new Map<string, string>();
  for (const c of intentsRes.data ?? []) {
    const rrId = (c.source_ids as Record<string, unknown> | null)
      ?.recruiter_pipeline_id;
    if (typeof rrId === "string" && c.intent)
      intentByRrId.set(rrId, c.intent as string);
  }

  const alreadyEngaged: FirmContext["already_engaged"] = [];
  const triagedNotSent: FirmContext["triaged_not_sent"] = [];
  let untriagedCount = 0;
  const practicesAlreadyCovered = new Set<string>();
  const practicesAtFirm = new Set<string>();

  for (const peer of peers) {
    const id = peer.id as string;
    const name = (peer.name as string) ?? "Unknown";
    const practice = (peer.specialty as string | null) ?? "Unknown practice";
    const intent = intentByRrId.get(id);
    const stateInfo = statusByRrId.get(id);
    const status = stateInfo?.status ?? "queue";

    practicesAtFirm.add(practice);

    if (
      status === "sent" ||
      status === "replied" ||
      status === "in_conversation" ||
      status === "live_role"
    ) {
      alreadyEngaged.push({
        name,
        practice,
        status,
        last_action: stateInfo?.updated_at ?? null,
      });
      practicesAlreadyCovered.add(practice);
    } else if (intent) {
      triagedNotSent.push({ name, practice, intent });
    } else {
      untriagedCount += 1;
    }
  }

  if (currentPractice) practicesAtFirm.add(currentPractice);

  const hint = buildStrategicHint({
    currentPractice,
    practicesAlreadyCovered: [...practicesAlreadyCovered],
    alreadyEngagedCount: alreadyEngaged.length,
    triagedNotSentCount: triagedNotSent.length,
  });

  return {
    firm_name: (currentRr.firm as string) ?? firmNormalized,
    total_at_firm: peers.length + 1,
    current_contact_practice: currentPractice,
    already_engaged: alreadyEngaged,
    triaged_not_sent: triagedNotSent,
    untriaged_count: untriagedCount,
    practices_at_firm: [...practicesAtFirm],
    practices_already_covered: [...practicesAlreadyCovered],
    strategic_hint: hint,
  };
}

function buildStrategicHint(input: {
  currentPractice: string | null;
  practicesAlreadyCovered: string[];
  alreadyEngagedCount: number;
  triagedNotSentCount: number;
}): string {
  const { currentPractice, practicesAlreadyCovered, alreadyEngagedCount } =
    input;

  if (alreadyEngagedCount === 0) {
    return "No engaged peers at this firm — first entry point. Decide based on individual fit.";
  }
  if (
    currentPractice &&
    practicesAlreadyCovered.includes(currentPractice)
  ) {
    return `Practice "${currentPractice}" already covered by an engaged peer. Adding may signal scattershot — consider holding unless this person is materially better.`;
  }
  if (currentPractice) {
    return `New practice angle (${currentPractice}). Doesn't compete with engaged peers — recommend triage if individual fit is strong.`;
  }
  return `${alreadyEngagedCount} engaged peer${alreadyEngagedCount > 1 ? "s" : ""} at this firm. Practice unclear — judge on individual fit.`;
}

// ---------------------------------------------------------------------------

function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function emptyTrackCounts(): TriageTrackCounts {
  return {
    total: 0,
    by_track: {
      venture: 0,
      advisors: 0,
      job_search: 0,
      personal: 0,
    },
  };
}

function resolveCardTrack(inputTrack: Track | undefined, contactTracks: unknown): Track {
  if (inputTrack && TRACKS.includes(inputTrack)) return inputTrack;
  if (Array.isArray(contactTracks)) {
    const firstTrack = contactTracks.find((track): track is Track =>
      TRACKS.includes(track as Track)
    );
    if (firstTrack) return firstTrack;
  }
  return "advisors";
}

async function getOpenReconnectCardCount(
  supabase: ReturnType<typeof createServiceRoleClient>,
  track: TrackFilter
) {
  let query = supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("module", "reconnect")
    .eq("state", "open");

  if (track) query = query.eq("track", track);
  const { count, error } = await query;
  if (error) {
    console.error("[triage] getOpenReconnectCardCount fallback error", error);
    return 0;
  }
  return count ?? 0;
}

async function getOpenReconnectCountsByTrack(
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<TriageTrackCounts> {
  const counts = emptyTrackCounts();
  const { data, error } = await supabase
    .from("cards")
    .select("track")
    .eq("module", "reconnect")
    .eq("state", "open");

  if (error) {
    console.error("[triage] getOpenReconnectCountsByTrack fallback error", error);
    return counts;
  }

  for (const row of (data ?? []) as Array<{ track: Track | null }>) {
    if (!row.track || !TRACKS.includes(row.track)) continue;
    counts.by_track[row.track] += 1;
    counts.total += 1;
  }
  return counts;
}

function getLinkedContactId(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const contactId = (value as { contact_id?: unknown }).contact_id;
  return typeof contactId === "string" ? contactId : null;
}

function normalizeCard(row: unknown): UntriagedReconnectCard | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  const contactId = value.contact_id;
  const cardId = value.card_id;
  const contactName = value.contact_name;

  if (
    typeof contactId !== "string" ||
    typeof cardId !== "string" ||
    typeof contactName !== "string"
  ) {
    return null;
  }

  return {
    card_id: cardId,
    contact_id: contactId,
    title: typeof value.title === "string" ? value.title : contactName,
    subtitle: typeof value.subtitle === "string" ? value.subtitle : null,
    body: normalizeReconnectCardBody(value.body),
    priority_score:
      typeof value.priority_score === "number" ? value.priority_score : null,
    contact_name: contactName,
    contact_title:
      typeof value.contact_title === "string" ? value.contact_title : null,
    contact_company:
      typeof value.contact_company === "string"
        ? value.contact_company
        : getFirmFromTags(value.contact_tags),
    company_missing: typeof value.contact_company !== "string",
    contact_tags: getStringArray(value.contact_tags),
    contact_track: isTrack(value.contact_track) ? value.contact_track : null,
    current_intent: isIntent(value.current_intent) ? value.current_intent : null,
    current_goal: typeof value.current_goal === "string" ? value.current_goal : null,
    days_since_contact:
      typeof value.days_since_contact === "number" ? value.days_since_contact : null,
    remaining_count:
      typeof value.remaining_count === "number" ? value.remaining_count : 0,
    firm_context: null,
  };
}

function normalizeReconnectCardBody(value: unknown): ReconnectCardBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as ReconnectCardBody;
}

function getDaysSinceContact(value: unknown) {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  const now = new Date();
  const then = new Date(timestamp);
  return Math.max(
    0,
    Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(then.getFullYear(), then.getMonth(), then.getDate())) /
      86_400_000)
  );
}

function getCompanyName(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const name = (value as { name?: unknown }).name;
  return typeof name === "string" && name.trim() ? name : null;
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getFirmFromTags(value: unknown) {
  const firmTag = getStringArray(value).find((tag) =>
    tag.trim().toLowerCase().startsWith("firm:")
  );
  if (!firmTag) return null;
  const firm = firmTag.slice(firmTag.indexOf(":") + 1).trim();
  return firm || null;
}

function isTrack(value: unknown): value is Track {
  return (
    value === "venture" ||
    value === "advisors" ||
    value === "job_search" ||
    value === "personal"
  );
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
