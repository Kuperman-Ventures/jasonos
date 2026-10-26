"use server";

import { revalidatePath } from "next/cache";
import {
  getConnectionByLinkedInUrl,
  normalizeLinkedInUrl,
} from "@/lib/integrations/leaddelta";
import { photoSaveAction } from "@/lib/outreach/contact-photo-cache";
import {
  removeStoredContactPhoto,
  saveRemoteContactPhoto,
  type ContactPhotoStorage,
} from "@/lib/outreach/contact-photo-store";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type ContactPhotoResult =
  | {
      ok: true;
      photoUrl: string | null;
      source: string | null;
      refreshed: boolean;
    }
  | { ok: false; error: string; unavailable?: boolean };

type PhotoRow = {
  id: string;
  linkedin_url: string | null;
  photo_url: string | null;
  photo_source: string | null;
  photo_updated_at: string | null;
  photo_storage_path: string | null;
};

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Pull a profile photo from LeadDelta for a contact that already has a
 * LinkedIn URL, then save the image file on the contact. Later views use
 * that saved file. Does not scrape LinkedIn.
 */
export async function refreshContactPhotoFromLeadDelta(
  contactId: string,
  opts?: { force?: boolean }
): Promise<ContactPhotoResult> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sb = createServiceRoleClient();
  const row = await readPhotoRow(sb, contactId);
  if (!row.ok) return row;
  const data = row.data;

  const existingUrl = data.photo_url?.trim() || null;
  const action = photoSaveAction({
    force: opts?.force,
    photoUrl: existingUrl,
    photoSource: data.photo_source,
    photoUpdatedAt: data.photo_updated_at,
  });
  if (action === "keep") {
    return {
      ok: true,
      photoUrl: existingUrl,
      source: data.photo_source,
      refreshed: false,
    };
  }

  if (action === "cache-remote" && existingUrl) {
    const cached = await cacheAndStore(sb, data, existingUrl);
    if (cached.ok) return cached.result;
    if (!cached.expired) {
      return {
        ok: true,
        photoUrl: existingUrl,
        source: data.photo_source,
        refreshed: false,
      };
    }
  }

  const linkedinUrl = normalizeLinkedInUrl((data.linkedin_url ?? "").trim());
  if (!linkedinUrl) {
    return { ok: false, error: "Add a LinkedIn profile URL first." };
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

  const remoteUrl = result.data?.photoUrl?.trim() || null;
  if (!remoteUrl) {
    await clearStoredPhoto(sb, data);
    revalidatePhotoPaths();
    return { ok: true, photoUrl: null, source: null, refreshed: true };
  }

  const cached = await cacheAndStore(sb, data, remoteUrl);
  if (cached.ok) return cached.result;

  const written = await writePhoto(sb, data.id, {
    photo_url: remoteUrl,
    photo_source: cached.expired ? "leaddelta-unreadable" : "leaddelta",
    photo_storage_path: null,
  });
  if (!written.ok) return written;
  revalidatePhotoPaths();
  return {
    ok: true,
    photoUrl: remoteUrl,
    source: cached.expired ? "leaddelta-unreadable" : "leaddelta",
    refreshed: true,
  };
}

/**
 * Save the picture already on a contact so the next view does not fetch
 * the remote link again. Asks LeadDelta only when that link has expired.
 */
export async function ensureContactPhotoStored(
  contactId: string
): Promise<ContactPhotoResult> {
  return refreshContactPhotoFromLeadDelta(contactId);
}

async function cacheAndStore(
  sb: ReturnType<typeof createServiceRoleClient>,
  data: PhotoRow,
  remoteUrl: string
): Promise<
  | { ok: true; result: ContactPhotoResult }
  | { ok: false; expired: boolean; error: string }
> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const version = String(Date.now());
  const saved = await saveRemoteContactPhoto({
    storage: sb as unknown as ContactPhotoStorage,
    supabaseUrl,
    contactId: data.id,
    remoteUrl,
    previousPath: data.photo_storage_path,
    version,
  });
  if (!saved.ok) return saved;

  const written = await writePhoto(sb, data.id, {
    photo_url: saved.photoUrl,
    photo_source: "stored",
    photo_storage_path: saved.storagePath,
  });
  if (!written.ok) return { ok: false, expired: false, error: written.error };
  revalidatePhotoPaths();
  return {
    ok: true,
    result: {
      ok: true,
      photoUrl: saved.photoUrl,
      source: "stored",
      refreshed: true,
    },
  };
}

async function clearStoredPhoto(
  sb: ReturnType<typeof createServiceRoleClient>,
  data: PhotoRow
): Promise<void> {
  await removeStoredContactPhoto(
    sb as unknown as ContactPhotoStorage,
    data.photo_storage_path
  );
  await writePhoto(sb, data.id, {
    photo_url: null,
    photo_source: null,
    photo_storage_path: null,
  });
}

async function readPhotoRow(
  sb: ReturnType<typeof createServiceRoleClient>,
  contactId: string
): Promise<{ ok: true; data: PhotoRow } | { ok: false; error: string }> {
  const full =
    "id,linkedin_url,photo_url,photo_source,photo_updated_at,photo_storage_path";
  let { data, error } = await sb
    .from("contacts")
    .select(full)
    .eq("id", contactId)
    .maybeSingle();
  if (error && /photo_storage_path/i.test(error.message)) {
    ({ data, error } = await sb
      .from("contacts")
      .select("id,linkedin_url,photo_url,photo_source,photo_updated_at")
      .eq("id", contactId)
      .maybeSingle());
  }
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Contact not found." };
  const row = data as {
    id: string;
    linkedin_url?: string | null;
    photo_url?: string | null;
    photo_source?: string | null;
    photo_updated_at?: string | null;
    photo_storage_path?: string | null;
  };
  return {
    ok: true,
    data: {
      id: row.id,
      linkedin_url: row.linkedin_url ?? null,
      photo_url: row.photo_url ?? null,
      photo_source: row.photo_source ?? null,
      photo_updated_at: row.photo_updated_at ?? null,
      photo_storage_path: row.photo_storage_path ?? null,
    },
  };
}

async function writePhoto(
  sb: ReturnType<typeof createServiceRoleClient>,
  contactId: string,
  fields: {
    photo_url: string | null;
    photo_source: string | null;
    photo_storage_path: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  let { error } = await sb
    .from("contacts")
    .update({ ...fields, photo_updated_at: now, updated_at: now })
    .eq("id", contactId);
  if (error && /photo_storage_path/i.test(error.message)) {
    const rest = {
      photo_url: fields.photo_url,
      photo_source: fields.photo_source,
    };
    ({ error } = await sb
      .from("contacts")
      .update({ ...rest, photo_updated_at: now, updated_at: now })
      .eq("id", contactId));
  }
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function revalidatePhotoPaths() {
  revalidatePath("/outreach/people");
  revalidatePath("/outreach/queue");
  revalidatePath("/");
}
