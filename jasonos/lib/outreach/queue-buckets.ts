// Three-column Outreach Queue bucketing.
//
// Centralizes the predicate + precedence logic that splits every contact
// the user is currently working with into one of three intent-based
// columns: Warm (cadence maintenance), Specific (active follow-up), or
// Cold (cold outreach in flight).
//
// Cold requires an explicit signal — either the user pinned `intent='cold'`
// on the contact, or an active First-Contact Sequence stage exists on the
// linked recruiter pipeline row. New contacts never land in Cold by
// derivation; they stay off the queue until the user classifies them.
//
// Backrow is the explicit opt-out signal (migration 0019). When the user
// sets `intent='backrow'` on a contact, the contact is kept in
// jasonos.contacts (still visible on /outreach/people with a Backrow
// badge) but is REMOVED from the queue entirely — no column. The backrow
// guard runs BEFORE any other classification logic, so it overrides
// recent inbound touches, an active first-contact sequence, cadence
// windows, and every other Specific/Cold/Warm trigger.
//
// Precedence (mutually exclusive):
//   Backrow  → first; if set, classify() short-circuits and returns null.
//              The contact does not appear in any column.
//   Cold     → wins next; explicit intent pin or an active First-Contact
//              Sequence stage.
//   Specific → next; recent inbound, an outcome on the latest touch, or a
//              triage intent paired with a sent/replied/in-conversation
//              recruiter status.
//   Warm     → last; cadence is set, the relationship has graduated past
//              the initial-touch stage, no active cold sequence, and the
//              next-touch date falls inside the seven-day actionable window.
//
// The client component (three-column-queue-client.tsx) just renders the
// pre-computed buckets — no classification logic on the client.
//
// NOTE: The spec calls out a few stages that don't exist verbatim in this
// codebase (`first_message_drafted`, `first_message_sent`, `researched`,
// recruiter status `sent_awaiting_reply`). We map them to the closest
// canonical values:
//   first_message_sent       → connect_sent / dm_sent / email_sent
//   first_message_drafted    → identified (no separate "drafted" state today)
//   researched               → identified
//   sent_awaiting_reply      → recruiter status "sent"
// Any caveats discovered at run time should be surfaced in the UI rather
// than fudged silently.

import "server-only";

import {
  getOutreachPeople,
  type OutreachPerson,
} from "@/lib/outreach/data";
import { getReconnectDashboardData } from "@/lib/reconnect/data";
import type { ReconnectContact } from "@/lib/reconnect/types";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { FirstContactStage } from "@/lib/first-contact/types";
import type {
  CadenceInterval,
  CadenceStage,
  ContactIntent,
  RelationshipType,
  RelevanceTier,
  NetworkDegree,
} from "@/lib/outreach/types";

export type QueueColumnKey =
  | "network_growth"
  | "network_maintenance"
  | "browning_cold";

export interface QueueCard {
  /** Stable React key. Prefers the jasonos.contacts.id when available; else
   *  falls back to the recruiter-pipeline id (rr_recruiters.id). */
  key: string;
  column: QueueColumnKey;

  // ---- Display ----
  name: string;
  title: string | null;
  firm: string | null;
  vip: boolean;
  relationship_type: RelationshipType | null;
  relevance_tier: RelevanceTier | null;
  network_degree: NetworkDegree | null;
  primary_email: string | null;
  linkedin_url: string | null;

  // ---- Cadence / dates ----
  cadence_interval: CadenceInterval;
  cadence_stage: CadenceStage | null;
  next_touch_date: string | null;
  last_touch_date: string | null;

  // ---- Column-specific surface bits ----
  /** One-line "why this card is here" hint shown under the firm. */
  reason: string;
  /** Pretty stage label for Cold (null for the other columns). */
  sequenceStageLabel: string | null;

  // ---- Modal payload ----
  /** Canonical jasonos.contacts.id when a row exists. Null for orphan
   *  recruiter rows (rr_recruiters with no contacts mapping yet). */
  contactId: string | null;
  /** rr_recruiters.id when this contact has a recruiter pipeline link. */
  recruiterId: string | null;
}

export interface ThreeColumnQueue {
  network_growth: QueueCard[];
  network_maintenance: QueueCard[];
  browning_cold: QueueCard[];
  /** Full reconnect list — passed through so the client can hand it to the
   *  RecruiterPipelinePanel for "other contacts at firm" lookups and to
   *  power its local-state mutations when a recruiter card is open. */
  reconnectContacts: ReconnectContact[];
  /** Outreach people indexed by id; the client uses this to materialize
   *  OutreachModal contact props without re-fetching. */
  outreachPeople: OutreachPerson[];
  /** Caveats surfaced while bucketing (e.g. missing column we couldn't
   *  query). Rendered as a small notice in the UI when non-empty. */
  caveats: string[];
}

// Stages where a First-Contact Sequence is still active — these belong in Cold.
const ACTIVE_COLD_STAGES: FirstContactStage[] = [
  "identified",
  "connect_sent",
  "connect_accepted",
  "dm_sent",
  "email_sent",
];

// Stages that mean "they responded" — Cold no longer owns them; Specific does.
const RESPONDED_STAGES: FirstContactStage[] = [
  "dm_replied",
  "email_replied",
  "meeting_scheduled",
];

// Recruiter pipeline statuses that mean "we're mid-conversation" — paired
// with a triage intent these qualify for Specific.
const ACTIVE_PIPELINE_STATUSES = new Set([
  "sent",
  "replied",
  "in_conversation",
]);

// Stage progress rank used to sort the Cold column — higher = further along.
const COLD_STAGE_PROGRESS: Record<FirstContactStage, number> = {
  identified: 0,
  connect_sent: 1,
  connect_accepted: 2,
  dm_sent: 3,
  email_sent: 4,
  // Stages below here are not "Cold" — they fall through to Specific.
  dm_replied: 5,
  email_replied: 5,
  meeting_scheduled: 5,
  completed: 5,
  closed_no_response: 5,
};

const STAGE_LABEL: Record<FirstContactStage, string> = {
  identified: "Identified",
  connect_sent: "Connect sent",
  connect_accepted: "Accepted",
  dm_sent: "DM sent",
  dm_replied: "DM replied",
  email_sent: "Email sent",
  email_replied: "Email replied",
  meeting_scheduled: "Meeting scheduled",
  completed: "Completed",
  closed_no_response: "Closed",
};

interface TouchSignal {
  /** Was an inbound touch logged in the last 30 days? */
  hasInboundLast30: boolean;
  /** Newest inbound touch timestamp seen in our window. */
  mostRecentInboundAt: string | null;
  /** Newest outbound touch with a non-empty `outcome` field. */
  mostRecentOutboundOutcomeAt: string | null;
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export async function getThreeColumnQueue(): Promise<ThreeColumnQueue> {
  const caveats: string[] = [];
  const [people, dashboard, contactRpidMap, touchSignals] = await Promise.all([
    getOutreachPeople(),
    getReconnectDashboardData(),
    loadContactRecruiterMap(caveats),
    loadTouchSignals(caveats),
  ]);

  const reconnectContacts = dashboard.contacts;
  const reconnectByRecruiterId = new Map(
    reconnectContacts.map((c) => [c.id, c] as const)
  );

  const today = startOfToday();
  const sevenDaysOut = new Date(today);
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

  const cards: QueueCard[] = [];
  const consumedReconnectIds = new Set<string>();

  // ---- Pass 1: every OutreachPerson becomes a candidate card. ------------
  for (const person of people) {
    const rpid = contactRpidMap.get(person.id) ?? null;
    // Two ways a reconnect row links: by rr_recruiters.id (pipeline rows) or
    // by jasonos.contacts.id (cold targets, whose ReconnectContact.id == the
    // contact id).
    const reconnect =
      (rpid ? reconnectByRecruiterId.get(rpid) : null) ??
      reconnectByRecruiterId.get(person.id) ??
      null;
    if (reconnect) consumedReconnectIds.add(reconnect.id);

    const signal = touchSignals.get(person.id) ?? null;
    const card = classify(person, reconnect, signal, rpid, today, sevenDaysOut);
    if (card) cards.push(card);
  }

  // ---- Pass 2: surface reconnect rows that have no OutreachPerson. -------
  // These are usually pure rr_recruiters rows where no jasonos.contacts row
  // has been created yet. They can still appear in Cold (active sequence)
  // or Specific (intent + active pipeline status).
  for (const r of reconnectContacts) {
    if (consumedReconnectIds.has(r.id)) continue;
    const card = classifyReconnectOnly(r, today);
    if (card) cards.push(card);
  }

  const network_growth: QueueCard[] = [];
  const network_maintenance: QueueCard[] = [];
  const browning_cold: QueueCard[] = [];
  for (const c of cards) {
    if (c.column === "network_growth") network_growth.push(c);
    else if (c.column === "network_maintenance") network_maintenance.push(c);
    else browning_cold.push(c);
  }

  network_growth.sort(bySpecificOrder);
  network_maintenance.sort(byWarmOrder);
  browning_cold.sort(byColdOrder);

  return {
    network_growth,
    network_maintenance,
    browning_cold,
    reconnectContacts,
    outreachPeople: people,
    caveats,
  };
}

// ---------------------------------------------------------------------------
// Classification — applies precedence Cold > Specific > Warm
// ---------------------------------------------------------------------------

function classify(
  person: OutreachPerson,
  reconnect: ReconnectContact | null,
  signal: TouchSignal | null,
  recruiterPipelineId: string | null,
  today: Date,
  sevenDaysOut: Date
): QueueCard | null {
  // ---- Backrow short-circuit (migration 0019). Explicit user opt-out:
  // keep the contact in jasonos.contacts but exclude it from every queue
  // column regardless of cadence, touches, sequence stage, etc.
  if (person.intent === "backrow") return null;

  const stage = reconnect?.first_contact?.stage ?? null;
  const isActiveCold = stage ? ACTIVE_COLD_STAGES.includes(stage) : false;
  const hasResponded = stage ? RESPONDED_STAGES.includes(stage) : false;

  // ---- Explicit intent wins over derivation (migration 0017). When the
  // user has pinned this contact to a column, the column is fixed; we only
  // pick the most informative reason / stage label we can. 'backrow' is
  // excluded above, so person.intent here is one of the three primary buckets.
  if (person.intent) {
    const pinned = person.intent;
    return makeCard(person, reconnect, recruiterPipelineId, {
      column: pinned,
      reason: pinnedReason(pinned),
      sequenceStageLabel:
        pinned === "browning_cold" ? STAGE_LABEL[stage ?? "identified"] : null,
    });
  }

  // ---- Cold ----
  // Cold requires an explicit signal: an active First-Contact Sequence
  // stage on the linked pipeline row. The user pins `intent='cold'`
  // separately above; there is no derivation from relationship_type +
  // cadence + lack of touches.
  if (isActiveCold && stage) {
    return makeCard(person, reconnect, recruiterPipelineId, {
      column: "browning_cold",
      reason: coldReason(stage),
      sequenceStageLabel: STAGE_LABEL[stage],
    });
  }

  // ---- Specific ----
  // Recent inbound, outbound-with-outcome, or triage intent + active recruiter
  // status all qualify. A "responded" first-contact stage also qualifies (the
  // sequence advanced past the cold portion).
  const inboundAt = signal?.mostRecentInboundAt ?? null;
  const outboundOutcomeAt = signal?.mostRecentOutboundOutcomeAt ?? null;
  const recruiterIntentActive =
    !!reconnect?.intent &&
    ACTIVE_PIPELINE_STATUSES.has(reconnect.state.status);
  const reconnectInbound = reconnect
    ? mostRecentInboundFromReconnect(reconnect)
    : null;
  const lastReconnectInbound =
    reconnectInbound && inboundsRecent(reconnectInbound, today)
      ? reconnectInbound
      : null;

  const specificTrigger =
    signal?.hasInboundLast30 ||
    !!outboundOutcomeAt ||
    recruiterIntentActive ||
    hasResponded ||
    !!lastReconnectInbound;

  if (specificTrigger) {
    return makeCard(person, reconnect, recruiterPipelineId, {
      column: "network_growth",
      reason: specificReason({
        signal,
        reconnect,
        hasResponded,
        lastReconnectInboundAt: lastReconnectInbound,
        recruiterIntentActive,
      }),
      sequenceStageLabel: null,
      sortAnchor: pickNewest([
        inboundAt,
        outboundOutcomeAt,
        hasResponded ? lastReconnectStageEventAt(reconnect) : null,
        lastReconnectInbound,
        recruiterIntentActive ? reconnect?.state.updated_at ?? null : null,
      ]),
    });
  }

  // ---- Warm ----
  const warmEligible =
    person.cadence_interval !== "none" &&
    (person.cadence_stage === "followup_2" ||
      person.cadence_stage === "ongoing");
  if (!warmEligible) return null;
  // No active cold sequence already handled above — but double-check.
  if (isActiveCold) return null;
  if (!person.next_touch_date) return null;
  const ntd = parseDateOnly(person.next_touch_date);
  if (ntd > sevenDaysOut) return null;

  return makeCard(person, reconnect, recruiterPipelineId, {
    column: "network_maintenance",
    reason: warmReason(ntd, today),
    sequenceStageLabel: null,
  });
}

function classifyReconnectOnly(
  r: ReconnectContact,
  today: Date
): QueueCard | null {
  // ---- Backrow short-circuit (migration 0019). Pure-recruiter rows that
  // get here have no linked jasonos.contacts row, so they can't carry a
  // 'backrow' value today; this guard is defensive so backrow remains the
  // universal opt-out even if a pure-recruiter surface ever gains the
  // intent column.
  if ((r as { intent?: unknown }).intent === "backrow") return null;

  const stage = r.first_contact?.stage ?? null;
  if (stage && ACTIVE_COLD_STAGES.includes(stage)) {
    return makeCardFromReconnect(r, {
      column: "browning_cold",
      reason: coldReason(stage),
      sequenceStageLabel: STAGE_LABEL[stage],
    });
  }

  const inbound = mostRecentInboundFromReconnect(r);
  const recentInbound = inbound && inboundsRecent(inbound, today) ? inbound : null;
  const recruiterIntentActive =
    !!r.intent && ACTIVE_PIPELINE_STATUSES.has(r.state.status);
  const hasResponded = stage ? RESPONDED_STAGES.includes(stage) : false;

  if (recentInbound || recruiterIntentActive || hasResponded) {
    return makeCardFromReconnect(r, {
      column: "network_growth",
      reason: specificReason({
        signal: null,
        reconnect: r,
        hasResponded,
        lastReconnectInboundAt: recentInbound,
        recruiterIntentActive,
      }),
      sequenceStageLabel: null,
      sortAnchor: pickNewest([
        recentInbound,
        hasResponded ? lastReconnectStageEventAt(r) : null,
        recruiterIntentActive ? r.state.updated_at : null,
      ]),
    });
  }

  // Pure-recruiter rows without a sequence and without a Specific signal
  // don't belong on the queue — they live in /reconnect/contacts (the
  // legacy "Full pipeline" view).
  return null;
}

// ---------------------------------------------------------------------------
// Card builders
// ---------------------------------------------------------------------------

interface ColumnAttrs {
  column: QueueColumnKey;
  reason: string;
  sequenceStageLabel: string | null;
  sortAnchor?: string | null;
}

function makeCard(
  person: OutreachPerson,
  reconnect: ReconnectContact | null,
  recruiterPipelineId: string | null,
  attrs: ColumnAttrs
): QueueCard {
  const card: QueueCard = {
    key: person.id,
    column: attrs.column,
    name: person.name,
    title: person.title,
    firm: person.firm ?? reconnect?.firm ?? null,
    vip: person.vip,
    relationship_type: person.relationship_type,
    relevance_tier: person.relevance_tier,
    network_degree: person.network_degree,
    primary_email: person.primary_email,
    linkedin_url: person.linkedin_url ?? reconnect?.linkedin_url ?? null,
    cadence_interval: person.cadence_interval,
    cadence_stage: person.cadence_stage,
    next_touch_date: person.next_touch_date,
    last_touch_date: person.last_touch_date,
    reason: attrs.reason,
    sequenceStageLabel: attrs.sequenceStageLabel,
    contactId: person.id,
    // Only set `recruiterId` when we have a true rr_recruiters.id. Cold-target
    // reconnect rows are keyed by jasonos.contacts.id, NOT rr_recruiters.id —
    // assigning reconnect.id here would cause ensureContactForRecruiter to
    // look up a non-existent rr_recruiters row and bail with "Pipeline row
    // not found". The bucketing match still uses `reconnect` for firm/title
    // enrichment above; it just doesn't leak into recruiterId.
    recruiterId: recruiterPipelineId ?? null,
  };
  attachSortAnchor(card, attrs.sortAnchor ?? null);
  return card;
}

function makeCardFromReconnect(
  r: ReconnectContact,
  attrs: ColumnAttrs
): QueueCard {
  // NOTE: rr_recruiters is legacy naming — it backs ANY first-contact /
  // cold-outreach pipeline row, not literally recruiters. We leave
  // relationship_type unset (null) here so the card doesn't falsely tag
  // these contacts as recruiters in the UI; the real classification gets
  // populated the moment the contact is linked via
  // ensureContactForRecruiter.
  const card: QueueCard = {
    key: r.id,
    column: attrs.column,
    name: r.name,
    title: r.title ?? null,
    firm: r.firm ?? null,
    vip: false,
    relationship_type: null,
    relevance_tier: null,
    network_degree: null,
    primary_email: null,
    linkedin_url: r.linkedin_url ?? null,
    cadence_interval: "none",
    cadence_stage: null,
    next_touch_date: null,
    last_touch_date: r.last_contact_date ?? null,
    reason: attrs.reason,
    sequenceStageLabel: attrs.sequenceStageLabel,
    contactId: null,
    recruiterId: r.id,
  };
  attachSortAnchor(card, attrs.sortAnchor ?? null);
  return card;
}

// We stash the sort anchor on the object via a non-enumerable property so it
// doesn't accidentally serialize. (Server → client transport keeps only
// JSON-safe fields, which means the anchor is recomputed on the client side
// of any sort. We sort up front on the server before serialization, so this
// is purely a server-side helper.)
const SORT_ANCHOR = Symbol("queue-buckets-sort-anchor");
type Anchored = QueueCard & { [SORT_ANCHOR]?: number };

function attachSortAnchor(card: QueueCard, anchor: string | null) {
  Object.defineProperty(card, SORT_ANCHOR, {
    value: anchor ? new Date(anchor).getTime() : null,
    enumerable: false,
    writable: true,
  });
}

function getAnchor(card: QueueCard): number | null {
  return (card as Anchored)[SORT_ANCHOR] ?? null;
}

// ---------------------------------------------------------------------------
// Reason helpers
// ---------------------------------------------------------------------------

function pinnedReason(intent: Exclude<ContactIntent, "backrow">): string {
  switch (intent) {
    case "network_growth":
      return "Pinned to Network Growth";
    case "network_maintenance":
      return "Pinned to Network Maintenance";
    case "browning_cold":
      return "Pinned to Browning / Cold";
  }
}

function coldReason(stage: FirstContactStage): string {
  switch (stage) {
    case "identified":
      return "Researched — ready to reach out";
    case "connect_sent":
      return "Connection request sent — awaiting accept";
    case "connect_accepted":
      return "Connected — send the first DM";
    case "dm_sent":
      return "DM sent — awaiting reply";
    case "email_sent":
      return "Email sent — awaiting reply";
    default:
      return "Cold sequence in flight";
  }
}

function specificReason(input: {
  signal: TouchSignal | null;
  reconnect: ReconnectContact | null;
  hasResponded: boolean;
  lastReconnectInboundAt: string | null;
  recruiterIntentActive: boolean;
}): string {
  if (input.signal?.hasInboundLast30 || input.lastReconnectInboundAt) {
    return "Recent reply received — your move";
  }
  if (input.signal?.mostRecentOutboundOutcomeAt) {
    return "Last touch left a next step — keep it moving";
  }
  if (input.hasResponded) {
    return "Replied to your sequence — follow through";
  }
  if (input.recruiterIntentActive && input.reconnect) {
    return `Mid-conversation (${prettyStatus(input.reconnect.state.status)})`;
  }
  return "Pending follow-up";
}

function warmReason(nextTouch: Date, today: Date): string {
  const days = Math.round(
    (nextTouch.getTime() - today.getTime()) / 86_400_000
  );
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}

function prettyStatus(status: string): string {
  switch (status) {
    case "sent":
      return "sent · awaiting reply";
    case "replied":
      return "replied";
    case "in_conversation":
      return "in conversation";
    default:
      return status;
  }
}

// ---------------------------------------------------------------------------
// Sorters
// ---------------------------------------------------------------------------

function byWarmOrder(a: QueueCard, b: QueueCard): number {
  // Most overdue first, then due today, then upcoming. next_touch_date is
  // guaranteed non-null for warm cards (qualifier requires it).
  const ad = a.next_touch_date ? parseDateOnly(a.next_touch_date).getTime() : Infinity;
  const bd = b.next_touch_date ? parseDateOnly(b.next_touch_date).getTime() : Infinity;
  if (ad !== bd) return ad - bd;
  if (a.vip !== b.vip) return a.vip ? -1 : 1;
  return a.name.localeCompare(b.name);
}

function bySpecificOrder(a: QueueCard, b: QueueCard): number {
  const aa = getAnchor(a) ?? 0;
  const bb = getAnchor(b) ?? 0;
  if (aa !== bb) return bb - aa; // newest first
  if (a.vip !== b.vip) return a.vip ? -1 : 1;
  return a.name.localeCompare(b.name);
}

function byColdOrder(a: QueueCard, b: QueueCard): number {
  // Further along the sequence wins.
  const ar = stageProgressFromLabel(a.sequenceStageLabel);
  const br = stageProgressFromLabel(b.sequenceStageLabel);
  if (ar !== br) return br - ar;
  // Tie-break: newest event first (the "recency of identification").
  const aa = getAnchor(a) ?? 0;
  const bb = getAnchor(b) ?? 0;
  if (aa !== bb) return bb - aa;
  if (a.vip !== b.vip) return a.vip ? -1 : 1;
  return a.name.localeCompare(b.name);
}

function stageProgressFromLabel(label: string | null): number {
  if (!label) return -1;
  const match = (Object.keys(STAGE_LABEL) as FirstContactStage[]).find(
    (k) => STAGE_LABEL[k] === label
  );
  if (!match) return -1;
  return COLD_STAGE_PROGRESS[match] ?? -1;
}

// ---------------------------------------------------------------------------
// Data loaders
// ---------------------------------------------------------------------------

async function loadContactRecruiterMap(
  caveats: string[]
): Promise<Map<string, string>> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return new Map();
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("contacts")
      .select("id, source_ids")
      .not("source_ids->>recruiter_pipeline_id", "is", null);
    if (error) {
      caveats.push(
        `Couldn't read contacts.source_ids — pipeline links missing (${error.message})`
      );
      return new Map();
    }
    const map = new Map<string, string>();
    for (const row of data ?? []) {
      const rpid = (row.source_ids as
        | { recruiter_pipeline_id?: string }
        | null)?.recruiter_pipeline_id;
      if (typeof rpid === "string" && rpid.length > 0) {
        map.set(row.id as string, rpid);
      }
    }
    return map;
  } catch (err) {
    caveats.push(
      `Couldn't read contacts.source_ids — pipeline links missing (${
        err instanceof Error ? err.message : String(err)
      })`
    );
    return new Map();
  }
}

async function loadTouchSignals(
  caveats: string[]
): Promise<Map<string, TouchSignal>> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return new Map();
  try {
    const sb = createServiceRoleClient();
    const sixtyDaysAgo = new Date(
      Date.now() - 60 * 86_400_000
    ).toISOString();

    let withOutcome = true;
    let response = await sb
      .from("contact_touches")
      .select("contact_id, direction, touched_at, outcome")
      .gte("touched_at", sixtyDaysAgo);

    if (response.error && /outcome/i.test(response.error.message)) {
      // Migration 0015 not applied — fall back without `outcome` so the
      // 30-day inbound signal still works. Specific's "outcome" trigger is
      // ignored in that case.
      caveats.push(
        "contact_touches.outcome column missing — apply migration 0015 to enable the outcome-based Specific trigger."
      );
      withOutcome = false;
      response = (await sb
        .from("contact_touches")
        .select("contact_id, direction, touched_at")
        .gte("touched_at", sixtyDaysAgo)) as typeof response;
    }

    if (response.error) {
      caveats.push(
        `Couldn't read contact_touches (${response.error.message}) — Specific column will only see triage-based signals.`
      );
      return new Map();
    }

    const thirtyDaysAgoMs = Date.now() - 30 * 86_400_000;
    const map = new Map<string, TouchSignal>();
    for (const row of response.data ?? []) {
      const id = row.contact_id as string;
      const sig =
        map.get(id) ??
        ({
          hasInboundLast30: false,
          mostRecentInboundAt: null,
          mostRecentOutboundOutcomeAt: null,
        } satisfies TouchSignal);
      const ta = row.touched_at as string;
      const taMs = new Date(ta).getTime();
      const direction = row.direction as string | null;
      const outcome = withOutcome
        ? ((row as { outcome?: string | null }).outcome ?? null)
        : null;

      if (direction === "inbound") {
        if (taMs >= thirtyDaysAgoMs) sig.hasInboundLast30 = true;
        if (!sig.mostRecentInboundAt || sig.mostRecentInboundAt < ta) {
          sig.mostRecentInboundAt = ta;
        }
      } else if (
        direction === "outbound" &&
        outcome &&
        outcome.trim().length > 0
      ) {
        if (
          !sig.mostRecentOutboundOutcomeAt ||
          sig.mostRecentOutboundOutcomeAt < ta
        ) {
          sig.mostRecentOutboundOutcomeAt = ta;
        }
      }
      map.set(id, sig);
    }
    return map;
  } catch (err) {
    caveats.push(
      `Couldn't read contact_touches (${
        err instanceof Error ? err.message : String(err)
      }) — Specific column will only see triage-based signals.`
    );
    return new Map();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateOnly(value: string): Date {
  // value is YYYY-MM-DD; treat as local midnight to avoid timezone drift.
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function inboundsRecent(iso: string, today: Date): boolean {
  const ms = new Date(iso).getTime();
  return today.getTime() - ms <= 30 * 86_400_000;
}

function mostRecentInboundFromReconnect(r: ReconnectContact): string | null {
  let best: string | null = null;
  for (const t of r.touches) {
    if (t.direction !== "inbound") continue;
    if (!best || best < t.created_at) best = t.created_at;
  }
  return best;
}

function lastReconnectStageEventAt(r: ReconnectContact | null): string | null {
  if (!r?.first_contact?.history.length) return null;
  return r.first_contact.history[r.first_contact.history.length - 1].at;
}

function pickNewest(values: Array<string | null>): string | null {
  let best: string | null = null;
  for (const v of values) {
    if (!v) continue;
    if (!best || best < v) best = v;
  }
  return best;
}
