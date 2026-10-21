/** Ingest file assets — decks, PDFs, email, and rich-text files stored in Supabase Storage. */

import { createClient } from "@supabase/supabase-js";
import { isRtfFile } from "@/lib/rtf";

export const INGEST_BUCKET = "college-ingest";
export const INGEST_MAX_BYTES = 25 * 1024 * 1024;
export const INGEST_FILE_HINT =
  "Use a PowerPoint, Keynote, PDF, email, rich-text file (.rtf or .rtfd), or image (PNG, JPG, WebP).";

/** MIME types we store. Extension fallback covers browsers that omit type. */
export const INGEST_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.apple.keynote",
  "application/octet-stream",
  "message/rfc822",
  "application/vnd.ms-outlook",
  "application/rtf",
  "text/rtf",
  "application/x-rtf",
  "application/rtfd",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export type IngestAssetKind = "pdf" | "deck" | "email" | "rtf" | "image";

const EXT_RE = /\.(pptx|key|pdf|eml|msg|rtf|rtfd|png|jpe?g|webp|gif)$/i;

export function ingestFileKind(file: { name?: string; type?: string }): IngestAssetKind | null {
  const name = (file.name ?? "").toLowerCase();
  const type = (file.type ?? "").toLowerCase();
  // Name/type RTF before PDF: some browsers label .rtf as application/pdf.
  if (isRtfFile(file)) return "rtf";
  if (name.endsWith(".pdf") || type === "application/pdf") return "pdf";
  if (name.endsWith(".eml") || name.endsWith(".msg") || type === "message/rfc822") return "email";
  if (
    type.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif)$/.test(name)
  ) {
    return "image";
  }
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
    mime === "application/rtf" ||
    mime === "text/rtf" ||
    mime === "application/x-rtf" ||
    mime === "application/rtfd"
  ) {
    return "rtf";
  }
  if (mime.startsWith("image/")) return "image";
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
  if (
    fromName &&
    ["pdf", "pptx", "key", "eml", "msg", "rtf", "rtfd", "png", "jpg", "jpeg", "webp", "gif"].includes(
      fromName,
    )
  ) {
    if (fromName === "rtfd") return "rtf";
    if (fromName === "jpeg") return "jpg";
    return fromName;
  }
  if (mime === "application/pdf") return "pdf";
  if (mime === "message/rfc822") return "eml";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "pptx";
  if (mime.includes("keynote")) return "key";
  if (mime === "application/vnd.ms-outlook") return "msg";
  if (
    mime === "application/rtf" ||
    mime === "text/rtf" ||
    mime === "application/x-rtf" ||
    mime === "application/rtfd"
  ) {
    return "rtf";
  }
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return null;
}

export function isIngestFile(file: { name?: string; type?: string }): boolean {
  if (ingestFileKind(file)) return true;
  const type = (file.type ?? "").toLowerCase();
  if (type === "application/pdf" || type === "message/rfc822") return true;
  if (type.startsWith("image/")) return true;
  if (isRtfFile(file)) return true;
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
    ".rtf",
    ".rtfd",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "message/rfc822",
    "application/rtf",
    "text/rtf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
  ].join(",");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
