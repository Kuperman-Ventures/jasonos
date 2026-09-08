import { authorizationServerMetadata, oauthJson, oauthOptions } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return oauthOptions();
}

export function GET() {
  return oauthJson(authorizationServerMetadata());
}
