// GET /api/auth/microsoft
// Redirects to Microsoft identity (consumers tenant) for jason.kuperman@outlook.com.
// Scopes include Mail.Read and Calendars.Read so calendar sync can be added later
// without another consent.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  MICROSOFT_OAUTH_SCOPES,
  OUTLOOK_ACCOUNT_EMAIL,
  microsoftOAuthBase,
} from "@/lib/integrations/outlook-tokens";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "MICROSOFT_CLIENT_ID env var not set" },
      { status: 500 }
    );
  }

  const { origin } = new URL(req.url);
  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("microsoft_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/microsoft/callback`,
    response_type: "code",
    response_mode: "query",
    scope: MICROSOFT_OAUTH_SCOPES,
    state,
    prompt: "select_account consent",
    login_hint: OUTLOOK_ACCOUNT_EMAIL,
  });

  return NextResponse.redirect(`${microsoftOAuthBase()}/authorize?${params}`);
}
