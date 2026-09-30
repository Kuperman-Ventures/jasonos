"use server";

import { revalidatePath } from "next/cache";
import {
  getConnectionByLinkedInUrl,
  normalizeLinkedInUrl,
} from "@/lib/integrations/leaddelta";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type ContactPhotoResult =
  | {
      ok: true;
      photoUrl: string | null;
      source: string | null;
      refreshed: boolean;
    }
  | { ok: false; error: string; unavailable?: boolean };

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Pull a profile photo from LeadDelta for a contact that already has a
 * LinkedIn URL. Stores photo_url on the contact. Does not scrape LinkedIn.
 */
export async function refreshContactPhotoFromLeadDelta(
  contactId: string,
  opts?: { force?: boolean }
): Promise<ContactPhotoResult> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("contacts")
    .select("id,linkedin_url,photo_url,photo_source,photo_updated_at")
    .eq("id", contactId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Contact not found." };

  const linkedinUrl = normalizeLinkedInUrl(
    ((data.linkedin_url as string | null) ?? "").trim()
  );
  if (!linkedinUrl) {
    return { ok: false, error: "Add a LinkedIn profile URL first." };
  }

  const existingUrl = (data.photo_url as string | null)?.trim() || null;
  const updatedAt = data.photo_updated_at
    ? Date.parse(data.photo_updated_at as string)
    : NaN;
  const freshEnough =
    existingUrl &&
    data.photo_source === "leaddelta" &&
    Number.isFinite(updatedAt) &&
    Date.now() - updatedAt < 30 * 24 * 60 * 60 * 1000;
  if (!opts?.force && freshEnough) {
    return {
      ok: true,
      photoUrl: existingUrl,
      source: "leaddelta",
      refreshed: false,
    };
  }

  const result = await getConnectionByLinkedInUrl(linkedinUrl);
  if (!result.configured) {
    return {
      ok: false,
      unavailable: true,
      error: "LeadDelta is not connected. Paste an API key in Settings.",
    };
  }
  if (result.error) return { ok: false, error: result.error };
  const photoUrl = result.data?.photoUrl?.trim() || null;
  const now = new Date().toISOString();
  const { error: updateError } = await sb
    .from("contacts")
    .update({
      photo_url: photoUrl,
      photo_source: photoUrl ? "leaddelta" : null,
      photo_updated_at: now,
      updated_at: now,
    })
    .eq("id", contactId);
  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath("/outreach/people");
  revalidatePath("/outreach/queue");
  return {
    ok: true,
    photoUrl,
    source: photoUrl ? "leaddelta" : null,
    refreshed: true,
  };
}
