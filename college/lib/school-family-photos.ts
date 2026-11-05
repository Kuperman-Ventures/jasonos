/**
 * Family visit photos stored in Supabase (college.school_photos + public bucket).
 * Shared across the household — any signed-in member can upload and view.
 */

import { createClient } from "@supabase/supabase-js";
import { collegeDb, supabaseConfigured } from "@/lib/db";
import type { SchoolPhoto } from "@/lib/school-photos";

export const SCHOOL_PHOTO_BUCKET = "college-school-photos";
export const SCHOOL_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const SCHOOL_PHOTO_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

export type FamilyPhotoRow = {
  id: string;
  created_at: string;
  school_id: string;
  uploaded_by_id: string;
  uploaded_by_name: string;
  storage_path: string;
  caption: string;
  visit_date: string | null;
  starred: boolean;
  mime_type: string;
  byte_size: number;
};

export function schoolPhotoStorageAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function publicSchoolPhotoUrl(path: string | null | undefined): string | null {
  if (!path?.trim()) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/${SCHOOL_PHOTO_BUCKET}/${path.replace(/^\//, "")}`;
}

export function schoolPhotoExtension(mime: string, fileName?: string): string | null {
  const fromName = fileName?.split(".").pop()?.toLowerCase();
  if (
    fromName &&
    ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(fromName)
  ) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/heic") return "heic";
  if (mime === "image/heif") return "heif";
  return null;
}

export function normalizeImageMime(file: { name?: string; type?: string }): string | null {
  const type = (file.type ?? "").toLowerCase().trim();
  if (SCHOOL_PHOTO_MIME.has(type)) return type;
  const name = (file.name ?? "").toLowerCase();
  if (/\.jpe?g$/.test(name)) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".heic")) return "image/heic";
  if (name.endsWith(".heif")) return "image/heif";
  return null;
}

function mapRow(row: FamilyPhotoRow): SchoolPhoto {
  const url = publicSchoolPhotoUrl(row.storage_path);
  return {
    id: row.id,
    schoolId: row.school_id,
    src: url,
    thumbSrc: url,
    caption: row.caption?.trim() || "Family photo",
    kind: "family",
    userId: row.uploaded_by_id,
    visitDate: row.visit_date,
    starred: row.starred,
  };
}

export async function listFamilyPhotosForSchool(schoolId: string): Promise<SchoolPhoto[]> {
  if (!supabaseConfigured()) return [];
  const { data, error } = await collegeDb()
    .from("school_photos")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as FamilyPhotoRow[]).map(mapRow);
}

export async function insertFamilyPhoto(input: {
  schoolId: string;
  uploadedById: string;
  uploadedByName: string;
  storagePath: string;
  caption?: string;
  visitDate?: string | null;
  mimeType: string;
  byteSize: number;
}): Promise<SchoolPhoto> {
  const { data, error } = await collegeDb()
    .from("school_photos")
    .insert({
      school_id: input.schoolId,
      uploaded_by_id: input.uploadedById,
      uploaded_by_name: input.uploadedByName,
      storage_path: input.storagePath,
      caption: input.caption?.trim() || "Family photo",
      visit_date: input.visitDate ?? null,
      mime_type: input.mimeType,
      byte_size: input.byteSize,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save photo");
  return mapRow(data as FamilyPhotoRow);
}

export async function deleteFamilyPhoto(photoId: string): Promise<FamilyPhotoRow | null> {
  const { data, error } = await collegeDb()
    .from("school_photos")
    .delete()
    .eq("id", photoId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FamilyPhotoRow | null) ?? null;
}

export function buildSchoolPhotoStoragePath(
  schoolId: string,
  memberId: string,
  ext: string,
): string {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${schoolId}/${memberId}/${stamp}-${rand}.${ext}`;
}
