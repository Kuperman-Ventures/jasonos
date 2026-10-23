import "server-only";

import { asNetworkingStatus } from "@/lib/meeting-prep/call-sheet";
import { countsAsFirstContact } from "@/lib/meeting-prep/people";
import { createServiceRoleClient } from "@/lib/supabase/server";

type Sb = ReturnType<typeof createServiceRoleClient>;
type TrackResult = { ok: true; changed: boolean } | { ok: false; error: string };

/**
 * A referral came in. Stamps when (earliest wins) and starts the person at Referral.
 * A person already further along keeps their status.
 */
export async function applyReferral(sb: Sb, contactId: string, receivedAt: string): Promise<TrackResult> {
  const received = Number.isNaN(Date.parse(receivedAt)) ? new Date().toISOString() : receivedAt;
  const { data, error } = await sb
    .from("contacts")
    .select("networking_status, referral_received_at")
    .eq("id", contactId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Contact not found." };
  const patch: Record<string, unknown> = {};
  const stored = (data.referral_received_at as string | null) ?? null;
  if (!stored || Date.parse(received) < Date.parse(stored)) patch.referral_received_at = received;
  if (!asNetworkingStatus(data.networking_status)) patch.networking_status = "referral";
  if (!Object.keys(patch).length) return { ok: true, changed: false };
  const { error: updateError } = await sb
    .from("contacts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", contactId);
  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true, changed: true };
}

/** First contact with a referral: stamps when and moves Referral to First contacted. */
export async function applyFirstContact(sb: Sb, contactId: string, contactedAt: string): Promise<TrackResult> {
  const { data, error } = await sb
    .from("contacts")
    .select("networking_status, first_contact_at")
    .eq("id", contactId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Contact not found." };
  const status = asNetworkingStatus(data.networking_status);
  const patch: Record<string, unknown> = {};
  if (!data.first_contact_at) patch.first_contact_at = contactedAt;
  if (status === "referral") patch.networking_status = "first_contacted";
  if (!Object.keys(patch).length) return { ok: true, changed: false };
  const { error: updateError } = await sb
    .from("contacts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", contactId);
  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true, changed: true };
}

/** After touches are written: any referral these touches reached becomes First contacted. */
export async function applyFirstContactFromTouches(
  sb: Sb,
  touches: Array<{ contact_id: string; channel: string | null; direction: string | null; touched_at: string }>
): Promise<void> {
  const ids = [...new Set(touches.map((touch) => touch.contact_id).filter(Boolean))];
  const referrals: Array<{ id: unknown; referral_received_at: unknown }> = [];
  for (let start = 0; start < ids.length; start += 80) {
    const { data, error } = await sb
      .from("contacts")
      .select("id, referral_received_at")
      .eq("networking_status", "referral")
      .is("first_contact_at", null)
      .in("id", ids.slice(start, start + 80));
    if (error) {
      console.error("[people.firstContact] read", error.message);
      return;
    }
    referrals.push(...(data ?? []));
  }
  for (const row of referrals) {
    const referralReceivedAt = (row.referral_received_at as string | null) ?? null;
    const first = touches
      .filter(
        (touch) =>
          touch.contact_id === row.id &&
          countsAsFirstContact({
            channel: touch.channel,
            direction: touch.direction,
            touchedAt: touch.touched_at,
            referralReceivedAt,
          })
      )
      .map((touch) => touch.touched_at)
      .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
    if (!first) continue;
    const applied = await applyFirstContact(sb, row.id as string, first);
    if (!applied.ok) console.error("[people.firstContact]", row.id, applied.error);
  }
}
