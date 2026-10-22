// GET /api/auth/wispr — start Wispr Notetaker MCP OAuth (PKCE + dynamic client registration).

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireJasonosUser } from "@/lib/auth/require";
import { beginWisprAuthorization } from "@/lib/integrations/wispr-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let userId: string;
  try {
    const session = await requireJasonosUser();
    userId = session.userId;
  } catch {
    const { origin } = new URL(req.url);
    return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent("/settings")}`);
  }

  const { origin } = new URL(req.url);
  const state = randomBytes(16).toString("hex");

  try {
    const { authorizationUrl, codeVerifier } = await beginWisprAuthorization({
      userId,
      origin,
      state,
    });
    const cookieStore = await cookies();
    cookieStore.set("wispr_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    cookieStore.set("wispr_oauth_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start Wispr sign-in.";
    return NextResponse.redirect(
      `${origin}/settings?wispr_error=${encodeURIComponent(message)}`
    );
  }
}
