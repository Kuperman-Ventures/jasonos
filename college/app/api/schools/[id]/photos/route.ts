import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { getSchool, supabaseConfigured } from "@/lib/db";
import {
  SCHOOL_PHOTO_BUCKET,
  SCHOOL_PHOTO_MAX_BYTES,
  buildSchoolPhotoStoragePath,
  insertFamilyPhoto,
  listFamilyPhotosForSchool,
  normalizeImageMime,
  schoolPhotoExtension,
  schoolPhotoStorageAdmin,
} from "@/lib/school-family-photos";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ items: [] });
  }
  const { id } = await context.params;
  try {
    await getSchool(id);
  } catch {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }
  try {
    const items = await listFamilyPhotosForSchool(id);
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load photos";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request, context: Context) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Photo upload needs Supabase" }, { status: 503 });
  }

  const { id: schoolId } = await context.params;
  try {
    await getSchool(schoolId);
  } catch {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a photo from your album" }, { status: 400 });
  }

  const mime = normalizeImageMime(file);
  if (!mime) {
    const typeHint = file.type?.trim() ? ` (got ${file.type})` : "";
    return NextResponse.json(
      {
        error: `Use a JPG, PNG, WebP, GIF, or HEIC photo${typeHint}`,
      },
      { status: 400 },
    );
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }
  if (file.size > SCHOOL_PHOTO_MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return NextResponse.json(
      { error: `Photo must be under 10 MB (this file is ${mb} MB)` },
      { status: 400 },
    );
  }

  const ext = schoolPhotoExtension(mime, file.name);
  if (!ext) {
    return NextResponse.json(
      { error: `Unsupported image type (${mime})` },
      { status: 400 },
    );
  }

  const captionRaw = form.get("caption");
  const caption =
    typeof captionRaw === "string" && captionRaw.trim() ? captionRaw.trim() : "Family photo";
  const visitRaw = form.get("visitDate");
  const visitDate =
    typeof visitRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(visitRaw.trim())
      ? visitRaw.trim()
      : null;

  const path = buildSchoolPhotoStoragePath(schoolId, session.member.id, ext);
  const bytes = Buffer.from(await file.arrayBuffer());
  const storage = schoolPhotoStorageAdmin().storage.from(SCHOOL_PHOTO_BUCKET);

  const { error: uploadError } = await storage.upload(path, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (uploadError) {
    return NextResponse.json(
      { error: `Storage upload failed — ${uploadError.message}` },
      { status: 400 },
    );
  }

  try {
    const photo = await insertFamilyPhoto({
      schoolId,
      uploadedById: session.member.id,
      uploadedByName: session.member.displayName,
      storagePath: path,
      caption,
      visitDate,
      mimeType: mime,
      byteSize: file.size,
    });
    return NextResponse.json({ ok: true, photo });
  } catch (error) {
    await storage.remove([path]).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Could not save photo";
    return NextResponse.json(
      { error: `Saved to storage but database insert failed — ${message}` },
      { status: 400 },
    );
  }
}
