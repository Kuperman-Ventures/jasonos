import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isJasonosEmail } from "@/lib/auth/allowlist";
import {
  JASONOS_AUTH_RETURN_COOKIE,
  JASONOS_UNLOCK_COOKIE,
  authReturnCookieOptions,
  googleUnlockAllowed,
  safeNextPath,
  unlockCookieOptions,
  unlockCookieValue,
} from "@/lib/auth/session";
import { createAuthServerClient } from "@/lib/supabase/server";

function clearAuthReturnCookie(response: NextResponse, secure: boolean) {
  response.cookies.set(JASONOS_AUTH_RETURN_COOKIE, "", {
    ...authReturnCookieOptions(secure),
    maxAge: 0,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const secure = url.protocol === "https:";
  const jar = await cookies();
  // Prefer query next (legacy), else the short-lived return cookie set before OAuth.
  const next = safeNextPath(
    url.searchParams.get("next") ?? jar.get(JASONOS_AUTH_RETURN_COOKIE)?.value
  );

  if (!code) {
    const response = NextResponse.redirect(new URL("/login?error=auth", url.origin));
    clearAuthReturnCookie(response, secure);
    return response;
  }

  const auth = await createAuthServerClient();
  const { data, error } = await auth.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    const response = NextResponse.redirect(new URL("/login?error=auth", url.origin));
    clearAuthReturnCookie(response, secure);
    return response;
  }

  if (!isJasonosEmail(data.user.email)) {
    await auth.auth.signOut();
    const response = NextResponse.redirect(new URL("/login?error=not_jason", url.origin));
    clearAuthReturnCookie(response, secure);
    return response;
  }

  // Google / magic link only create a session. Passkey enrollment unlocks
  // for 7 days, unless the emergency Google unlock switch is on.
  if (googleUnlockAllowed()) {
    const stamp = await unlockCookieValue();
    const dest = new URL(next, url.origin);
    const response = NextResponse.redirect(dest);
    clearAuthReturnCookie(response, secure);
    if (stamp) {
      response.cookies.set(JASONOS_UNLOCK_COOKIE, stamp, unlockCookieOptions(secure));
    }
    return response;
  }

  const enroll = new URL(`/login?enroll=1&next=${encodeURIComponent(next)}`, url.origin);
  enroll.searchParams.set("error", "enroll_required");
  const response = NextResponse.redirect(enroll);
  clearAuthReturnCookie(response, secure);
  return response;
}
