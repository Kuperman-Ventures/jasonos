import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { JASONOS_MCP_INSTRUCTIONS, registerJasonosTools } from "@/lib/mcp/register";
import { JASONOS_MCP_RESOURCE_URL, mcpTokenConfigured, verifyMcpBearer } from "@/lib/mcp/auth";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const mcpHandler = createMcpHandler(
  (server) => {
    registerJasonosTools(server);
  },
  {
    serverInfo: { name: "jasonos", version: "0.1.0" },
    instructions: JASONOS_MCP_INSTRUCTIONS,
  }
);

const authenticated = withMcpAuth(mcpHandler, verifyMcpBearer, {
  required: true,
  resourceUrl: JASONOS_MCP_RESOURCE_URL,
});

function guard(request: Request) {
  if (!mcpTokenConfigured()) {
    return Response.json(
      {
        error: "JasonOS MCP is not configured. Set JASONOS_MCP_TOKEN in the Vercel project env.",
      },
      { status: 503 }
    );
  }
  return authenticated(request);
}

export { guard as GET, guard as POST, guard as DELETE };
