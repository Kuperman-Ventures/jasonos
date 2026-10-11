import { NextResponse } from "next/server";
import {
  JASONOS_AUTH_RETURN_COOKIE,
  authReturnCookieOptions,
  safeNextPath,
} from "@/lib/auth/session";

/**
 * Remembers the in-app path to open after Google / magic-link.
 * OAuth redirectTo must stay query-free so Supabase does not fall back to Site URL
 * (College Tracker).
 */
export async function POST(request: Request) {
  let next = "/";
  try {
    const body = (await request.json()) as { next?: string };
    next = safeNextPath(body.next);
  } catch {
    next = "/";
  }

  const response = NextResponse.json({ ok: true, next });
  const secure = new URL(request.url).protocol === "https:";
  response.cookies.set(JASONOS_AUTH_RETURN_COOKIE, next, authReturnCookieOptions(secure));
  return response;
}
