import { randomUUID } from "node:crypto";
import { isHttpsRedirect, oauthJson, oauthOptions } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return oauthOptions();
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((uri): uri is string => typeof uri === "string" && isHttpsRedirect(uri))
    : [];
  if (Array.isArray(body.redirect_uris) && body.redirect_uris.length > 0 && redirectUris.length === 0) {
    return oauthJson({ error: "invalid_redirect_uri" }, 400);
  }
  return oauthJson(
    {
      client_id: randomUUID(),
      client_name: typeof body.client_name === "string" ? body.client_name : "Claude",
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    201
  );
}
