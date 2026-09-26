import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/db";
import {
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  AVATAR_MIME,
  avatarExtension,
  getMemberAvatarPath,
  publicAvatarUrl,
  setMemberAvatarPath,
  storageAdmin,
} from "@/lib/member-avatars";

export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Avatar upload needs Supabase" }, { status: 503 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image file" }, { status: 400 });
  }
  if (!AVATAR_MIME.has(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG, WebP, or GIF" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > AVATAR_MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 2 MB" }, { status: 400 });
  }

  const ext = avatarExtension(file.type);
  if (!ext) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  const path = `${session.member.id}/avatar-${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const storage = storageAdmin().storage.from(AVATAR_BUCKET);
  const previous = await getMemberAvatarPath(session.member.id);

  const { error: uploadError } = await storage.upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  try {
    await setMemberAvatarPath(session.member.id, path);
  } catch (error) {
    await storage.remove([path]);
    const message = error instanceof Error ? error.message : "Could not save avatar";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (previous && previous !== path) {
    await storage.remove([previous]).catch(() => undefined);
  }

  return NextResponse.json({
    ok: true,
    avatarUrl: publicAvatarUrl(path),
    avatarPath: path,
  });
}

export async function DELETE() {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Avatar upload needs Supabase" }, { status: 503 });
  }

  const previous = await getMemberAvatarPath(session.member.id);
  await setMemberAvatarPath(session.member.id, null);
  if (previous) {
    await storageAdmin().storage.from(AVATAR_BUCKET).remove([previous]).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, avatarUrl: null });
}
