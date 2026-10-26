import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { envConfigured } from "@/lib/integrations/_base";
import {
  googleMissingScopesMessage,
  missingGoogleScopes,
  normalizeOauthScopes,
} from "@/lib/integrations/google-scopes";

export const GOOGLE_ADVISORS = "google";
export const GOOGLE_GMAIL = "google_gmail";
export const GOOGLE_PROVIDERS = [GOOGLE_ADVISORS, GOOGLE_GMAIL] as const;

export type GoogleProvider = (typeof GOOGLE_PROVIDERS)[number];

/** Preferred personal Gmail address shown in Settings / login hints. */
export const GMAIL_ACCOUNT_EMAIL = "jasonkuperman@gmail.com";
/** Older personal Gmail that still holds mail history — accept either. */
export const GMAIL_ACCOUNT_EMAIL_ALIASES = [
  "jasonkuperman@gmail.com",
  "jskuperman@gmail.com",
] as const;
export const ADVISORS_ACCOUNT_EMAIL = "jason@kupermanadvisors.com";

export function isPersonalGmailAccount(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  return (GMAIL_ACCOUNT_EMAIL_ALIASES as readonly string[]).includes(e);
}

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
  advisorsError: string | null;
  gmailError: string | null;
  /** Capability scopes granted on the Advisors token that JasonOS still needs. */
  advisorsMissingScopes: string[];
  /** Capability scopes granted on personal Gmail that JasonOS still needs. */
  gmailMissingScopes: string[];
}

export const EMPTY_GOOGLE_CONNECTION_STATUS: GoogleConnectionStatus = {
  advisorsConnected: false,
  gmailConnected: false,
  advisorsNeedsReconnect: false,
  gmailNeedsReconnect: false,
  advisorsEmail: null,
  gmailEmail: null,
  advisorsError: null,
  gmailError: null,
  advisorsMissingScopes: [],
  gmailMissingScopes: [],
};

export function googleSignInExpiredMessage(accountEmail: string): string {
  if (isPersonalGmailAccount(accountEmail)) {
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
  email: string | null;
  scopes: string[];
  missingScopes: string[];
  error?: string;
};

function emptyLoadedToken(): LoadedToken {
  return {
    configured: false,
    token: null,
    email: null,
    scopes: [],
    missingScopes: [],
  };
}

async function resolveGrantedScopes(input: {
  accessToken: string | null;
  storedScopes: unknown;
  rowId: string;
  sb: ReturnType<typeof createServiceRoleClient>;
}): Promise<string[]> {
  const fromDb = normalizeOauthScopes(
    Array.isArray(input.storedScopes)
      ? (input.storedScopes as string[])
      : typeof input.storedScopes === "string"
        ? input.storedScopes
        : null
  );
  if (fromDb.length > 0) return fromDb;
  if (!input.accessToken) return [];

  // Older grants may have an empty scopes column — ask Google once, then persist.
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(input.accessToken)}`
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { scope?: string };
    const live = normalizeOauthScopes(json.scope);
    if (live.length > 0) {
      await input.sb
        .from("user_integrations")
        .update({ scopes: live })
        .eq("id", input.rowId);
    }
    return live;
  } catch {
    return [];
  }
}

function accountLabelFor(
  provider: GoogleProvider
): "Advisors Google" | "Personal Gmail" {
  return provider === GOOGLE_GMAIL ? "Personal Gmail" : "Advisors Google";
}

async function loadAccessTokenDetailed(
  provider: GoogleProvider
): Promise<LoadedToken> {
  if (!envConfigured("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")) {
    return emptyLoadedToken();
  }
  try {
    const sb = createServiceRoleClient();
    // Multiple Auth users can leave duplicate provider rows; always take the
    // freshest grant. maybeSingle() alone errors when >1 row matches.
    const { data, error } = await sb
      .from("user_integrations")
      .select("id, access_token, refresh_token, expires_at, metadata, scopes")
      .eq("provider", provider)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return emptyLoadedToken();

    const rowId = data.id as string;
    const email =
      emailFromMetadata(data.metadata) ?? accountEmailFor(provider);
    const label = accountLabelFor(provider);

    const finish = async (
      loaded: Omit<LoadedToken, "email" | "scopes" | "missingScopes"> & {
        token: string | null;
      }
    ): Promise<LoadedToken> => {
      const scopes = loaded.configured
        ? await resolveGrantedScopes({
            accessToken: loaded.token,
            storedScopes: data.scopes,
            rowId,
            sb,
          })
        : [];
      // Usable token with no recorded scopes → treat as incomplete until reconnect.
      const missing =
        loaded.configured && loaded.token ? missingGoogleScopes(scopes) : [];
      const scopeError =
        loaded.token && missing.length > 0
          ? googleMissingScopesMessage({
              accountEmail: email || accountEmailFor(provider),
              accountLabel: label,
              missing,
            })
          : null;
      return {
        ...loaded,
        email,
        scopes,
        missingScopes: missing,
        error: loaded.error ?? scopeError ?? undefined,
      };
    };

    if (data.access_token && tokenStillValid(data.expires_at)) {
      return finish({ configured: true, token: data.access_token });
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
          .eq("id", rowId);
        return finish({ configured: true, token: refreshed.access_token });
      }
      if (data.access_token && tokenStillValid(data.expires_at)) {
        return finish({ configured: true, token: data.access_token });
      }
      console.warn(
        "[google-tokens] refresh failed",
        provider,
        refreshed.error ?? "unknown"
      );
      return finish({
        configured: true,
        token: null,
        error: googleSignInExpiredMessage(email || accountEmailFor(provider)),
      });
    }

    if (data.access_token && tokenStillValid(data.expires_at)) {
      return finish({ configured: true, token: data.access_token });
    }
    return finish({
      configured: Boolean(data.access_token || data.refresh_token),
      token: null,
      error: googleSignInExpiredMessage(email || accountEmailFor(provider)),
    });
  } catch {
    return emptyLoadedToken();
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
      accountEmail: loaded.email ?? accountEmailFor(provider),
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
  if (!envConfigured("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")) {
    return { ...EMPTY_GOOGLE_CONNECTION_STATUS };
  }
  try {
    const [advisors, gmail] = await Promise.all([
      loadAccessTokenDetailed(GOOGLE_ADVISORS),
      loadAccessTokenDetailed(GOOGLE_GMAIL),
    ]);
    const advisorsMissingScopes = advisors.missingScopes;
    const gmailMissingScopes = gmail.missingScopes;
    return {
      advisorsConnected: advisors.configured,
      gmailConnected: gmail.configured,
      // Token unusable OR missing required capabilities → reconnect.
      advisorsNeedsReconnect:
        advisors.configured &&
        (!advisors.token || advisorsMissingScopes.length > 0),
      gmailNeedsReconnect:
        gmail.configured && (!gmail.token || gmailMissingScopes.length > 0),
      advisorsEmail: advisors.email,
      gmailEmail: gmail.email,
      advisorsError: advisors.error ?? null,
      gmailError: gmail.error ?? null,
      advisorsMissingScopes,
      gmailMissingScopes,
    };
  } catch {
    return { ...EMPTY_GOOGLE_CONNECTION_STATUS };
  }
}
