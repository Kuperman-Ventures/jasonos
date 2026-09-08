import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const JASONOS_ORIGIN = "https://jasonos.vercel.app";
export const JASONOS_MCP_RESOURCE_URL = `${JASONOS_ORIGIN}/api/mcp`;
export const JASONOS_OAUTH_ISSUER = `${JASONOS_ORIGIN}/api/mcp/oauth`;
export const JASONOS_PRM_URL = `${JASONOS_ORIGIN}/.well-known/oauth-protected-resource/api/mcp`;

export const OAUTH_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version",
  "Access-Control-Expose-Headers": "WWW-Authenticate, MCP-Protocol-Version",
  "Cache-Control": "no-store",
};

export function oauthJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...OAUTH_CORS, "Content-Type": "application/json" },
  });
}

export function withOAuthCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(OAUTH_CORS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function oauthOptions() {
  return new Response(null, { status: 204, headers: OAUTH_CORS });
}

export function authorizationServerMetadata() {
  return {
    issuer: JASONOS_OAUTH_ISSUER,
    authorization_endpoint: `${JASONOS_OAUTH_ISSUER}/authorize`,
    token_endpoint: `${JASONOS_OAUTH_ISSUER}/token`,
    registration_endpoint: `${JASONOS_OAUTH_ISSUER}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["jasonos"],
  };
}

export function protectedResourceMetadata() {
  return {
    resource: JASONOS_MCP_RESOURCE_URL,
    authorization_servers: [JASONOS_OAUTH_ISSUER],
    bearer_methods_supported: ["header"],
    scopes_supported: ["jasonos"],
  };
}

export function wwwAuthenticate() {
  return `Bearer error="invalid_token", resource_metadata="${JASONOS_PRM_URL}"`;
}

function b64urlJson(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = b64urlJson({ alg: "HS256", typ: "JWT" });
  const body = b64urlJson(payload);
  const data = `${header}.${body}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyJwt(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const data = `${header}.${body}`;
  const expected = createHmac("sha256", secret).update(data).digest("base64url");
  if (!sigsEqual(expected, sig)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    const exp = typeof payload.exp === "number" ? payload.exp : 0;
    if (exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function sigsEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function pkceS256(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function issueAuthCode(
  secret: string,
  input: { redirectUri: string; codeChallenge: string; clientId: string }
) {
  return signJwt(
    {
      typ: "auth_code",
      redirect_uri: input.redirectUri,
      code_challenge: input.codeChallenge,
      client_id: input.clientId,
      exp: Math.floor(Date.now() / 1000) + 10 * 60,
    },
    secret
  );
}

export function issueAccessToken(secret: string) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: signJwt({ typ: "access", exp: now + 60 * 60 * 24 * 30 }, secret),
    refresh_token: signJwt({ typ: "refresh", exp: now + 60 * 60 * 24 * 90 }, secret),
    token_type: "bearer" as const,
    expires_in: 60 * 60 * 24 * 30,
    scope: "jasonos",
  };
}

export function isHttpsRedirect(uri: string) {
  try {
    const url = new URL(uri);
    if (url.protocol === "https:") return true;
    if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export type AuthorizeParams = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
  resource: string | null;
};

export function parseAuthorizeParams(
  params: URLSearchParams
): { ok: true; value: AuthorizeParams } | { ok: false; error: string } {
  const responseType = params.get("response_type") || "code";
  if (responseType !== "code") return { ok: false, error: "JasonOS only supports login with a code." };

  const clientId = params.get("client_id")?.trim() || "";
  if (!clientId) return { ok: false, error: "Claude did not send a client id." };

  const redirectUri = params.get("redirect_uri")?.trim() || "";
  if (!redirectUri) return { ok: false, error: "Claude did not send a return address." };
  if (!isHttpsRedirect(redirectUri)) {
    return { ok: false, error: "The return address must be https (or localhost)." };
  }

  const method = params.get("code_challenge_method") || "S256";
  if (method !== "S256") return { ok: false, error: "JasonOS only supports S256 login." };

  const codeChallenge = params.get("code_challenge")?.trim() || "";
  if (codeChallenge.length < 43) return { ok: false, error: "Claude did not send a valid login challenge." };

  const resource = params.get("resource");
  if (resource && resource.replace(/\/$/, "") !== JASONOS_MCP_RESOURCE_URL.replace(/\/$/, "")) {
    return { ok: false, error: "Claude asked for a different site than JasonOS." };
  }

  return {
    ok: true,
    value: {
      clientId,
      redirectUri,
      codeChallenge,
      state: params.get("state"),
      resource,
    },
  };
}

export function buildAuthorizeRedirect(
  secret: string,
  params: AuthorizeParams
): { ok: true; redirect: string } | { ok: false; error: string } {
  if (!secret) return { ok: false, error: "JasonOS is not open yet. Generate a password in Settings first." };
  const code = issueAuthCode(secret, {
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    clientId: params.clientId,
  });
  const url = new URL(params.redirectUri);
  url.searchParams.set("code", code);
  if (params.state) url.searchParams.set("state", params.state);
  return { ok: true, redirect: url.toString() };
}

export function exchangeOAuthToken(
  secret: string,
  get: (key: string) => string
): { status: number; body: Record<string, unknown> } {
  const grant = get("grant_type");
  if (grant === "refresh_token") {
    const payload = verifyJwt(get("refresh_token"), secret);
    if (payload?.typ !== "refresh") return { status: 400, body: { error: "invalid_grant" } };
    return { status: 200, body: issueAccessToken(secret) };
  }
  if (grant !== "authorization_code") {
    return { status: 400, body: { error: "unsupported_grant_type" } };
  }
  const payload = verifyJwt(get("code"), secret);
  if (payload?.typ !== "auth_code") return { status: 400, body: { error: "invalid_grant" } };
  if (payload.redirect_uri !== get("redirect_uri")) return { status: 400, body: { error: "invalid_grant" } };
  if (payload.code_challenge !== pkceS256(get("code_verifier"))) {
    return { status: 400, body: { error: "invalid_grant" } };
  }
  return { status: 200, body: issueAccessToken(secret) };
}

export async function readOAuthParams(request: Request): Promise<(key: string) => string> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    return (key: string) => {
      const value = json?.[key];
      return typeof value === "string" ? value : "";
    };
  }
  const form = await request.formData().catch(() => null);
  return (key: string) => {
    const value = form?.get(key);
    return typeof value === "string" ? value : "";
  };
}
