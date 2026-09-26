import { createClient } from "@supabase/supabase-js";
import { collegeDb, supabaseConfigured } from "./db";
import type { MemberRole } from "./auth";

export const AVATAR_BUCKET = "college-avatars";
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type MemberProfile = {
  id: string;
  displayName: string;
  role: MemberRole;
  avatarUrl: string | null;
};

type MemberAvatarRow = {
  id: string;
  display_name: string;
  role: MemberRole;
  ui_visible: boolean;
  avatar_path: string | null;
  oauth_avatar_url?: string | null;
};

export function storageAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function publicAvatarUrl(path: string | null | undefined): string | null {
  if (!path?.trim()) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${path.replace(/^\//, "")}`;
}

/** Uploaded photo wins; otherwise use the Google/OAuth profile picture. */
export function resolveMemberAvatarUrl(
  avatarPath: string | null | undefined,
  oauthAvatarUrl: string | null | undefined,
): string | null {
  return publicAvatarUrl(avatarPath) ?? (oauthAvatarUrl?.trim() || null);
}

/** Pull a usable image URL from Supabase Auth Google (or similar) metadata. */
export function oauthAvatarFromMetadata(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const record = meta as Record<string, unknown>;
  for (const key of ["avatar_url", "picture", "avatar"]) {
    const value = record[key];
    if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) {
      return value.trim();
    }
  }
  return null;
}

export function avatarExtension(mime: string): string | null {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return null;
}

export function memberInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export async function listVisibleMemberProfiles(): Promise<MemberProfile[]> {
  if (!supabaseConfigured()) {
    return [
      { id: "jason", displayName: "Jason", role: "super_admin", avatarUrl: null },
      { id: "kat", displayName: "Kat", role: "parent", avatarUrl: null },
      { id: "kyle", displayName: "Kyle", role: "student", avatarUrl: null },
    ];
  }
  const db = collegeDb();
  const { data, error } = await db
    .from("members")
    .select("id, display_name, role, ui_visible, avatar_path, oauth_avatar_url")
    .eq("ui_visible", true)
    .order("display_name");
  if (error) throw error;
  return ((data ?? []) as MemberAvatarRow[]).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    avatarUrl: resolveMemberAvatarUrl(row.avatar_path, row.oauth_avatar_url),
  }));
}

export async function getMemberAvatarPath(memberId: string): Promise<string | null> {
  if (!supabaseConfigured()) return null;
  const db = collegeDb();
  const { data, error } = await db
    .from("members")
    .select("avatar_path")
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw error;
  return (data as { avatar_path: string | null } | null)?.avatar_path ?? null;
}

export async function setMemberAvatarPath(memberId: string, path: string | null): Promise<void> {
  if (!supabaseConfigured()) return;
  const db = collegeDb();
  const { error } = await db
    .from("members")
    .update({ avatar_path: path, updated_at: new Date().toISOString() })
    .eq("id", memberId);
  if (error) throw error;
}

export async function setMemberOauthAvatarUrl(
  memberId: string,
  oauthAvatarUrl: string | null,
): Promise<void> {
  if (!supabaseConfigured()) return;
  const db = collegeDb();
  const { error } = await db
    .from("members")
    .update({
      oauth_avatar_url: oauthAvatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId);
  if (error) throw error;
}
