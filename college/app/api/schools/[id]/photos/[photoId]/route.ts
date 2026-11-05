import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/db";
import {
  SCHOOL_PHOTO_BUCKET,
  deleteFamilyPhoto,
  schoolPhotoStorageAdmin,
} from "@/lib/school-family-photos";

type Context = { params: Promise<{ id: string; photoId: string }> };

export async function DELETE(_request: Request, context: Context) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Photo delete needs Supabase" }, { status: 503 });
  }

  const { id: schoolId, photoId } = await context.params;
  try {
    const row = await deleteFamilyPhoto(photoId);
    if (!row || row.school_id !== schoolId) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }
    await schoolPhotoStorageAdmin()
      .storage.from(SCHOOL_PHOTO_BUCKET)
      .remove([row.storage_path])
      .catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete photo";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
