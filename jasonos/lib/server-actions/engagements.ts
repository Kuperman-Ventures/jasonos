"use server";

// Engagements — editing and deleting individual logged interactions
// (jasonos.contact_touches rows). Each engagement is a first-class, editable
// record: type (channel), direction, date/time, note, and outcome. After any
// edit or delete we re-stamp the contact's last_touch_date / last_touch_channel
// from the newest remaining engagement and re-derive next_touch_date from
// cadence, so the queue and the weekly report stay correct.
//
// Note: sync only ever INSERTS new rows (deduped on source + external_id) and
// never updates existing ones, so editing a synced engagement is safe — a
// future sync won't revert your changes.

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { CADENCE_DAYS, type CadenceInterval } from "@/lib/outreach/types";
import type { TouchChannel, TouchDirection } from "@/lib/outreach/touch-capture";

type OkResult = { ok: true } | { ok: false; error: string };

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export interface EngagementPatch {
  channel?: TouchChannel;
  direction?: TouchDirection;
  touchedAt?: string; // ISO timestamp
  brief?: string | null;
  outcome?: string | null;
}

// Re-stamp a contact's touch state from whatever engagements remain. Preserves
// a manual next-touch override when one is set.
async function recomputeContactTouchState(
  sb: ReturnType<typeof createServiceRoleClient>,
  contactId: string
): Promise<void> {
  const { data: latest } = await sb
    .from("contact_touches")
    .select("touched_at,channel")
    .eq("contact_id", contactId)
    .order("touched_at", { ascending: false })
    .limit(1);

  let cadence: CadenceInterval = "none";
  let manual = false;
  const read = await sb
    .from("contacts")
    .select("cadence_interval,next_touch_is_manual")
    .eq("id", contactId)
    .maybeSingle();
  if (read.error && /next_touch_is_manual/i.test(read.error.message)) {
    const fb = await sb
      .from("contacts")
      .select("cadence_interval")
      .eq("id", contactId)
      .maybeSingle();
    cadence = (fb.data?.cadence_interval as CadenceInterval | null) ?? "none";
  } else {
    cadence = (read.data?.cadence_interval as CadenceInterval | null) ?? "none";
    manual = Boolean(read.data?.next_touch_is_manual);
  }

  const payload: Record<string, unknown> = {};
  if (!latest?.length) {
    payload.last_touch_date = null;
    payload.last_touch_channel = null;
    if (!manual) payload.next_touch_date = null;
  } else {
    const lastDate = (latest[0].touched_at as string).slice(0, 10);
    payload.last_touch_date = lastDate;
    payload.last_touch_channel = (latest[0].channel as string) ?? null;
    if (!manual) {
      if (cadence !== "none") {
        const anchor = new Date(`${lastDate}T00:00:00`);
        anchor.setDate(anchor.getDate() + CADENCE_DAYS[cadence]);
        payload.next_touch_date = anchor.toISOString().split("T")[0];
      } else {
        payload.next_touch_date = null;
      }
    }
  }

  const { error } = await sb.from("contacts").update(payload).eq("id", contactId);
  if (error) console.error("[engagements.recompute]", error);
}

export async function updateEngagement(
  id: string,
  patch: EngagementPatch
): Promise<OkResult> {
  if (!hasConfig()) return { ok: false, error: "Not configured." };
  if (!id) return { ok: false, error: "id is required." };

  const sb = createServiceRoleClient();
  const { data: existing, error: readErr } = await sb
    .from("contact_touches")
    .select("contact_id")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!existing) return { ok: false, error: "Engagement not found." };

  const update: Record<string, unknown> = {};
  if (patch.channel !== undefined) update.channel = patch.channel;
  if (patch.direction !== undefined) update.direction = patch.direction;
  if (patch.touchedAt !== undefined) update.touched_at = patch.touchedAt;
  if (patch.brief !== undefined) update.brief = patch.brief?.trim() || null;
  if (patch.outcome !== undefined) update.outcome = patch.outcome?.trim() || null;
  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await sb
    .from("contact_touches")
    .update(update)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await recomputeContactTouchState(sb, existing.contact_id as string);
  revalidatePath("/activity");
  return { ok: true };
}

export async function deleteEngagement(id: string): Promise<OkResult> {
  if (!hasConfig()) return { ok: false, error: "Not configured." };
  if (!id) return { ok: false, error: "id is required." };

  const sb = createServiceRoleClient();
  const { data: existing, error: readErr } = await sb
    .from("contact_touches")
    .select("contact_id")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!existing) return { ok: true };

  // Detach any meeting linked to this touch so we don't leave a dangling FK.
  await sb
    .from("meetings")
    .update({ linked_touch_id: null })
    .eq("linked_touch_id", id);

  const { error } = await sb.from("contact_touches").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await recomputeContactTouchState(sb, existing.contact_id as string);
  revalidatePath("/activity");
  return { ok: true };
}
