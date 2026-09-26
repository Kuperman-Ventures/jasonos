import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  adminSiteUrl,
  buildAdminHygiene,
  buildAdminPulse,
  mapAdminMember,
  scorecardKeyMode,
  type AdminMemberRow,
} from "@/lib/admin";
import { listActivity } from "@/lib/activity-log";
import { aiGatewayAvailable, collegeAiModelId } from "@/lib/ai-model";
import { authConfigured, isSession, isSuperAdmin, requireCollegeSession } from "@/lib/auth";
import { schoolNeedsCommonAppFill } from "@/lib/common-app-grid";
import { listSchools, supabaseConfigured } from "@/lib/db";
import { resolveMemberAvatarUrl } from "@/lib/member-avatars";

export const runtime = "nodejs";

function authAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function listAdminMembers(): Promise<AdminMemberRow[]> {
  if (!supabaseConfigured()) {
    return [
      mapAdminMember({
        id: "jason",
        displayName: "Local",
        email: "local@dev",
        role: "super_admin",
        uiVisible: true,
        authUserId: "local-dev",
        avatarUrl: null,
        lastSignInAt: null,
      }),
    ];
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    db: { schema: "college" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db
    .from("members")
    .select("id, email, display_name, role, ui_visible, auth_user_id, avatar_path, oauth_avatar_url")
    .order("id");
  if (error) throw error;

  const auth = authAdmin();
  const rows: AdminMemberRow[] = [];
  for (const row of data ?? []) {
    let lastSignInAt: string | null = null;
    const authUserId = typeof row.auth_user_id === "string" ? row.auth_user_id : null;
    if (authUserId) {
      const { data: userData } = await auth.auth.admin.getUserById(authUserId);
      lastSignInAt = userData.user?.last_sign_in_at ?? null;
    }
    rows.push(
      mapAdminMember({
        id: row.id as string,
        displayName: (row.display_name as string) || (row.id as string),
        email: (row.email as string | null) ?? null,
        role: (row.role as string) || "guest",
        uiVisible: Boolean(row.ui_visible),
        authUserId,
        avatarUrl: resolveMemberAvatarUrl(
          (row.avatar_path as string | null) ?? null,
          (row.oauth_avatar_url as string | null) ?? null,
        ),
        lastSignInAt,
      }),
    );
  }
  return rows;
}

export async function GET() {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const [schools, activity, members] = await Promise.all([
      listSchools(),
      listActivity(150),
      listAdminMembers(),
    ]);
    const schoolActivity = activity.find((entry) => entry.entityType === "school");
    const needsCommonApp = schools.filter(
      (school) => !school.archived && schoolNeedsCommonAppFill(school),
    ).length;
    const pulse = buildAdminPulse({
      schools,
      needsCommonApp,
      lastSchoolActivityAt: schoolActivity?.createdAt ?? null,
      lastSchoolActivitySummary: schoolActivity?.summary ?? null,
      siteUrl: adminSiteUrl(),
      supabase: supabaseConfigured(),
      auth: authConfigured(),
      aiGateway: aiGatewayAvailable(),
      aiModel: collegeAiModelId(),
      scorecard: scorecardKeyMode(),
    });
    const hygiene = buildAdminHygiene(schools);
    return NextResponse.json({
      members,
      pulse,
      hygiene,
      activity,
      loginUrl: `${pulse.siteUrl}/login`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load admin overview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
