import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { envConfigured } from "@/lib/integrations/_base";
import { OUTLOOK_WRAP_EMAIL } from "@/lib/integrations/unwrap-forwarded-mail";

export const OUTLOOK_PROVIDER = "outlook";
export const OUTLOOK_ACCOUNT_EMAIL = OUTLOOK_WRAP_EMAIL;

/** Requested at first consent so calendar sync can be added later without re-consent. */
export const MICROSOFT_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "https://graph.microsoft.com/Mail.Read",
  "https://graph.microsoft.com/Calendars.Read",
  "https://graph.microsoft.com/User.Read",
].join(" ");

export interface OutlookConnectionStatus {
  /** A grant is stored, even if the access token can no longer be refreshed. */
  connected: boolean;
  needsReconnect: boolean;
  email: string | null;
  error: string | null;
  oauthConfigured: boolean;
}

export interface OutlookAccountAccess {
  configured: boolean;
  token: string | null;
  accountEmail: string;
  error?: string;
  oauthConfigured: boolean;
}

export function microsoftOauthConfigured(): boolean {
  return envConfigured("MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET");
}

export function emptyOutlookConnectionStatus(): OutlookConnectionStatus {
  return {
    connected: false,
    needsReconnect: false,
    email: null,
    error: null,
    oauthConfigured: microsoftOauthConfigured(),
  };
}

export function microsoftTenant(): string {
  return (process.env.MICROSOFT_TENANT || "consumers").trim() || "consumers";
}

export function microsoftOAuthBase(): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(microsoftTenant())}/oauth2/v2.0`;
}

export function outlookSignInExpiredMessage(): string {
  return `${OUTLOOK_ACCOUNT_EMAIL}: sign-in expired. Reconnect Outlook in Settings.`;
}

function tokenStillValid(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return Date.parse(expiresAt) - Date.now() > 60_000;
}

function emailFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const email = (metadata as { email?: unknown }).email;
  return typeof email === "string" && email.trim() ? email.trim() : null;
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  expired?: boolean;
}> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { error: "Microsoft OAuth client is not configured." };
  }
  const res = await fetch(`${microsoftOAuthBase()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: MICROSOFT_OAUTH_SCOPES,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || body.error || !body.access_token) {
    const code = body.error ?? "";
    const detail = body.error_description ?? code;
    const expired = /invalid_grant|interaction_required|consent_required/i.test(
      `${code} ${detail}`
    );
    return {
      error: detail ? detail.slice(0, 180) : `refresh ${res.status}`,
      expired,
    };
  }
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_in: body.expires_in ?? 3600,
  };
}

type LoadedToken = {
  configured: boolean;
  token: string | null;
  email: string | null;
  error?: string;
  oauthConfigured: boolean;
};

async function loadOutlookToken(): Promise<LoadedToken> {
  const oauthConfigured = microsoftOauthConfigured();
  if (!envConfigured("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")) {
    return { configured: false, token: null, email: null, oauthConfigured };
  }
  try {
    const sb = createServiceRoleClient();
    const { data } = await sb
      .from("user_integrations")
      .select("access_token, refresh_token, expires_at, metadata")
      .eq("provider", OUTLOOK_PROVIDER)
      .maybeSingle();
    if (!data) {
      return { configured: false, token: null, email: null, oauthConfigured };
    }

    const email = emailFromMetadata(data.metadata) ?? OUTLOOK_ACCOUNT_EMAIL;
    if (data.access_token && tokenStillValid(data.expires_at)) {
      return { configured: true, token: data.access_token, email, oauthConfigured };
    }

    if (!data.refresh_token) {
      return {
        configured: true,
        token: null,
        email,
        error: outlookSignInExpiredMessage(),
        oauthConfigured,
      };
    }

    if (!oauthConfigured) {
      return {
        configured: true,
        token: null,
        email,
        error:
          "Microsoft OAuth is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET, then reconnect Outlook in Settings.",
        oauthConfigured,
      };
    }

    const refreshed = await refreshAccessToken(data.refresh_token);
    if (refreshed.access_token) {
      const expiresAt = new Date(
        Date.now() + (refreshed.expires_in ?? 3600) * 1000
      ).toISOString();
      await sb
        .from("user_integrations")
        .update({
          access_token: refreshed.access_token,
          // Microsoft rotates refresh tokens. The previous one may stop working.
          refresh_token: refreshed.refresh_token ?? data.refresh_token,
          expires_at: expiresAt,
        })
        .eq("provider", OUTLOOK_PROVIDER);
      return {
        configured: true,
        token: refreshed.access_token,
        email,
        oauthConfigured,
      };
    }

    console.warn("[outlook-tokens] refresh failed", refreshed.error ?? "unknown");
    return {
      configured: true,
      token: null,
      email,
      error: refreshed.expired
        ? outlookSignInExpiredMessage()
        : refreshed.error ?? outlookSignInExpiredMessage(),
      oauthConfigured,
    };
  } catch (err) {
    console.error("[outlook-tokens] load failed", err);
    return {
      configured: true,
      token: null,
      email: OUTLOOK_ACCOUNT_EMAIL,
      error: "Could not read the Outlook connection.",
      oauthConfigured,
    };
  }
}

export async function getOutlookAccountAccess(): Promise<OutlookAccountAccess> {
  const loaded = await loadOutlookToken();
  return {
    configured: loaded.configured,
    token: loaded.token,
    accountEmail: loaded.email ?? OUTLOOK_ACCOUNT_EMAIL,
    error: loaded.error,
    oauthConfigured: loaded.oauthConfigured,
  };
}

export async function getOutlookConnectionStatus(): Promise<OutlookConnectionStatus> {
  const loaded = await loadOutlookToken();
  return {
    connected: loaded.configured,
    needsReconnect: loaded.configured && !loaded.token,
    email: loaded.email,
    error: loaded.error ?? null,
    oauthConfigured: loaded.oauthConfigured,
  };
}
