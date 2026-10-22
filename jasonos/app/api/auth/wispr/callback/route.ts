// GET /api/auth/wispr/callback — exchange code for Wispr MCP tokens.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireJasonosUser } from "@/lib/auth/require";
import { finishWisprAuthorization } from "@/lib/integrations/wispr-oauth";
import { testWisprConnection } from "@/lib/integrations/wispr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function settingsError(origin: string, message: string) {
  return NextResponse.redirect(
    `${origin}/settings?wispr_error=${encodeURIComponent(message)}`
  );
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return settingsError(origin, errorDescription || error);
  }
  if (!code) {
    return settingsError(origin, "No code returned from Wispr.");
  }

  let userId: string;
  try {
    const session = await requireJasonosUser();
    userId = session.userId;
  } catch {
    return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent("/settings")}`);
  }

  const cookieStore = await cookies();
  const expected = cookieStore.get("wispr_oauth_state")?.value;
  const codeVerifier = cookieStore.get("wispr_oauth_verifier")?.value;
  cookieStore.delete("wispr_oauth_state");
  cookieStore.delete("wispr_oauth_verifier");

  if (!expected || expected !== state) {
    return settingsError(origin, "Wispr sign-in expired. Click Connect Wispr again.");
  }
  if (!codeVerifier) {
    return settingsError(origin, "Missing PKCE verifier. Click Connect Wispr again.");
  }

  const finished = await finishWisprAuthorization({
    userId,
    origin,
    code,
    codeVerifier,
  });
  if (!finished.ok) {
    return settingsError(origin, finished.error);
  }

  // Best-effort identity fill for the Settings card.
  try {
    await testWisprConnection();
  } catch {
    // ignore
  }

  return NextResponse.redirect(`${origin}/settings?wispr_connected=1`);
}
