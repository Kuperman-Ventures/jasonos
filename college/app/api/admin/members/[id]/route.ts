import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { isSession, isSuperAdmin, requireCollegeSession } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const { id } = await context.params;
  const memberId = id?.trim();
  if (!memberId) return NextResponse.json({ error: "Member id required" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as {
    email?: string | null;
    uiVisible?: boolean;
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("email" in body) {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    patch.email = email || null;
  }
  if (typeof body.uiVisible === "boolean") {
    patch.ui_visible = body.uiVisible;
  }
  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    db: { schema: "college" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db
    .from("members")
    .update(patch)
    .eq("id", memberId)
    .select("id, email, display_name, role, ui_visible, auth_user_id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordActivity({
    actorId: session.member.id,
    actorName: session.member.displayName,
    action: "update",
    entityType: "system",
    entityId: memberId,
    summary: `Updated household access for ${data.display_name || memberId}`,
    detail: patch,
  });

  return NextResponse.json({
    member: {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      role: data.role,
      uiVisible: data.ui_visible,
      hasAuth: Boolean(data.auth_user_id),
    },
  });
}
