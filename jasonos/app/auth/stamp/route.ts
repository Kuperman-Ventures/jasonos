import { NextResponse } from "next/server";
import { isJasonosEmail } from "@/lib/auth/allowlist";
import {
  JASONOS_UNLOCK_COOKIE,
  unlockCookieOptions,
  unlockCookieValue,
} from "@/lib/auth/session";
import { createAuthServerClient } from "@/lib/supabase/server";

/**
 * Sets the signed 7-day unlock cookie. Only called after Face ID / Touch ID
 * sign-in or after registering a passkey on this device.
 */
export async function POST(request: Request) {
  let method = "";
  try {
    const body = (await request.json()) as { method?: string };
    method = body.method?.trim() || "";
  } catch {
    method = "";
  }
  if (method !== "passkey") {
    return NextResponse.json({ error: "passkey_required" }, { status: 403 });
  }

  const auth = await createAuthServerClient();
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  if (!isJasonosEmail(data.user.email)) {
    await auth.auth.signOut();
    return NextResponse.json({ error: "not_jason" }, { status: 403 });
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
