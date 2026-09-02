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

export interface GoogleAccountAccess {
  provider: GoogleProvider;
  accountEmail: string;
  token: string | null;
  error?: string;
}

export interface GoogleConnectionStatus {
  advisorsConnected: boolean;
  gmailConnected: boolean;
  advisorsNeedsReconnect: boolean;
  gmailNeedsReconnect: boolean;
  advisorsEmail: string | null;
  gmailEmail: string | null;
}

export function googleSignInExpiredMessage(accountEmail: string): string {
  if (accountEmail === GMAIL_ACCOUNT_EMAIL) {
    return `${accountEmail}: sign-in expired. Reconnect personal Gmail in Settings.`;
  }
  return `${accountEmail}: sign-in expired. Reconnect Advisors Google in Settings.`;
}

function tokenStillValid(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return Date.parse(expiresAt) - Date.now() > 60_000;
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token?: string;
  expires_in?: number;
  error?: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { error: "Google OAuth client is not configured." };
  }
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
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { error: `refresh ${res.status}${txt ? `: ${txt.slice(0, 120)}` : ""}` };
  }
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) return { error: "refresh returned no access token" };
  return { access_token: j.access_token, expires_in: j.expires_in ?? 3600 };
}

function accountEmailFor(provider: GoogleProvider): string {
  return provider === GOOGLE_GMAIL ? GMAIL_ACCOUNT_EMAIL : ADVISORS_ACCOUNT_EMAIL;
}

type LoadedToken = {
  configured: boolean;
  token: string | null;
  error?: string;
};

async function loadAccessTokenDetailed(
  provider: GoogleProvider
): Promise<LoadedToken> {
  if (!envConfigured("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")) {
    return { configured: false, token: null };
  }
  try {
    const sb = createServiceRoleClient();
    const { data } = await sb
      .from("user_integrations")
      .select("access_token, refresh_token, expires_at")
      .eq("provider", provider)
      .maybeSingle();
    if (!data) return { configured: false, token: null };

    if (data.access_token && tokenStillValid(data.expires_at)) {
      return { configured: true, token: data.access_token };
    }

    if (data.refresh_token) {
      const refreshed = await refreshAccessToken(data.refresh_token);
      if (refreshed.access_token) {
        const expiresAt = new Date(
          Date.now() + (refreshed.expires_in ?? 3600) * 1000
        ).toISOString();
        await sb
          .from("user_integrations")
          .update({
            access_token: refreshed.access_token,
            expires_at: expiresAt,
          })
          .eq("provider", provider);
        return { configured: true, token: refreshed.access_token };
      }
      if (data.access_token && tokenStillValid(data.expires_at)) {
        return { configured: true, token: data.access_token };
      }
      console.warn(
        "[google-tokens] refresh failed",
        provider,
        refreshed.error ?? "unknown"
      );
      return {
        configured: true,
        token: null,
        error: googleSignInExpiredMessage(accountEmailFor(provider)),
      };
    }

    if (data.access_token && tokenStillValid(data.expires_at)) {
      return { configured: true, token: data.access_token };
    }
    return {
      configured: Boolean(data.access_token || data.refresh_token),
      token: null,
      error: googleSignInExpiredMessage(accountEmailFor(provider)),
    };
  } catch {
    return { configured: false, token: null };
  }
}

async function loadAccessToken(provider: GoogleProvider): Promise<string | null> {
  const loaded = await loadAccessTokenDetailed(provider);
  return loaded.token;
}

export async function getGoogleAccessToken(
  provider: GoogleProvider = GOOGLE_ADVISORS
): Promise<string | null> {
  return loadAccessToken(provider);
}

/** Connected Google accounts, including ones whose sign-in has expired. */
export async function listGoogleAccountAccess(): Promise<GoogleAccountAccess[]> {
  const out: GoogleAccountAccess[] = [];
  for (const provider of GOOGLE_PROVIDERS) {
    const loaded = await loadAccessTokenDetailed(provider);
    if (!loaded.configured && !loaded.token) continue;
    out.push({
      provider,
      accountEmail: accountEmailFor(provider),
      token: loaded.token,
      error: loaded.error,
    });
  }
  return out;
}

export async function listGoogleAccessTokens(): Promise<GoogleAccessToken[]> {
  const out: GoogleAccessToken[] = [];
  for (const account of await listGoogleAccountAccess()) {
    if (!account.token) continue;
    out.push({
      provider: account.provider,
      token: account.token,
      accountEmail: account.accountEmail,
    });
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
    advisorsNeedsReconnect: false,
    gmailNeedsReconnect: false,
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
    const [advisorsToken, gmailToken] = await Promise.all([
      loadAccessToken(GOOGLE_ADVISORS),
      loadAccessToken(GOOGLE_GMAIL),
    ]);
    return {
      advisorsConnected: connected(advisors),
      gmailConnected: connected(gmail),
      advisorsNeedsReconnect: connected(advisors) && !advisorsToken,
      gmailNeedsReconnect: connected(gmail) && !gmailToken,
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
