// Server-only data layer for the Browning module.
// Reads from jasonos.browning_* tables + jasonos.contacts (Browning-tagged)
// + jasonos.contact_touches (for the unscored backstop). Returns parsed,
// typed shapes ready for Server Components and the home dashboard card.

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { fridayOfWeek, firstOfMonth } from "@/lib/browning/format";
import type {
  BrowningConversation,
  BrowningContactRow,
  BrowningDeliverable,
  BrowningGate,
  BrowningGateStatus,
  BrowningSource,
  BrowningSummary,
  BrowningTier,
  BrowningWeeklyKpi,
  UnscoredTouch,
  ThankYouStatus,
  BrowningChannel,
  BrowningDeliveredStatus,
} from "@/lib/browning/types";
import { BROWNING_WEEKLY_TARGET } from "@/lib/browning/types";

function hasServiceRole() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// ---------------------------------------------------------------------------
// Row → shape mappers
// ---------------------------------------------------------------------------

interface ConversationRow {
  id: string;
  contact_id: string;
  linked_touch_id: string | null;
  conversation_date: string;
  channel: string;
  duration_min: number | null;
  warmth: number;
  patience: number;
  advice_mode: number;
  two_referral_ask: number;
  reciprocity: number;
  referrals_received: number | null;
  thank_you_sent: string;
  what_was_hard: string | null;
  what_to_do_differently: string | null;
  produced_lead: boolean | null;
  avg_quality: number | string;
  scored_at: string;
}

function mapConversation(row: ConversationRow): BrowningConversation {
  return {
    id: row.id,
    contact_id: row.contact_id,
    linked_touch_id: row.linked_touch_id,
    conversation_date: row.conversation_date,
    channel: row.channel as BrowningChannel,
    duration_min: row.duration_min,
    warmth: row.warmth,
    patience: row.patience,
    advice_mode: row.advice_mode,
    two_referral_ask: row.two_referral_ask,
    reciprocity: row.reciprocity,
    referrals_received: row.referrals_received ?? 0,
    thank_you_sent: row.thank_you_sent as ThankYouStatus,
    what_was_hard: row.what_was_hard,
    what_to_do_differently: row.what_to_do_differently,
    produced_lead: Boolean(row.produced_lead),
    avg_quality:
      typeof row.avg_quality === "string"
        ? Number(row.avg_quality)
        : row.avg_quality,
    scored_at: row.scored_at,
  };
}

interface GateRow {
  gate_code: string;
  step_number: number;
  description: string;
  browning_sla: string | null;
  target_date: string | null;
  completed_date: string | null;
  status: string;
  notes: string | null;
  updated_at: string;
}

function mapGate(row: GateRow): BrowningGate {
  return {
    gate_code: row.gate_code,
    step_number: row.step_number,
    description: row.description,
    browning_sla: row.browning_sla,
    target_date: row.target_date,
    completed_date: row.completed_date,
    status: row.status as BrowningGateStatus,
    notes: row.notes,
    updated_at: row.updated_at,
  };
}

interface DeliverableRow {
  id: string;
  month: string;
  promised: string;
  delivered_status: string | null;
  on_time: boolean | null;
  quality: number | null;
  notes: string | null;
  escalate: boolean | null;
  inserted_at?: string;
}

function mapDeliverable(row: DeliverableRow): BrowningDeliverable {
  return {
    id: row.id,
    month: row.month,
    promised: row.promised,
    delivered_status:
      (row.delivered_status as BrowningDeliveredStatus | null) ?? null,
    on_time: row.on_time ?? null,
    quality: row.quality ?? null,
    notes: row.notes,
    escalate: Boolean(row.escalate),
    inserted_at: row.inserted_at,
  };
}

interface KpiRow {
  week_ending_friday: string;
  conversations_count: number | string;
  avg_warmth: number | string | null;
  avg_quality_overall: number | string | null;
  referrals_received_total: number | string | null;
  thank_yous_sent_count: number | string | null;
  leads_produced_count: number | string | null;
}

function mapKpi(row: KpiRow): BrowningWeeklyKpi {
  const num = (v: number | string | null | undefined): number | null => {
    if (v === null || v === undefined) return null;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : null;
  };
  return {
    week_ending_friday: row.week_ending_friday,
    conversations_count: Number(row.conversations_count) || 0,
    avg_warmth: num(row.avg_warmth),
    avg_quality_overall: num(row.avg_quality_overall),
    referrals_received_total: Number(row.referrals_received_total ?? 0) || 0,
    thank_yous_sent_count: Number(row.thank_yous_sent_count ?? 0) || 0,
    leads_produced_count: Number(row.leads_produced_count ?? 0) || 0,
  };
}

// ---------------------------------------------------------------------------
// Public read functions
// ---------------------------------------------------------------------------

/**
 * All 11 gates ordered by (step_number, gate_code). Returns the migration's
 * seed values when the table is freshly seeded.
 */
export async function getBrowningGates(): Promise<BrowningGate[]> {
  if (!hasServiceRole()) return [];
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("browning_gates")
    .select(
      "gate_code,step_number,description,browning_sla,target_date,completed_date,status,notes,updated_at"
    )
    .order("step_number", { ascending: true })
    .order("gate_code", { ascending: true });
  if (error) {
    console.error("[browning.getBrowningGates]", error);
    return [];
  }
  return (data ?? []).map((row) => mapGate(row as GateRow));
}

/**
 * Last N weeks from the browning_weekly_kpis view, newest first.
 */
export async function getWeeklyKpis(weeksBack = 12): Promise<BrowningWeeklyKpi[]> {
  if (!hasServiceRole()) return [];
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("browning_weekly_kpis")
    .select(
      "week_ending_friday,conversations_count,avg_warmth,avg_quality_overall,referrals_received_total,thank_yous_sent_count,leads_produced_count"
    )
    .order("week_ending_friday", { ascending: false })
    .limit(weeksBack);
  if (error) {
    console.error("[browning.getWeeklyKpis]", error);
    return [];
  }
  return (data ?? []).map((row) => mapKpi(row as KpiRow));
}

/**
 * All scored conversations for one contact, descending by date.
 */
export async function getBrowningConversationsForContact(
  contactId: string
): Promise<BrowningConversation[]> {
  if (!hasServiceRole() || !contactId) return [];
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("browning_conversations")
    .select(
      "id,contact_id,linked_touch_id,conversation_date,channel,duration_min,warmth,patience,advice_mode,two_referral_ask,reciprocity,referrals_received,thank_you_sent,what_was_hard,what_to_do_differently,produced_lead,avg_quality,scored_at"
    )
    .eq("contact_id", contactId)
    .order("conversation_date", { ascending: false });
  if (error) {
    console.error("[browning.getBrowningConversationsForContact]", error);
    return [];
  }
  return (data ?? []).map((r) => mapConversation(r as ConversationRow));
}

/**
 * Monthly deliverables, newest month first.
 */
export async function getBrowningDeliverables(
  monthsBack = 6
): Promise<BrowningDeliverable[]> {
  if (!hasServiceRole()) return [];
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("browning_deliverables")
    .select(
      "id,month,promised,delivered_status,on_time,quality,notes,escalate,inserted_at"
    )
    .order("month", { ascending: false })
    .order("inserted_at", { ascending: false })
    .limit(monthsBack * 8); // generous — multiple promises per month
  if (error) {
    console.error("[browning.getBrowningDeliverables]", error);
    return [];
  }
  return (data ?? []).map((r) => mapDeliverable(r as DeliverableRow));
}

/**
 * Touches >24h old on Browning-tagged contacts that have no matching
 * browning_conversations.linked_touch_id row. Drives the "score now" backstop
 * modal and the home-card red banner.
 */
export async function getUnscoredTouches(): Promise<UnscoredTouch[]> {
  if (!hasServiceRole()) return [];
  const sb = createServiceRoleClient();

  // 1. Pull Browning-tagged contacts (id + name).
  const { data: browningContacts, error: cErr } = await sb
    .from("contacts")
    .select("id, name")
    .not("browning_source", "is", null);
  if (cErr) {
    console.error("[browning.getUnscoredTouches.contacts]", cErr);
    return [];
  }
  const contactById = new Map<string, string>();
  for (const c of browningContacts ?? []) {
    contactById.set(c.id as string, (c.name as string) ?? "Unnamed");
  }
  if (!contactById.size) return [];

  const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 2. Touches on those contacts older than 24h.
  const contactIds = Array.from(contactById.keys());
  const { data: touches, error: tErr } = await sb
    .from("contact_touches")
    .select("id, contact_id, channel, touched_at")
    .in("contact_id", contactIds)
    .lte("touched_at", cutoffIso)
    .order("touched_at", { ascending: false })
    .limit(200);
  if (tErr) {
    console.error("[browning.getUnscoredTouches.touches]", tErr);
    return [];
  }
  if (!touches?.length) return [];

  // 3. Find which of those touch ids already have a conversation row.
  const touchIds = touches.map((t) => t.id as string);
  const { data: scored } = await sb
    .from("browning_conversations")
    .select("linked_touch_id")
    .in("linked_touch_id", touchIds);
  const scoredSet = new Set<string>(
    (scored ?? [])
      .map((s) => s.linked_touch_id as string | null)
      .filter((v): v is string => Boolean(v))
  );

  return touches
    .filter((t) => !scoredSet.has(t.id as string))
    .map((t) => ({
      touch_id: t.id as string,
      contact_id: t.contact_id as string,
      contact_name: contactById.get(t.contact_id as string) ?? "Unnamed",
      touched_at: t.touched_at as string,
      channel: (t.channel as string | null) ?? "other",
    }));
}

/**
 * All Browning-tagged contacts joined with their last touch + conversation
 * aggregates. Ordered for the Pipeline tab: tier asc (1 first), then most
 * recently touched, then alphabetical.
 */
export async function getBrowningContacts(): Promise<BrowningContactRow[]> {
  if (!hasServiceRole()) return [];
  const sb = createServiceRoleClient();

  const { data: contacts, error } = await sb
    .from("contacts")
    .select(
      "id, name, title, tags, intent, browning_source, browning_tier, last_touch_date, source_ids"
    )
    .not("browning_source", "is", null)
    .order("name", { ascending: true });
  if (error) {
    console.error("[browning.getBrowningContacts]", error);
    return [];
  }
  if (!contacts?.length) return [];

  const ids = contacts.map((c) => c.id as string);

  // Aggregate conversation stats in one fetch.
  const { data: convRows } = await sb
    .from("browning_conversations")
    .select("contact_id, warmth, avg_quality")
    .in("contact_id", ids);
  const stats = new Map<
    string,
    { count: number; warmthSum: number; qualitySum: number }
  >();
  for (const row of (convRows ?? []) as Array<{
    contact_id: string;
    warmth: number;
    avg_quality: number | string;
  }>) {
    const cur = stats.get(row.contact_id) ?? {
      count: 0,
      warmthSum: 0,
      qualitySum: 0,
    };
    cur.count += 1;
    cur.warmthSum += Number(row.warmth) || 0;
    cur.qualitySum +=
      typeof row.avg_quality === "string"
        ? Number(row.avg_quality)
        : row.avg_quality;
    stats.set(row.contact_id, cur);
  }

  // Latest open cadence card draft per contact. The Pipeline panel only
  // needs a boolean (the dialog fetches the full draft on demand). Pull all
  // open reconnect cards in one go and filter by contact_id in JS — the
  // PostgREST `.in('linked_object_ids->>contact_id', ids)` filter is
  // brittle on JSONB-extracted text and the data volume is tiny.
  const hasDraftByContact = new Map<string, boolean>();
  const { data: draftCards } = await sb
    .from("cards")
    .select("linked_object_ids, body, pinned_at, created_at")
    .eq("module", "reconnect")
    .eq("object_type", "cadence_contact")
    .eq("state", "open")
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  const idSet = new Set(ids);
  for (const card of (draftCards ?? []) as Array<{
    linked_object_ids: Record<string, unknown> | null;
    body: Record<string, unknown> | null;
  }>) {
    const linked = card.linked_object_ids ?? {};
    const contactId =
      typeof linked.contact_id === "string" ? linked.contact_id : null;
    if (!contactId || !idSet.has(contactId)) continue;
    if (hasDraftByContact.has(contactId)) continue;
    const draftMessage = card.body?.draft_message;
    hasDraftByContact.set(
      contactId,
      typeof draftMessage === "string" && draftMessage.trim().length > 0
    );
  }

  // Most-recent touch per contact (we already have last_touch_date as a YYYY-MM-DD,
  // but we want a precise timestamp for "stalled" detection).
  const { data: touchRows } = await sb
    .from("contact_touches")
    .select("contact_id, touched_at")
    .in("contact_id", ids)
    .order("touched_at", { ascending: false })
    .limit(ids.length * 5);
  const lastTouchAt = new Map<string, string>();
  for (const row of (touchRows ?? []) as Array<{
    contact_id: string;
    touched_at: string;
  }>) {
    if (!lastTouchAt.has(row.contact_id)) {
      lastTouchAt.set(row.contact_id, row.touched_at);
    }
  }

  const rows: BrowningContactRow[] = contacts.map((c) => {
    const id = c.id as string;
    const tags = (c.tags as string[] | null) ?? [];
    const company =
      tags
        .find((t) => t.startsWith("firm:"))
        ?.slice("firm:".length)
        .replace(/-/g, " ") ?? null;
    const stat = stats.get(id);
    const last =
      lastTouchAt.get(id) ??
      (c.last_touch_date
        ? new Date(`${c.last_touch_date}T00:00:00`).toISOString()
        : null);
    return {
      contact_id: id,
      name: (c.name as string) ?? "Unnamed",
      title: (c.title as string | null) ?? null,
      company,
      browning_source: c.browning_source as BrowningSource,
      browning_tier: (c.browning_tier as BrowningTier | null) ?? null,
      intent: (c.intent as string | null) ?? null,
      last_touch_at: last,
      conversations_count: stat?.count ?? 0,
      avg_warmth: stat && stat.count ? stat.warmthSum / stat.count : null,
      avg_quality_overall:
        stat && stat.count ? stat.qualitySum / stat.count : null,
      has_draft: hasDraftByContact.get(id) ?? false,
    };
  });

  rows.sort((a, b) => {
    const at = a.browning_tier ?? Number.MAX_SAFE_INTEGER;
    const bt = b.browning_tier ?? Number.MAX_SAFE_INTEGER;
    if (at !== bt) return at - bt;
    if (a.last_touch_at && b.last_touch_at) {
      return b.last_touch_at.localeCompare(a.last_touch_at);
    }
    if (a.last_touch_at && !b.last_touch_at) return -1;
    if (!a.last_touch_at && b.last_touch_at) return 1;
    return a.name.localeCompare(b.name);
  });

  return rows;
}

/**
 * Home-card payload. Cheap to call — used both on /browning and the home
 * dashboard server component.
 */
export async function getBrowningSummary(): Promise<BrowningSummary> {
  if (!hasServiceRole()) {
    return {
      weekly: null,
      prior_weekly: null,
      next_gate: null,
      unscored_count: 0,
      pending_deliverables: [],
      weekly_target: BROWNING_WEEKLY_TARGET,
    };
  }

  const [kpis, gates, unscored, deliverables] = await Promise.all([
    getWeeklyKpis(2),
    getBrowningGates(),
    getUnscoredTouches(),
    getBrowningDeliverables(2),
  ]);

  const thisFriday = fridayOfWeek();
  const weekly = kpis.find((k) => k.week_ending_friday === thisFriday) ?? null;
  const prior_weekly =
    kpis.find((k) => k.week_ending_friday !== thisFriday) ?? null;

  const next_gate =
    gates.find((g) => g.status !== "completed") ?? null;

  const monthStart = firstOfMonth();
  const pending_deliverables = deliverables.filter(
    (d) =>
      d.month === monthStart &&
      (d.delivered_status === null || d.delivered_status === "partial")
  );

  return {
    weekly,
    prior_weekly,
    next_gate,
    unscored_count: unscored.length,
    pending_deliverables,
    weekly_target: BROWNING_WEEKLY_TARGET,
  };
}
