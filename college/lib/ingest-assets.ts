/** Ingest file assets — decks, PDFs, and email files stored in Supabase Storage. */

import { createClient } from "@supabase/supabase-js";

export const INGEST_BUCKET = "college-ingest";
export const INGEST_MAX_BYTES = 25 * 1024 * 1024;

/** MIME types we store. Extension fallback covers browsers that omit type. */
export const INGEST_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.apple.keynote",
  "application/octet-stream",
  "message/rfc822",
  "application/vnd.ms-outlook",
]);

export type IngestAssetKind = "pdf" | "deck" | "email";

const EXT_RE = /\.(pptx|key|pdf|eml|msg)$/i;

export function ingestFileKind(file: { name?: string; type?: string }): IngestAssetKind | null {
  const name = (file.name ?? "").toLowerCase();
  const type = (file.type ?? "").toLowerCase();
  if (name.endsWith(".pdf") || type === "application/pdf") return "pdf";
  if (name.endsWith(".eml") || name.endsWith(".msg") || type === "message/rfc822") return "email";
  if (
    name.endsWith(".pptx") ||
    name.endsWith(".key") ||
    type.includes("presentation") ||
    type.includes("powerpoint") ||
    type.includes("keynote")
  ) {
    return "deck";
  }
  return null;
}

export function ingestAssetKind(mime: string): IngestAssetKind | null {
  if (mime === "application/pdf") return "pdf";
  if (mime === "message/rfc822" || mime === "application/vnd.ms-outlook") return "email";
  if (
    mime.includes("presentation") ||
    mime.includes("powerpoint") ||
    mime.includes("keynote")
  ) {
    return "deck";
  }
  return null;
}

export function ingestExtension(mime: string, fileName?: string): string | null {
  const fromName = fileName?.split(".").pop()?.toLowerCase();
  if (fromName && ["pdf", "pptx", "key", "eml", "msg"].includes(fromName)) return fromName;
  if (mime === "application/pdf") return "pdf";
  if (mime === "message/rfc822") return "eml";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "pptx";
  if (mime.includes("keynote")) return "key";
  if (mime === "application/vnd.ms-outlook") return "msg";
  return null;
}

export function isIngestFile(file: { name?: string; type?: string }): boolean {
  if (ingestFileKind(file)) return true;
  const type = (file.type ?? "").toLowerCase();
  if (type === "application/pdf" || type === "message/rfc822") return true;
  return EXT_RE.test(file.name ?? "");
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
  return [
    ".pptx",
    ".key",
    ".pdf",
    ".eml",
    ".msg",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "message/rfc822",
  ].join(",");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
