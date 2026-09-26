import { NextResponse } from "next/server";
import { collegeDb, supabaseConfigured } from "./db";
import {
  oauthAvatarFromMetadata,
  resolveMemberAvatarUrl,
  setMemberOauthAvatarUrl,
} from "./member-avatars";
import { createAuthServerClient } from "./supabase/server";

export type MemberRole = "super_admin" | "parent" | "student" | "sibling" | "guest";

export type CollegeMember = {
  id: string;
  email: string | null;
  displayName: string;
  role: MemberRole;
  uiVisible: boolean;
  authUserId: string | null;
  avatarPath: string | null;
  oauthAvatarUrl: string | null;
  avatarUrl: string | null;
};

export type CollegeSession = {
  userId: string;
  email: string;
  member: CollegeMember;
};

type MemberRow = {
  id: string;
  email: string | null;
  display_name: string;
  role: MemberRole;
  ui_visible: boolean;
  auth_user_id: string | null;
  avatar_path?: string | null;
  oauth_avatar_url?: string | null;
};

function mapMember(row: MemberRow): CollegeMember {
  const avatarPath = row.avatar_path ?? null;
  const oauthAvatarUrl = row.oauth_avatar_url?.trim() || null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    uiVisible: row.ui_visible,
    authUserId: row.auth_user_id,
    avatarPath,
    oauthAvatarUrl,
    avatarUrl: resolveMemberAvatarUrl(avatarPath, oauthAvatarUrl),
  };
}

export function authConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function findMemberForUser(userId: string, email: string | null): Promise<CollegeMember | null> {
  if (!supabaseConfigured()) return null;
  const db = collegeDb();
  const byId = await db.from("members").select("*").eq("auth_user_id", userId).maybeSingle();
  if (byId.data) return mapMember(byId.data as MemberRow);

  const normalized = email?.trim().toLowerCase() ?? "";
  if (!normalized) return null;
  const byEmail = await db.from("members").select("*").eq("email", normalized).maybeSingle();
  if (!byEmail.data) return null;

  const member = mapMember(byEmail.data as MemberRow);
  if (!member.authUserId) {
    await db
      .from("members")
      .update({ auth_user_id: userId, updated_at: new Date().toISOString() })
      .eq("id", member.id)
      .is("auth_user_id", null);
    member.authUserId = userId;
  }
  return member;
}

export async function getCollegeSession(): Promise<CollegeSession | null> {
  if (!authConfigured() || !supabaseConfigured()) return null;
  const auth = await createAuthServerClient();
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user?.id) return null;
  const email = data.user.email?.trim().toLowerCase() ?? "";
  const member = await findMemberForUser(data.user.id, email || null);
  if (!member || !member.uiVisible) return null;

  const oauthAvatarUrl = oauthAvatarFromMetadata(data.user.user_metadata);
  if (oauthAvatarUrl && oauthAvatarUrl !== member.oauthAvatarUrl) {
    await setMemberOauthAvatarUrl(member.id, oauthAvatarUrl).catch((err) => {
      console.error("oauth avatar sync failed", err);
    });
    member.oauthAvatarUrl = oauthAvatarUrl;
    member.avatarUrl = resolveMemberAvatarUrl(member.avatarPath, oauthAvatarUrl);
  }

  return { userId: data.user.id, email, member };
}

export async function requireCollegeSession(): Promise<CollegeSession | NextResponse> {
  // Local seed mode: no Supabase env → allow the UI without login.
  if (!supabaseConfigured()) {
    return {
      userId: "local-dev",
      email: "local@dev",
      member: {
        id: "jason",
        email: "local@dev",
        displayName: "Local",
        role: "super_admin",
        uiVisible: true,
        authUserId: null,
        avatarPath: null,
        oauthAvatarUrl: null,
        avatarUrl: null,
      },
    };
  }
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "Login is not configured. Add NEXT_PUBLIC_SUPABASE_ANON_KEY." },
      { status: 503 },
    );
  }
  const session = await getCollegeSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  return session;
}

export function isSession(value: CollegeSession | NextResponse): value is CollegeSession {
  return !(value instanceof NextResponse);
}

export function isSuperAdmin(session: CollegeSession): boolean {
  return session.member.role === "super_admin";
}
