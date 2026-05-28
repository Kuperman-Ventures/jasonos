"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getUnscoredTouches } from "@/lib/browning/data";
import type {
  BrowningChannel,
  BrowningDeliveredStatus,
  BrowningGateStatus,
  BrowningSource,
  BrowningTier,
  ThankYouStatus,
  UnscoredTouch,
} from "@/lib/browning/types";

type ActionResult = { ok: true } | { ok: false; error: string };

function ensureConfigured(): ActionResult | null {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }
  return { ok: false, error: "Supabase service role is not configured." };
}

function revalidate() {
  revalidatePath("/browning");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// scoreConversation — primary signal capture
//
// Insert one row into jasonos.browning_conversations. The unique partial
// index on linked_touch_id is what prevents double-scoring; we surface the
// duplicate-key error as a friendly message rather than letting the 500
// bubble up to the dialog.
// ---------------------------------------------------------------------------

export interface ScoreConversationInput {
  contactId: string;
  linkedTouchId?: string | null;
  conversationDate: string; // YYYY-MM-DD
  channel: BrowningChannel;
  durationMin?: number | null;
  warmth: number;
  patience: number;
  adviceMode: number;
  twoReferralAsk: number;
  reciprocity: number;
  referralsReceived: number;
  thankYouSent: ThankYouStatus;
  whatWasHard?: string | null;
  whatToDoDifferently?: string | null;
  producedLead?: boolean;
}

export async function scoreConversation(
  input: ScoreConversationInput
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!input.contactId) return { ok: false, error: "contactId is required." };
  if (!input.conversationDate) {
    return { ok: false, error: "conversationDate is required." };
  }

  // Validate scores defensively — the DB CHECK constraints will also
  // reject these, but a clean message is friendlier.
  const scores = [
    input.warmth,
    input.patience,
    input.adviceMode,
    input.twoReferralAsk,
    input.reciprocity,
  ];
  for (const s of scores) {
    if (!Number.isInteger(s) || s < 1 || s > 5) {
      return { ok: false, error: "Each score must be an integer 1–5." };
    }
  }

  const sb = createServiceRoleClient();
  const { error } = await sb.from("browning_conversations").insert({
    contact_id: input.contactId,
    linked_touch_id: input.linkedTouchId ?? null,
    conversation_date: input.conversationDate,
    channel: input.channel,
    duration_min: input.durationMin ?? null,
    warmth: input.warmth,
    patience: input.patience,
    advice_mode: input.adviceMode,
    two_referral_ask: input.twoReferralAsk,
    reciprocity: input.reciprocity,
    referrals_received: Math.max(0, Math.floor(input.referralsReceived ?? 0)),
    thank_you_sent: input.thankYouSent,
    what_was_hard: input.whatWasHard?.trim() || null,
    what_to_do_differently: input.whatToDoDifferently?.trim() || null,
    produced_lead: Boolean(input.producedLead),
  });

  if (error) {
    if (error.code === "23505" || /duplicate key/i.test(error.message)) {
      return {
        ok: false,
        error: "This conversation has already been scored.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// setContactBrowning — tag (or untag) a contact for the Browning module
// ---------------------------------------------------------------------------

export async function setContactBrowning(input: {
  contactId: string;
  source: BrowningSource | null;
  tier?: BrowningTier | null;
}): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!input.contactId) return { ok: false, error: "contactId is required." };

  const sb = createServiceRoleClient();
  const payload: Record<string, unknown> = {
    browning_source: input.source,
    // Setting source=null clears the tier too, per the architecture decision.
    browning_tier: input.source === null ? null : input.tier ?? null,
  };
  const { error } = await sb
    .from("contacts")
    .update(payload)
    .eq("id", input.contactId);
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// updateGate — mutate one row in browning_gates
// ---------------------------------------------------------------------------

export async function updateGate(input: {
  gateCode: string;
  status?: BrowningGateStatus;
  targetDate?: string | null;
  completedDate?: string | null;
  notes?: string;
}): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!input.gateCode) return { ok: false, error: "gateCode is required." };

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.status !== undefined) payload.status = input.status;
  if (input.targetDate !== undefined) payload.target_date = input.targetDate;
  if (input.completedDate !== undefined) {
    payload.completed_date = input.completedDate;
  }
  if (input.notes !== undefined) payload.notes = input.notes.trim() || null;

  // If the caller sets status to 'completed' but didn't pass a completed_date,
  // default to today.
  if (
    input.status === "completed" &&
    (input.completedDate === undefined || input.completedDate === null)
  ) {
    payload.completed_date = new Date().toISOString().slice(0, 10);
  }

  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("browning_gates")
    .update(payload)
    .eq("gate_code", input.gateCode);
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// upsertDeliverable — insert if no id, update if id given
// ---------------------------------------------------------------------------

export async function upsertDeliverable(input: {
  id?: string;
  month: string;
  promised: string;
  deliveredStatus?: BrowningDeliveredStatus | null;
  onTime?: boolean | null;
  quality?: number | null;
  notes?: string;
  escalate?: boolean;
}): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!input.month) return { ok: false, error: "month is required." };
  if (!input.promised?.trim()) {
    return { ok: false, error: "promised is required." };
  }
  if (
    input.quality !== undefined &&
    input.quality !== null &&
    (!Number.isInteger(input.quality) || input.quality < 1 || input.quality > 5)
  ) {
    return { ok: false, error: "Quality must be 1–5." };
  }

  const sb = createServiceRoleClient();
  const payload: Record<string, unknown> = {
    month: input.month,
    promised: input.promised.trim(),
    delivered_status: input.deliveredStatus ?? null,
    on_time: input.onTime ?? null,
    quality: input.quality ?? null,
    notes: input.notes?.trim() || null,
    escalate: Boolean(input.escalate),
  };

  if (input.id) {
    const { error } = await sb
      .from("browning_deliverables")
      .update(payload)
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await sb.from("browning_deliverables").insert(payload);
    if (error) return { ok: false, error: error.message };
  }

  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// deleteDeliverable
// ---------------------------------------------------------------------------

export async function deleteDeliverable(input: {
  id: string;
}): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;
  if (!input.id) return { ok: false, error: "id is required." };

  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("browning_deliverables")
    .delete()
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// searchContactsForBrowning — autocomplete source for AddToBrowningDialog.
// Returns the top 20 contacts matching `query` by name (case-insensitive).
// ---------------------------------------------------------------------------

export interface BrowningContactSearchResult {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  browning_source: BrowningSource | null;
  browning_tier: BrowningTier | null;
}

// ---------------------------------------------------------------------------
// fetchUnscoredTouches — thin client-callable wrapper around the server-only
// data.ts helper so dialogs can lazy-load on open.
// ---------------------------------------------------------------------------

export async function fetchUnscoredTouches(): Promise<UnscoredTouch[]> {
  return getUnscoredTouches();
}

// ---------------------------------------------------------------------------
// getBrowningPostTouchPrompt — called by the OutreachModal immediately after
// a touch is logged on a contact. Returns the metadata needed to decide
// whether to auto-open the score dialog (and what to prefill it with).
//
// Returns `null` when the contact is NOT Browning-tagged — that's the signal
// to NOT prompt.
// ---------------------------------------------------------------------------

export interface BrowningPostTouchPrompt {
  browning_source: BrowningSource;
  contact_name: string;
  latest_touch_id: string | null;
  latest_touch_at: string | null;
  latest_touch_channel: string | null;
}

export async function getBrowningPostTouchPrompt(
  contactId: string
): Promise<BrowningPostTouchPrompt | null> {
  const guard = ensureConfigured();
  if (guard) return null;
  if (!contactId) return null;

  const sb = createServiceRoleClient();
  const { data: contact } = await sb
    .from("contacts")
    .select("name, browning_source")
    .eq("id", contactId)
    .maybeSingle();

  if (!contact || !contact.browning_source) return null;

  // Fetch the most recent touch for this contact so we can pre-fill the
  // score dialog and link the row to it.
  const { data: latest } = await sb
    .from("contact_touches")
    .select("id, touched_at, channel")
    .eq("contact_id", contactId)
    .order("touched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Only prompt when this is genuinely a NEW touch (i.e. nothing is yet
  // scored against it). The unique partial index will reject a dupe insert
  // anyway, but skipping the prompt here gives a cleaner UX than showing the
  // dialog and surfacing the duplicate-key error.
  if (latest?.id) {
    const { count } = await sb
      .from("browning_conversations")
      .select("id", { count: "exact", head: true })
      .eq("linked_touch_id", latest.id as string);
    if ((count ?? 0) > 0) {
      return null;
    }
  }

  return {
    browning_source: contact.browning_source as BrowningSource,
    contact_name: (contact.name as string) ?? "Contact",
    latest_touch_id: (latest?.id as string | undefined) ?? null,
    latest_touch_at: (latest?.touched_at as string | undefined) ?? null,
    latest_touch_channel: (latest?.channel as string | undefined) ?? null,
  };
}

export async function searchContactsForBrowning(
  query: string,
  limit = 20
): Promise<BrowningContactSearchResult[]> {
  const guard = ensureConfigured();
  if (guard) return [];
  const sb = createServiceRoleClient();

  let q = sb
    .from("contacts")
    .select("id, name, title, tags, browning_source, browning_tier")
    .order("name", { ascending: true })
    .limit(limit);
  const trimmed = query.trim();
  if (trimmed) q = q.ilike("name", `%${trimmed}%`);

  const { data, error } = await q;
  if (error) {
    console.error("[browning.searchContactsForBrowning]", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const tags = (row.tags as string[] | null) ?? [];
    const company =
      tags
        .find((t) => t.startsWith("firm:"))
        ?.slice("firm:".length)
        .replace(/-/g, " ") ?? null;
    return {
      id: row.id as string,
      name: (row.name as string) ?? "Unnamed",
      title: (row.title as string | null) ?? null,
      company,
      browning_source:
        (row.browning_source as BrowningSource | null) ?? null,
      browning_tier: (row.browning_tier as BrowningTier | null) ?? null,
    };
  });
}
