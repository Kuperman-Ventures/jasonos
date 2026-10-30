import { authorizeMcpRequest } from "@/lib/mcp/auth";
import { OAUTH_CORS, oauthOptions } from "@/lib/mcp/oauth";
import {
  publishSessionSchema,
  publishWebinarDigest,
  publishWebinarSession,
} from "@/lib/webinars/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...OAUTH_CORS, "Cache-Control": "no-store" },
  });
}

export function OPTIONS() {
  return oauthOptions();
}

/** HTTP fallback for scheduled Claude runs missing JasonOS MCP webinar tools. */
export async function POST(request: Request) {
  const denied = await authorizeMcpRequest(request);
  if (denied) return denied;
  try {
    const raw = (await request.json().catch(() => null)) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("Send a JSON object.");
    }
    const body = raw as Record<string, unknown>;
    const kind = body.kind === "digest" ? "digest" : body.kind === "session" ? "session" : null;
    if (!kind) throw new Error("kind must be 'session' or 'digest'.");
    const payload_json =
      typeof body.payload_json === "string"
        ? body.payload_json
        : JSON.stringify(body.payload ?? body);
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload_json);
    } catch {
      throw new Error("payload_json is not valid JSON.");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("payload_json must be a JSON object.");
    }
    if (kind === "session") {
      const input = publishSessionSchema.parse(parsed);
      return json(await publishWebinarSession(input));
    }
    const dig = parsed as {
      week_start?: unknown;
      body_md?: unknown;
      session_ids?: unknown;
    };
    if (typeof dig.week_start !== "string" || typeof dig.body_md !== "string") {
      throw new Error("digest payload needs week_start and body_md strings.");
    }
    return json(
      await publishWebinarDigest({
        week_start: dig.week_start,
        body_md: dig.body_md,
        session_ids: Array.isArray(dig.session_ids)
          ? dig.session_ids.filter((id): id is string => typeof id === "string")
          : undefined,
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /invalid|must be|Send a JSON|not valid JSON|empty|cannot be|kind must|Unknown session|week_start/.test(
      message
    )
      ? 400
      : 500;
    return json({ ok: false, error: message }, status);
  }
}
