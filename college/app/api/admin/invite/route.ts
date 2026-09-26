import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { adminSiteUrl, loginUrlForSite } from "@/lib/admin";
import { recordActivity } from "@/lib/activity-log";
import { isSession, isSuperAdmin, requireCollegeSession } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Generate a one-time magic link for a household member email.
 * Jason can copy/paste it to Kyle (or open it himself for testing).
 */
export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { memberId?: string; email?: string };
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    db: { schema: "college" },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  let displayName = email;
  if (body.memberId?.trim()) {
    const { data, error } = await db
      .from("members")
      .select("id, email, display_name, ui_visible")
      .eq("id", body.memberId.trim())
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (!data.ui_visible) {
      return NextResponse.json(
        { error: "Turn this person on for the site before sending a link." },
        { status: 400 },
      );
    }
    email = (data.email as string | null)?.trim().toLowerCase() || "";
    displayName = (data.display_name as string) || body.memberId;
  }
  if (!email) {
    return NextResponse.json({ error: "Set an email on this member first." }, { status: 400 });
  }

  const site = adminSiteUrl();
  const redirectTo = `${site}/auth/callback?next=${encodeURIComponent("/")}`;
  const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await auth.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const actionLink =
    data.properties?.action_link ||
    (data as { action_link?: string }).action_link ||
    null;

  await recordActivity({
    actorId: session.member.id,
    actorName: session.member.displayName,
    action: "invite",
    entityType: "system",
    entityId: body.memberId?.trim() || email,
    summary: `Generated sign-in link for ${displayName}`,
    detail: { email },
  });

  return NextResponse.json({
    email,
    displayName,
    loginUrl: loginUrlForSite(site),
    magicLink: actionLink,
  });
}
