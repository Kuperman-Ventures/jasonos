import { NextResponse } from "next/server";
import { isJasonosEmail } from "@/lib/auth/allowlist";
import {
  JASONOS_UNLOCK_COOKIE,
  unlockCookieOptions,
  unlockCookieValue,
} from "@/lib/auth/session";
import { createAuthServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  if (!isJasonosEmail(data.user.email)) {
    await auth.auth.signOut();
    return NextResponse.json({ error: "not_jason" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  const secure = new URL(request.url).protocol === "https:";
  response.cookies.set(JASONOS_UNLOCK_COOKIE, unlockCookieValue(), unlockCookieOptions(secure));
  return response;
}
