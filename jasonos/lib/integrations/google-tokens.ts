import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { envConfigured } from "@/lib/integrations/_base";

export const GOOGLE_ADVISORS = "google";
export const GOOGLE_GMAIL = "google_gmail";
export const GOOGLE_PROVIDERS = [GOOGLE_ADVISORS, GOOGLE_GMAIL] as const;

export type GoogleProvider = (typeof GOOGLE_PROVIDERS)[number];

export const GMAIL_ACCOUNT_EMAIL = "jskuperman@gmail.com";
export const ADVISORS_ACCOUNT_EMAIL = "jason@kupermanadvisors.com";

export interface GoogleAccessToken {
  provider: GoogleProvider;
  token: string;
  accountEmail: string;
}

export interface GoogleConnectionStatus {
  advisorsConnected: boolean;
  gmailConnected: boolean;
  advisorsEmail: string | null;
  gmailEmail: string | null;
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
} | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) return null;
  return { access_token: j.access_token, expires_in: j.expires_in ?? 3600 };
}

function accountEmailFor(provider: GoogleProvider): string {
  return provider === GOOGLE_GMAIL ? GMAIL_ACCOUNT_EMAIL : ADVISORS_ACCOUNT_EMAIL;
}

async function loadAccessToken(provider: GoogleProvider): Promise<string | null> {
  if (!envConfigured("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")) {
    return null;
  }
  try {
    const sb = createServiceRoleClient();
    const { data } = await sb
      .from("user_integrations")
      .select("access_token, refresh_token, expires_at")
      .eq("provider", provider)
      .maybeSingle();
    if (!data) return null;
    if (
      data.access_token &&
      data.expires_at &&
      Date.parse(data.expires_at) - Date.now() > 60_000
    ) {
      return data.access_token;
    }
    if (data.refresh_token) {
      const refreshed = await refreshAccessToken(data.refresh_token);
      if (refreshed) {
        const expiresAt = new Date(
          Date.now() + refreshed.expires_in * 1000
        ).toISOString();
        await sb
          .from("user_integrations")
          .update({
            access_token: refreshed.access_token,
            expires_at: expiresAt,
          })
          .eq("provider", provider);
        return refreshed.access_token;
      }
      return data.access_token;
    }
    return data.access_token;
  } catch {
    return null;
  }
}

export async function getGoogleAccessToken(
  provider: GoogleProvider = GOOGLE_ADVISORS
): Promise<string | null> {
  return loadAccessToken(provider);
}

export async function listGoogleAccessTokens(): Promise<GoogleAccessToken[]> {
  const out: GoogleAccessToken[] = [];
  for (const provider of GOOGLE_PROVIDERS) {
    const token = await loadAccessToken(provider);
    if (token) {
      out.push({ provider, token, accountEmail: accountEmailFor(provider) });
    }
  }
  return out;
}

export async function isGoogleGmailConnected(): Promise<boolean> {
  return Boolean(await loadAccessToken(GOOGLE_GMAIL));
}

function emailFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const email = (metadata as { email?: unknown }).email;
  return typeof email === "string" && email.trim() ? email.trim() : null;
}

export async function getGoogleConnectionStatus(): Promise<GoogleConnectionStatus> {
  const empty: GoogleConnectionStatus = {
    advisorsConnected: false,
    gmailConnected: false,
    advisorsEmail: null,
    gmailEmail: null,
  };
  if (!envConfigured("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")) {
    return empty;
  }
  try {
    const sb = createServiceRoleClient();
    const { data } = await sb
      .from("user_integrations")
      .select("provider, metadata, refresh_token, access_token")
      .in("provider", [...GOOGLE_PROVIDERS]);
    const rows = data ?? [];
    const advisors = rows.find((row) => row.provider === GOOGLE_ADVISORS);
    const gmail = rows.find((row) => row.provider === GOOGLE_GMAIL);
    const connected = (row: (typeof rows)[number] | undefined) =>
      Boolean(row?.refresh_token || row?.access_token);
    return {
      advisorsConnected: connected(advisors),
      gmailConnected: connected(gmail),
      advisorsEmail:
        emailFromMetadata(advisors?.metadata) ??
        (advisors ? ADVISORS_ACCOUNT_EMAIL : null),
      gmailEmail:
        emailFromMetadata(gmail?.metadata) ??
        (gmail ? GMAIL_ACCOUNT_EMAIL : null),
    };
  } catch {
    return empty;
  }
}
