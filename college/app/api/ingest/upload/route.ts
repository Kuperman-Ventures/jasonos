import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/db";
import {
  INGEST_BUCKET,
  INGEST_MAX_BYTES,
  ingestExtension,
  ingestFileKind,
  ingestStorageAdmin,
  isIngestFile,
  publicIngestUrl,
} from "@/lib/ingest-assets";

function resolveMime(file: File): string {
  const type = (file.type || "").toLowerCase();
  if (type && type !== "application/octet-stream") return type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (name.endsWith(".key")) return "application/vnd.apple.keynote";
  if (name.endsWith(".eml")) return "message/rfc822";
  if (name.endsWith(".msg")) return "application/vnd.ms-outlook";
  return type || "application/octet-stream";
}

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
  if (!isIngestFile(file) || !ingestFileKind(file)) {
    return NextResponse.json(
      { error: "Use a PowerPoint, Keynote, PDF or email file." },
      { status: 400 },
    );
  }
  if (file.size <= 0 || file.size > INGEST_MAX_BYTES) {
    return NextResponse.json({ error: "File must be under 25 MB" }, { status: 400 });
  }

  const resolvedMime = resolveMime(file);
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
    kind: ingestFileKind(file),
  });
}
