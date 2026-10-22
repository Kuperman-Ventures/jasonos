/**
 * Wispr Notetaker MCP OAuth (dynamic client registration + PKCE).
 * Tokens live in public.service_connections for service_name=wispr.
 */
import "server-only";
import {
  discoverAuthorizationServerMetadata,
  discoverOAuthProtectedResourceMetadata,
  exchangeAuthorization,
  refreshAuthorization,
  registerClient,
  startAuthorization,
} from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { createPublicServiceRoleClient } from "@/lib/supabase/server";
import { resolveJasonosOwnerUserId } from "@/lib/integrations/owner";

export const WISPR_SERVICE = "wispr";
export const WISPR_MCP_URL = "https://api.wisprflow.ai/connect/mcp";
export const WISPR_AUTH_SCOPES = "openid profile email offline_access";

export type WisprConnectionConfig = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string | null;
  token_type?: string;
  scope?: string;
  client_id?: string;
  client_secret?: string;
  client_id_issued_at?: number;
  account_name?: string | null;
  account_email?: string | null;
};

type ConnectionRow = {
  user_id?: string | null;
  status?: string | null;
  config?: WisprConnectionConfig | null;
  updated_at?: string | null;
};

export function wisprRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/auth/wispr/callback`;
}

export function wisprClientMetadata(redirectUri: string): OAuthClientMetadata {
  return {
    client_name: "JasonOS",
    redirect_uris: [redirectUri],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "client_secret_post",
    scope: WISPR_AUTH_SCOPES,
  };
}

async function ownerUserId(): Promise<string | null> {
  try {
    return await resolveJasonosOwnerUserId();
  } catch {
    return null;
  }
}

/** Latest Wispr connection row (owner preferred). */
export async function loadWisprConnectionRow(): Promise<ConnectionRow | null> {
  try {
    const sb = createPublicServiceRoleClient();
    const { data } = await sb
      .from("service_connections")
      .select("user_id, status, config, updated_at")
      .eq("service_name", WISPR_SERVICE)
      .order("updated_at", { ascending: false });
    const rows = (data ?? []) as ConnectionRow[];
    if (!rows.length) return null;
    const ownerId = await ownerUserId();
    if (ownerId) {
      const owned = rows.find((row) => row.user_id === ownerId);
      if (owned) return owned;
    }
    return rows.find((row) => row.status === "connected") ?? rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function loadWisprConfig(): Promise<WisprConnectionConfig> {
  const row = await loadWisprConnectionRow();
  return (row?.config ?? {}) as WisprConnectionConfig;
}

export async function saveWisprConfig(
  userId: string,
  patch: Partial<WisprConnectionConfig>,
  opts?: {
    status?: "connected" | "error" | "not_configured";
    message?: string | null;
    /** When true, replace config instead of merging (used on disconnect). */
    replace?: boolean;
  }
): Promise<void> {
  const sb = createPublicServiceRoleClient();
  const existing = opts?.replace ? {} : await loadWisprConfig();
  const config: WisprConnectionConfig = { ...existing, ...patch };
  // Drop empty token fields so disconnect truly clears them.
  for (const key of ["access_token", "refresh_token", "token_type", "scope", "expires_at"] as const) {
    if (config[key] === undefined || config[key] === "") delete config[key];
  }
  const now = new Date().toISOString();
  const status = opts?.status ?? (config.access_token || config.refresh_token ? "connected" : "not_configured");
  const { error } = await sb.from("service_connections").upsert(
    {
      user_id: userId,
      service_name: WISPR_SERVICE,
      status,
      connection_type: "oauth",
      config,
      api_key_masked: config.access_token
        ? `${config.access_token.slice(0, 4)}...${config.access_token.slice(-4)}`
        : null,
      connected_at: status === "connected" ? now : null,
      last_health_check: now,
      health_status: status === "connected" ? "healthy" : status === "error" ? "down" : "unknown",
      health_details: opts?.message ?? null,
      error_message: status === "error" ? opts?.message ?? null : null,
      updated_at: now,
    },
    { onConflict: "user_id,service_name" }
  );
  if (error) throw new Error(error.message);
}

export async function clearWisprTokens(userId: string): Promise<void> {
  const existing = await loadWisprConfig();
  await saveWisprConfig(
    userId,
    {
      client_id: existing.client_id,
      client_secret: existing.client_secret,
      client_id_issued_at: existing.client_id_issued_at,
      account_name: null,
      account_email: null,
    },
    { status: "not_configured", message: "Disconnected.", replace: true }
  );
}

function clientInfoFromConfig(config: WisprConnectionConfig): OAuthClientInformationMixed | undefined {
  if (!config.client_id) return undefined;
  return {
    client_id: config.client_id,
    client_secret: config.client_secret,
    client_id_issued_at: config.client_id_issued_at,
  };
}

function tokensFromConfig(config: WisprConnectionConfig): OAuthTokens | undefined {
  if (!config.access_token && !config.refresh_token) return undefined;
  const expiresAt = config.expires_at ? Date.parse(config.expires_at) : NaN;
  return {
    access_token: config.access_token ?? "",
    refresh_token: config.refresh_token,
    token_type: config.token_type ?? "Bearer",
    scope: config.scope,
    expires_in: Number.isFinite(expiresAt)
      ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
      : undefined,
  };
}

async function ensureRegisteredClient(
  userId: string,
  redirectUri: string
): Promise<OAuthClientInformationMixed> {
  const config = await loadWisprConfig();
  const existing = clientInfoFromConfig(config);
  if (existing?.client_id) return existing;

  const resourceMeta = await discoverOAuthProtectedResourceMetadata(WISPR_MCP_URL);
  const authServer =
    resourceMeta.authorization_servers?.[0] ?? "https://mcp-auth.wisprflow.com";
  const metadata = await discoverAuthorizationServerMetadata(authServer);
  const registered = await registerClient(authServer, {
    metadata,
    clientMetadata: wisprClientMetadata(redirectUri),
  });
  await saveWisprConfig(userId, {
    client_id: registered.client_id,
    client_secret: registered.client_secret,
    client_id_issued_at: registered.client_id_issued_at,
  });
  return registered;
}

/** Build the Wispr authorize URL and PKCE verifier for the browser redirect. */
export async function beginWisprAuthorization(input: {
  userId: string;
  origin: string;
  state: string;
}): Promise<{ authorizationUrl: string; codeVerifier: string }> {
  const redirectUri = wisprRedirectUri(input.origin);
  const clientInformation = await ensureRegisteredClient(input.userId, redirectUri);
  const resourceMeta = await discoverOAuthProtectedResourceMetadata(WISPR_MCP_URL);
  const authServer =
    resourceMeta.authorization_servers?.[0] ?? "https://mcp-auth.wisprflow.com";
  const metadata = await discoverAuthorizationServerMetadata(authServer);
  const { authorizationUrl, codeVerifier } = await startAuthorization(authServer, {
    metadata,
    clientInformation,
    redirectUrl: redirectUri,
    scope: WISPR_AUTH_SCOPES,
    state: input.state,
    resource: new URL(WISPR_MCP_URL),
  });
  return { authorizationUrl: authorizationUrl.toString(), codeVerifier };
}

export async function finishWisprAuthorization(input: {
  userId: string;
  origin: string;
  code: string;
  codeVerifier: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const redirectUri = wisprRedirectUri(input.origin);
    const config = await loadWisprConfig();
    const clientInformation =
      clientInfoFromConfig(config) ??
      (await ensureRegisteredClient(input.userId, redirectUri));
    const resourceMeta = await discoverOAuthProtectedResourceMetadata(WISPR_MCP_URL);
    const authServer =
      resourceMeta.authorization_servers?.[0] ?? "https://mcp-auth.wisprflow.com";
    const metadata = await discoverAuthorizationServerMetadata(authServer);
    const tokens = await exchangeAuthorization(authServer, {
      metadata,
      clientInformation,
      authorizationCode: input.code,
      codeVerifier: input.codeVerifier,
      redirectUri,
      resource: new URL(WISPR_MCP_URL),
    });
    const expiresAt =
      typeof tokens.expires_in === "number"
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null;
    await saveWisprConfig(
      input.userId,
      {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? config.refresh_token,
        expires_at: expiresAt,
        token_type: tokens.token_type,
        scope: tokens.scope,
      },
      { status: "connected", message: "Wispr Notetaker connected." }
    );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Wispr authorization failed.",
    };
  }
}

/** Valid access token, refreshing when needed. */
export async function resolveWisprAccessToken(): Promise<string | null> {
  const config = await loadWisprConfig();
  const tokens = tokensFromConfig(config);
  if (!tokens) return null;

  const expiresAt = config.expires_at ? Date.parse(config.expires_at) : NaN;
  const stillFresh =
    Boolean(config.access_token) &&
    (!Number.isFinite(expiresAt) || expiresAt - Date.now() > 60_000);
  if (stillFresh && config.access_token) return config.access_token;

  if (!config.refresh_token || !config.client_id) return config.access_token ?? null;

  try {
    const resourceMeta = await discoverOAuthProtectedResourceMetadata(WISPR_MCP_URL);
    const authServer =
      resourceMeta.authorization_servers?.[0] ?? "https://mcp-auth.wisprflow.com";
    const metadata = await discoverAuthorizationServerMetadata(authServer);
    const refreshed = await refreshAuthorization(authServer, {
      metadata,
      clientInformation: clientInfoFromConfig(config)!,
      refreshToken: config.refresh_token,
      resource: new URL(WISPR_MCP_URL),
    });
    const nextExpires =
      typeof refreshed.expires_in === "number"
        ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
        : config.expires_at ?? null;
    const ownerId = (await ownerUserId()) ?? (await loadWisprConnectionRow())?.user_id;
    if (ownerId) {
      await saveWisprConfig(
        ownerId,
        {
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token ?? config.refresh_token,
          expires_at: nextExpires,
          token_type: refreshed.token_type,
          scope: refreshed.scope,
        },
        { status: "connected", message: "Wispr Notetaker connected." }
      );
    }
    return refreshed.access_token;
  } catch {
    return config.access_token ?? null;
  }
}

export async function wisprIsConnected(): Promise<boolean> {
  const config = await loadWisprConfig();
  return Boolean(config.access_token || config.refresh_token);
}
