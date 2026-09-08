import { JASONOS_MCP_RESOURCE_URL, oauthJson, oauthOptions, protectedResourceMetadata } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

/** Cursor GETs this with no query and must 404 so it keeps using mcp.json headers. */
export function OPTIONS() {
  return oauthOptions();
}

export function GET(request: Request) {
  const resource = new URL(request.url).searchParams.get("resource")?.replace(/\/$/, "") ?? "";
  if (resource && resource === JASONOS_MCP_RESOURCE_URL.replace(/\/$/, "")) {
    return oauthJson(protectedResourceMetadata());
  }
  return new Response(null, { status: 404 });
}

export function POST() {
  return new Response(null, { status: 404 });
}
