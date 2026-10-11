import { NextResponse } from "next/server";
import { isJasonosEmail } from "@/lib/auth/allowlist";
import {
  JASONOS_UNLOCK_COOKIE,
  googleUnlockAllowed,
  safeNextPath,
  unlockCookieOptions,
  unlockCookieValue,
} from "@/lib/auth/session";
import { createAuthServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
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

  // Google / magic link only create a session. Passkey enrollment unlocks
  // for 7 days, unless the emergency Google unlock switch is on.
  if (googleUnlockAllowed()) {
    const stamp = await unlockCookieValue();
    const dest = new URL(next, url.origin);
    const response = NextResponse.redirect(dest);
    if (stamp) {
      response.cookies.set(
        JASONOS_UNLOCK_COOKIE,
        stamp,
        unlockCookieOptions(url.protocol === "https:")
      );
    }
    return response;
  }

  const enroll = new URL(`/login?enroll=1&next=${encodeURIComponent(next)}`, url.origin);
  enroll.searchParams.set("error", "enroll_required");
  return NextResponse.redirect(enroll);
}
