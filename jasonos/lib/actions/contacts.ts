"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isContactsConfigured } from "@/lib/data/contacts";
import { ALUMNI_PREFIX, type AlumniCluster } from "@/lib/ranker/score";

// All writes here intentionally use the service-role client. JasonOS has no
// auth flow yet; the anon client would be blocked by `to authenticated` RLS.
// Server actions never ship the key to the browser, so this is safe.

interface ActionResult {
  ok: boolean;
  error?: string;
}

function ensureConfigured(): ActionResult | null {
  if (isContactsConfigured()) return null;
  return {
    ok: false,
    error:
      "Supabase env vars not set on this deployment (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).",
  };
}

// ---- Score upsert ---------------------------------------------------------

export async function upsertContactScore(
  contactId: string,
  recency: number,
  seniority: number,
  fit: number,
  notes?: string
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("contact_scores")
    .upsert(
      {
        contact_id: contactId,
        recency,
        seniority,
        fit,
        scored_by: "user",
        notes: notes ?? null,
      },
      { onConflict: "contact_id" }
    );

  if (error) {
    console.error("[upsertContactScore]", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/contacts");
  return { ok: true };
}

// ---- Runner state save ----------------------------------------------------

export async function saveRunnerState(
  runnerId: string,
  taskId: string,
  state: Record<string, unknown>
): Promise<ActionResult> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("runner_state")
    .upsert(
      { runner_id: runnerId, task_id: taskId, state },
      { onConflict: "runner_id,task_id" }
    );

  if (error) {
    console.error("[saveRunnerState]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ---- Bulk insert from CSV import -----------------------------------------

export interface BulkInsertRow {
  name: string;
  emails?: string[];
  linkedin_url?: string;
  title?: string;
  last_touch_date?: string;
  alumniCluster?: AlumniCluster;
}

/**
 * Bulk-insert contacts from the spreadsheet importer.
 *
 * This is the ONLY path that is exempt from the "new contacts start
 * unclassified" rule. The CSV/spreadsheet upload carries its own
 * classification mapping (cluster tags, etc.) so any classification it
 * sets comes from the imported file, not from a derivation rule. Every
 * other in-app create flow goes through `createContactUnclassified` in
 * `@/lib/server-actions/contacts`.
 */
export async function bulkInsertContacts(
  rows: BulkInsertRow[]
): Promise<ActionResult & { inserted?: number }> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const cleaned = rows
    .filter((r) => r.name && r.name.trim().length > 0)
    .map((r) => ({
      name: r.name.trim(),
      emails: r.emails ?? [],
      linkedin_url: r.linkedin_url ?? null,
      title: r.title ?? null,
      last_touch_date: r.last_touch_date ?? null,
      tags: r.alumniCluster ? [`${ALUMNI_PREFIX}${r.alumniCluster}`] : [],
    }));

  if (cleaned.length === 0) return { ok: true, inserted: 0 };

  const supabase = createServiceRoleClient();
  const { error, count } = await supabase
    .from("contacts")
    .insert(cleaned, { count: "exact" });

  if (error) {
    console.error("[bulkInsertContacts]", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/contacts");
  return { ok: true, inserted: count ?? cleaned.length };
}

// ---- Finish tier-1 selection (atomic via Postgres RPC) -------------------

export interface FinishPick {
  contactId: string;
  rank: number;
  priorityScore: number;
  whyNow: string;
  title: string;
  subtitle?: string;
}

export async function finishTier1(
  picks: FinishPick[]
): Promise<ActionResult & { upserted?: number; dismissed?: number }> {
  const guard = ensureConfigured();
  if (guard) return guard;

  const payload = picks.map((p) => ({
    contact_id: p.contactId,
    rank: p.rank,
    priority_score: p.priorityScore,
    why_now: p.whyNow,
    title: p.title,
    subtitle: p.subtitle ?? null,
  }));

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("finalize_tier1", {
    p_picks: payload,
  });

  if (error) {
    console.error("[finishTier1]", error);
    return { ok: false, error: error.message };
  }

  // RPC returns table (upserted_count int, dismissed_count int, artifact_id uuid)
  const row = Array.isArray(data) ? data[0] : data;
  const upserted = row?.upserted_count ?? picks.length;
  const dismissed = row?.dismissed_count ?? 0;

  revalidatePath("/contacts");
  revalidatePath("/");
  return { ok: true, upserted, dismissed };
}
