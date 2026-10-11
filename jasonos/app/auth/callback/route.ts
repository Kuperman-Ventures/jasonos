import { NextResponse } from "next/server";
import { isJasonosEmail } from "@/lib/auth/allowlist";
import {
  JASONOS_UNLOCK_COOKIE,
  safeNextPath,
  unlockCookieOptions,
  unlockCookieValue,
} from "@/lib/auth/session";
import { createAuthServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const enroll = url.searchParams.get("enroll") === "1";
  const next = safeNextPath(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth", url.origin));
  }

  const auth = await createAuthServerClient();
  const { data, error } = await auth.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=auth", url.origin));
  }

  if (!isJasonosEmail(data.user.email)) {
    await auth.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=not_jason", url.origin));
  }

  const dest = enroll
    ? new URL(`/login?enroll=1&next=${encodeURIComponent(next)}`, url.origin)
    : new URL(next, url.origin);
  const response = NextResponse.redirect(dest);
  response.cookies.set(JASONOS_UNLOCK_COOKIE, unlockCookieValue(), unlockCookieOptions(url.protocol === "https:"));
  return response;
}
