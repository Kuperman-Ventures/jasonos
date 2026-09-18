// GET /api/auth/microsoft/callback
// Exchanges the OAuth code for tokens and stores them in jasonos.user_integrations
// (provider=outlook). Single-user app: owner is the first Supabase auth user.
// Only jason.kuperman@outlook.com is accepted.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  MICROSOFT_OAUTH_SCOPES,
  OUTLOOK_ACCOUNT_EMAIL,
  OUTLOOK_PROVIDER,
  microsoftOAuthBase,
} from "@/lib/integrations/outlook-tokens";

export const runtime = "nodejs";

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GraphMe {
  mail?: string | null;
  userPrincipalName?: string | null;
  displayName?: string | null;
}

function settingsError(origin: string, message: string) {
  return NextResponse.redirect(
    `${origin}/settings?outlook_error=${encodeURIComponent(message)}`
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
    return NextResponse.json(
      { error: "No code returned from Microsoft" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const expected = cookieStore.get("microsoft_oauth_state")?.value;
  if (!expected || expected !== state) {
    return settingsError(origin, "Outlook sign-in expired. Click Connect again.");
  }
  cookieStore.delete("microsoft_oauth_state");

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Microsoft OAuth env vars not configured" },
      { status: 500 }
    );
  }

  const tokenRes = await fetch(`${microsoftOAuthBase()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}/api/auth/microsoft/callback`,
      grant_type: "authorization_code",
      scope: MICROSOFT_OAUTH_SCOPES,
    }),
  });
  const tokens = (await tokenRes.json()) as TokenResponse;
  if (!tokenRes.ok || tokens.error || !tokens.access_token) {
    console.error("[microsoft/callback] token exchange failed:", tokens);
    return settingsError(
      origin,
      tokens.error_description ?? tokens.error ?? "Token exchange failed"
    );
  }

  const meRes = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );
  const me = meRes.ok ? ((await meRes.json()) as GraphMe) : {};
  const email = (me.mail || me.userPrincipalName || "").trim().toLowerCase();
  if (email !== OUTLOOK_ACCOUNT_EMAIL.toLowerCase()) {
    return settingsError(
      origin,
      `Signed in as ${email || "another account"}. Pick ${OUTLOOK_ACCOUNT_EMAIL}.`
    );
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "jasonos" }, auth: { persistSession: false } }
  );

  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1 });
  const ownerId = users?.users?.[0]?.id ?? null;
  if (!ownerId) {
    return NextResponse.json(
      { error: "No user found in Supabase Auth. Create a user first." },
      { status: 500 }
    );
  }

  const { data: existing } = await sb
    .from("user_integrations")
    .select("refresh_token")
    .eq("user_id", ownerId)
    .eq("provider", OUTLOOK_PROVIDER)
    .maybeSingle();

  const expiresAt = new Date(
    Date.now() + (tokens.expires_in ?? 3600) * 1000
  ).toISOString();

  const { error: upsertError } = await sb.from("user_integrations").upsert(
    {
      user_id: ownerId,
      provider: OUTLOOK_PROVIDER,
      scopes: (tokens.scope || MICROSOFT_OAUTH_SCOPES).split(" ").filter(Boolean),
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? existing?.refresh_token ?? null,
      expires_at: expiresAt,
      metadata: {
        email: me.mail || me.userPrincipalName || OUTLOOK_ACCOUNT_EMAIL,
        name: me.displayName ?? null,
      },
    },
    { onConflict: "user_id,provider" }
  );

  if (upsertError) {
    console.error("[microsoft/callback] upsert failed:", upsertError);
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.redirect(`${origin}/settings?outlook_connected=1`);
}
