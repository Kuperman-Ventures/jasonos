import { exchangeOAuthToken, oauthJson, oauthOptions, readOAuthParams } from "@/lib/mcp/oauth";
import { resolveMcpToken } from "@/lib/mcp/auth";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return oauthOptions();
}

export async function POST(request: Request) {
  const secret = await resolveMcpToken();
  if (!secret) return oauthJson({ error: "server_error" }, 503);
  const get = await readOAuthParams(request);
  const result = exchangeOAuthToken(secret, get);
  return oauthJson(result.body, result.status);
}
