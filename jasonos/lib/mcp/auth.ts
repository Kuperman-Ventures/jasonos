import { timingSafeEqual } from "node:crypto";
import type { AuthInfo } from "@modelcontextprotocol/server";

export const JASONOS_MCP_RESOURCE_URL = "https://jasonos.vercel.app/api/mcp";

export function tokensEqual(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Bearer-token check for the HTTP MCP endpoint.
 * Returns undefined when the token is missing or wrong so mcp-handler can 401.
 */
export function verifyMcpBearer(_req: Request, bearer?: string): AuthInfo | undefined {
  const expected = process.env.JASONOS_MCP_TOKEN;
  if (!expected || !bearer) return undefined;
  if (!tokensEqual(expected, bearer)) return undefined;
  return {
    token: bearer,
    clientId: "jasonos-mcp",
    scopes: ["jasonos"],
    // Static personal token; set a far-future expiry because the SDK
    // rejects AuthInfo with no expiresAt.
    expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
  };
}

export function mcpTokenConfigured(): boolean {
  return Boolean(process.env.JASONOS_MCP_TOKEN);
}
