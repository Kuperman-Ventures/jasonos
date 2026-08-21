// GET /api/auth/google
// Redirects to Google OAuth consent screen.
// Scopes: Gmail read + Calendar read (covers both gmail.ts + google-calendar.ts).
// ?account=gmail stores a second token for jskuperman@gmail.com (provider=google_gmail).

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  ADVISORS_ACCOUNT_EMAIL,
  GMAIL_ACCOUNT_EMAIL,
  GOOGLE_ADVISORS,
  GOOGLE_GMAIL,
  type GoogleProvider,
} from "@/lib/integrations/google-tokens";

export const runtime = "nodejs";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "email",
  "profile",
].join(" ");

export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID env var not set" },
      { status: 500 }
    );
  }

  const { origin, searchParams } = new URL(req.url);
  const provider: GoogleProvider =
    searchParams.get("account") === "gmail" ? GOOGLE_GMAIL : GOOGLE_ADVISORS;
  const nonce = randomBytes(16).toString("hex");
  const state = `${provider}:${nonce}`;

  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const redirectUri = `${origin}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "select_account consent",
    include_granted_scopes: "true",
    state,
    login_hint:
      provider === GOOGLE_GMAIL ? GMAIL_ACCOUNT_EMAIL : ADVISORS_ACCOUNT_EMAIL,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );
}
