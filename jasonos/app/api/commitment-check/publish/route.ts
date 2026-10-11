import { authorizeMcpRequest } from "@/lib/mcp/auth";
import { OAUTH_CORS, oauthOptions } from "@/lib/mcp/oauth";
import { publishCommitmentCheck } from "@/lib/commitments/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { ...OAUTH_CORS, "Cache-Control": "no-store" } });
}

export function OPTIONS() {
  return oauthOptions();
}

/** HTTP fallback for scheduled Claude runs that never receive the JasonOS MCP tools. */
export async function POST(request: Request) {
  const denied = await authorizeMcpRequest(request);
  if (denied) return denied;
  try {
    const raw = (await request.json().catch(() => null)) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Send a JSON object.");
    const body = raw as Record<string, unknown>;
    const date = typeof body.date === "string" ? body.date : undefined;
    const payload_json =
      typeof body.payload_json === "string" ? body.payload_json : JSON.stringify(body.payload ?? body);
    return json(await publishCommitmentCheck({ date, payload_json }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /invalid|must be|Send a JSON|not valid JSON|empty|cannot be/.test(message) ? 400 : 500;
    return json({ ok: false, error: message }, status);
  }
}
