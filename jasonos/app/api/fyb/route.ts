import { authorizeMcpRequest } from "@/lib/mcp/auth";
import { OAUTH_CORS, oauthOptions } from "@/lib/mcp/oauth";
import { getSnapshot, upsertDecision, upsertEntry } from "@/lib/fuck-you-batman/store";

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
export async function GET(request: Request) {
  const denied = await authorizeMcpRequest(request);
  if (denied) return denied;
  try {
    return json(await getSnapshot());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ ok: false, error: message }, 500);
  }
}

export async function POST(request: Request) {
  const denied = await authorizeMcpRequest(request);
  if (denied) return denied;
  try {
    const raw = (await request.json().catch(() => null)) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Send a JSON object.");
    const body = raw as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    const payload = body.payload ?? body.decision_json ?? body.entry_json;
    if (action === "upsert_decision") {
      return json(await upsertDecision(payload));
    }
    if (action === "upsert_entry") {
      return json(await upsertEntry(payload, "claude"));
    }
    throw new Error("action must be upsert_decision or upsert_entry.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /invalid|must be|Send a JSON|not valid JSON|empty|required|action must/.test(message)
      ? 400
      : 500;
    return json({ ok: false, error: message }, status);
  }
}
