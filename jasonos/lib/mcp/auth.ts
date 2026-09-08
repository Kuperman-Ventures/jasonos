import { timingSafeEqual } from "node:crypto";

export const JASONOS_MCP_RESOURCE_URL = "https://jasonos.vercel.app/api/mcp";
export const JASONOS_MCP_SERVICE_NAME = "jasonos_mcp";

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

async function loadSettingsMcpToken(): Promise<string | undefined> {
  try {
    const { publicDb } = await import("./db");
    const db = publicDb();
    const { data } = await db
      .from("service_connections")
      .select("config")
      .eq("service_name", JASONOS_MCP_SERVICE_NAME)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const token = (data?.config as { access_token?: string } | null)?.access_token;
    return typeof token === "string" ? token.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Settings token first, then JASONOS_MCP_TOKEN. */
export async function resolveMcpToken(): Promise<string | undefined> {
  return pickMcpToken(await loadSettingsMcpToken(), process.env.JASONOS_MCP_TOKEN);
}

export async function mcpTokenConfigured(): Promise<boolean> {
  return Boolean(await resolveMcpToken());
}

/**
 * Static bearer check with no OAuth discovery.
 * Cursor ignores configured Authorization headers when a server advertises
 * RFC 9728 protected-resource metadata (WWW-Authenticate + well-known).
 * Return 401/503 with a JSON body only.
 */
export async function authorizeMcpRequest(request: Request): Promise<Response | null> {
  const expected = await resolveMcpToken();
  if (!expected) {
    return Response.json(
      {
        error:
          "JasonOS is not open to Cursor yet. Open Settings, find Cursor & Claude, Generate password, Save.",
      },
      { status: 503 }
    );
  }
  const provided = extractBearer(request.headers.get("authorization"));
  if (!provided || !tokensEqual(expected, provided)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
