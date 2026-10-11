import { createHash, timingSafeEqual } from "node:crypto";
import { JASONOS_PRM_URL, OAUTH_CORS, verifyJwt, wwwAuthenticate } from "./oauth";

export const JASONOS_MCP_RESOURCE_URL = "https://jasonos.vercel.app/api/mcp";
export const JASONOS_MCP_SERVICE_NAME = "jasonos_mcp";

export type McpSecret = {
  hash: string;
  plaintext?: string;
  /** When true, Settings should rewrite access_token_hash from the trusted plaintext. */
  rewriteHash?: boolean;
};

export function hashMcpToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function tokensEqual(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function pickMcpToken(fromSettings?: string | null, fromEnv?: string | null): string | undefined {
  const settings = fromSettings?.trim();
  if (settings) return settings;
  const env = fromEnv?.trim();
  return env || undefined;
}

export function extractBearer(header: string | null | undefined): string | undefined {
  if (!header) return undefined;
  const match = header.match(/^Bearer\s+(\S+)/i);
  return match?.[1];
}

/**
 * Prefer a stored hash. If both plaintext and hash are present and disagree,
 * trust the plaintext and ask the loader to rewrite the row as a hash of it.
 */
export function mcpSecretFromConfig(config: unknown): McpSecret | undefined {
  const cfg = (config ?? {}) as { access_token?: unknown; access_token_hash?: unknown };
  const hash = typeof cfg.access_token_hash === "string" ? cfg.access_token_hash.trim() : "";
  const plaintext = typeof cfg.access_token === "string" ? cfg.access_token.trim() : "";

  if (plaintext && hash) {
    const fromPlain = hashMcpToken(plaintext);
    if (tokensEqual(hash, fromPlain)) return { hash };
    return { hash: fromPlain, plaintext, rewriteHash: true };
  }
  if (hash) return { hash };
  if (plaintext) return { hash: hashMcpToken(plaintext), plaintext, rewriteHash: true };
  return undefined;
}

export function mcpSecretFromEnv(fromEnv?: string | null): McpSecret | undefined {
  const env = fromEnv?.trim();
  if (!env) return undefined;
  return { hash: hashMcpToken(env), plaintext: env };
}

export function bearerMatches(secret: McpSecret, provided: string): boolean {
  if (tokensEqual(secret.hash, hashMcpToken(provided))) return true;
  if (secret.plaintext && tokensEqual(secret.plaintext, provided)) return true;
  if (verifyJwt(provided, secret.hash)?.typ === "access") return true;
  if (secret.plaintext && verifyJwt(provided, secret.plaintext)?.typ === "access") return true;
  return false;
}

export function mcpSigningSecret(secret: McpSecret): string {
  return secret.hash;
}

async function rewriteMcpHash(
  db: ReturnType<Awaited<typeof import("./db")>["publicDb"]>,
  rowId: string,
  hash: string
) {
  const { data } = await db
    .from("service_connections")
    .select("config")
    .eq("id", rowId)
    .maybeSingle();
  const prev = (data?.config ?? {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...prev, access_token_hash: hash };
  delete next.access_token;
  await db
    .from("service_connections")
    .update({ config: next, updated_at: new Date().toISOString() })
    .eq("id", rowId);
}

async function loadSettingsMcpSecret(): Promise<McpSecret | undefined> {
  try {
    const { publicDb } = await import("./db");
    const db = publicDb();
    const { data } = await db
      .from("service_connections")
      .select("id,config")
      .eq("service_name", JASONOS_MCP_SERVICE_NAME)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return undefined;
    const secret = mcpSecretFromConfig(data.config);
    if (secret?.rewriteHash && secret.plaintext && typeof data.id === "string") {
      await rewriteMcpHash(db, data.id, secret.hash).catch(() => {
        // Auth still works from in-memory plaintext; rewrite is best-effort.
      });
    }
    return secret;
  } catch {
    return undefined;
  }
}

/** Settings hash/token first, then JASONOS_MCP_TOKEN. */
export async function resolveMcpSecret(): Promise<McpSecret | undefined> {
  return (await loadSettingsMcpSecret()) ?? mcpSecretFromEnv(process.env.JASONOS_MCP_TOKEN);
}

/** Signing material for MCP JWTs. Prefer the stored hash so plaintext need not sit in memory. */
export async function resolveMcpToken(): Promise<string | undefined> {
  const secret = await resolveMcpSecret();
  return secret ? mcpSigningSecret(secret) : undefined;
}

export async function mcpTokenConfigured(): Promise<boolean> {
  return Boolean(await resolveMcpSecret());
}

/**
 * Accepts the Settings password or a Cowork/Claude login token.
 * Unauthenticated 401s point Cowork at the login metadata (path-specific,
 * so Cursor's root well-known probe still 404s and keeps using its header).
 */
export async function authorizeMcpRequest(request: Request): Promise<Response | null> {
  const expected = await resolveMcpSecret();
  if (!expected) {
    return Response.json(
      {
        error:
          "JasonOS is not open yet. Open Settings, find Cursor & Claude, Generate password, Save.",
      },
      { status: 503 }
    );
  }
  const provided = extractBearer(request.headers.get("authorization"));
  if (provided && bearerMatches(expected, provided)) return null;
  return Response.json(
    { error: "Unauthorized", resource_metadata: JASONOS_PRM_URL },
    { status: 401, headers: { ...OAUTH_CORS, "WWW-Authenticate": wwwAuthenticate() } }
  );
}
