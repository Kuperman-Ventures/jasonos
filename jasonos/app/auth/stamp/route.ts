import { NextResponse } from "next/server";
import { isJasonosEmail } from "@/lib/auth/allowlist";
import { hasRecentPasskeyAmr } from "@/lib/auth/passkey-amr";
import {
  JASONOS_UNLOCK_COOKIE,
  unlockCookieOptions,
  unlockCookieValue,
} from "@/lib/auth/session";
import { createAuthServerClient } from "@/lib/supabase/server";

/**
 * Sets the signed 7-day unlock cookie only after a recent passkey / WebAuthn
 * authentication (JWT `amr`). The request body is ignored — clients cannot
 * self-attest "method: passkey".
 */
export async function POST(request: Request) {
  // Discard body so a forged `{ method: "passkey" }` cannot unlock.
  try {
    await request.json();
  } catch {
    // empty body is fine
  }

  const auth = await createAuthServerClient();
  const { data: userData, error: userError } = await auth.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  if (!isJasonosEmail(userData.user.email)) {
    await auth.auth.signOut();
    return NextResponse.json({ error: "not_jason" }, { status: 403 });
  }

  const { data: claimsData, error: claimsError } = await auth.auth.getClaims();
  if (claimsError || !claimsData?.claims) {
    return NextResponse.json({ error: "passkey_required" }, { status: 403 });
  }

  const claims = claimsData.claims as {
    amr?: unknown;
    iat?: number;
  };
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    !hasRecentPasskeyAmr(claims.amr, nowSeconds, {
      tokenIssuedAt: typeof claims.iat === "number" ? claims.iat : null,
    })
  ) {
    return NextResponse.json({ error: "passkey_required" }, { status: 403 });
  }

  const stamp = await unlockCookieValue();
  if (!stamp) {
    return NextResponse.json({ error: "unlock_secret_missing" }, { status: 503 });
  }

  const response = NextResponse.json({ ok: true });
  const secure = new URL(request.url).protocol === "https:";
  response.cookies.set(JASONOS_UNLOCK_COOKIE, stamp, unlockCookieOptions(secure));
  return response;
}
