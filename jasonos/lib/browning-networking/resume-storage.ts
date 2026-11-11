import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

const BUCKET = "resumes";

function safeFilename(name: string): string {
  const cleaned = name.replace(/[^\w.\- ()]+/g, "").trim();
  return cleaned || "resume.pdf";
}

export function browningResumeStoragePath(
  handoffId: string,
  filename: string
): string {
  return `browning/${handoffId}/${safeFilename(filename)}`;
}

export async function uploadBrowningResume(input: {
  handoffId: string;
  filename: string;
  bytes: Buffer;
}): Promise<string | null> {
  const path = browningResumeStoragePath(input.handoffId, input.filename);
  const sb = createServiceRoleClient();
  const contentType = input.filename.toLowerCase().endsWith(".pdf")
    ? "application/pdf"
    : input.filename.toLowerCase().endsWith(".doc")
      ? "application/msword"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const { error } = await sb.storage.from(BUCKET).upload(path, input.bytes, {
    contentType,
    upsert: true,
  });
  if (error) {
    console.error("[browning-networking] resume upload", error.message);
    return null;
  }
  return path;
}

export async function downloadBrowningResumeFromStorage(
  storagePath: string
): Promise<{ filename: string; bytes: Buffer } | null> {
  const path = storagePath.trim();
  if (!path) return null;
  const sb = createServiceRoleClient();
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) {
    console.error("[browning-networking] resume download", error?.message);
    return null;
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  const filename = path.split("/").pop() || "resume.pdf";
  return { filename, bytes };
}
