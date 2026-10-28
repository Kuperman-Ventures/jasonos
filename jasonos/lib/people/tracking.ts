import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

type Sb = ReturnType<typeof createServiceRoleClient>;
type TrackResult = { ok: true; changed: boolean } | { ok: false; error: string };

/** Networking status columns were removed in Live slides restart (0114). */
export async function applyReferral(
  _sb: Sb,
  _contactId: string,
  _receivedAt: string
): Promise<TrackResult> {
  return { ok: true, changed: false };
}

export async function applyFirstContactFromTouches(
  _sb: Sb,
  _touches: Array<{
    contact_id: string;
    channel: string | null;
    direction: string | null;
    touched_at: string;
  }>
): Promise<void> {
  // no-op after contacts.referral_received_at / networking_status drop
}
