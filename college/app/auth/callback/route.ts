import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/server";
import { findMemberForUser } from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const safeNext = next && next.startsWith("/") ? next : "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth", url.origin));
  }

  const auth = await createAuthServerClient();
  const { data, error } = await auth.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=auth", url.origin));
  }

  const email = data.user.email?.trim().toLowerCase() ?? null;
  const member = await findMemberForUser(data.user.id, email);
  if (!member) {
    await auth.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=not_a_member", url.origin));
  }
  if (!member.uiVisible) {
    await auth.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=not_active", url.origin));
  }

  return NextResponse.redirect(new URL(safeNext, url.origin));
}
