/** Ingest file assets — PDF and images stored in Supabase Storage. */

import { createClient } from "@supabase/supabase-js";

export const INGEST_BUCKET = "college-ingest";
export const INGEST_MAX_BYTES = 25 * 1024 * 1024;

export const INGEST_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type IngestAssetKind = "pdf" | "image";

export function ingestAssetKind(mime: string): IngestAssetKind | null {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/") && INGEST_MIME.has(mime)) return "image";
  return null;
}

export function ingestExtension(mime: string, fileName?: string): string | null {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  const fromName = fileName?.split(".").pop()?.toLowerCase();
  if (fromName && ["pdf", "jpg", "jpeg", "png", "webp", "gif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  return null;
}

export function isIngestFile(file: { name?: string; type?: string }): boolean {
  const type = (file.type ?? "").toLowerCase();
  if (INGEST_MIME.has(type)) return true;
  const name = (file.name ?? "").toLowerCase();
  return /\.(pdf|png|jpe?g|webp|gif)$/i.test(name);
}

export function publicIngestUrl(path: string | null | undefined): string | null {
  if (!path?.trim()) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/${INGEST_BUCKET}/${path.replace(/^\//, "")}`;
}

export function ingestStorageAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function acceptIngestAttr(): string {
  return "application/pdf,.pdf,image/png,.png,image/jpeg,.jpg,.jpeg,image/webp,.webp,image/gif,.gif";
}
