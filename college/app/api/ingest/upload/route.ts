import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/db";
import {
  INGEST_BUCKET,
  INGEST_MAX_BYTES,
  INGEST_MIME,
  ingestExtension,
  ingestStorageAdmin,
  publicIngestUrl,
} from "@/lib/ingest-assets";

export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { error: "File storage needs Supabase. In local seed mode, assets stay as temporary previews." },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file" }, { status: 400 });
  }
  const mime = file.type || "application/octet-stream";
  if (!INGEST_MIME.has(mime) && !/\.(pdf|png|jpe?g|webp|gif)$/i.test(file.name)) {
    return NextResponse.json(
      { error: "Use a PDF, PNG, JPG, WebP, or GIF" },
      { status: 400 },
    );
  }
  if (file.size <= 0 || file.size > INGEST_MAX_BYTES) {
    return NextResponse.json({ error: "File must be under 25 MB" }, { status: 400 });
  }

  const resolvedMime = INGEST_MIME.has(mime)
    ? mime
    : file.name.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : file.name.toLowerCase().endsWith(".png")
        ? "image/png"
        : file.name.toLowerCase().endsWith(".webp")
          ? "image/webp"
          : file.name.toLowerCase().endsWith(".gif")
            ? "image/gif"
            : "image/jpeg";

  const ext = ingestExtension(resolvedMime, file.name);
  if (!ext) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const path = `${session.member.id}/ingest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const storage = ingestStorageAdmin().storage.from(INGEST_BUCKET);
  const { error } = await storage.upload(path, bytes, {
    contentType: resolvedMime,
    upsert: false,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    assetPath: path,
    assetUrl: publicIngestUrl(path),
    mimeType: resolvedMime,
    fileName: file.name,
    bytes: file.size,
  });
}
