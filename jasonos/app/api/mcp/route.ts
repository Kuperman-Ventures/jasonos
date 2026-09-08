import { createMcpHandler } from "mcp-handler";
import { JASONOS_MCP_INSTRUCTIONS, registerJasonosTools } from "@/lib/mcp/register";
import { authorizeMcpRequest } from "@/lib/mcp/auth";

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

async function guard(request: Request) {
  const denied = await authorizeMcpRequest(request);
  if (denied) return denied;
  return mcpHandler(request);
}

export { guard as GET, guard as POST, guard as DELETE };
