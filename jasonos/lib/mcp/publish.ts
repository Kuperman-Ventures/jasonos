import { authorizeMcpRequest } from "./auth";
import { publicDb } from "./db";
import { OAUTH_CORS, oauthOptions } from "./oauth";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MIN_BRIEF_CHARS = 80;
const MAX_BRIEF_CHARS = 80_000;
const MAX_PAYLOAD_CHARS = 400_000;

export function etDate(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/** YYYY-MM-DD in America/New_York, defaulting to today. */
export function resolvePublishDate(raw?: string | null): string {
  const today = etDate();
  const value = raw?.trim();
  if (!value) return today;
  if (!YMD.test(value)) {
    throw new Error("date must be YYYY-MM-DD (America/New_York).");
  }
  const todayMs = Date.parse(`${today}T12:00:00Z`);
  const wantedMs = Date.parse(`${value}T12:00:00Z`);
  const days = Math.round((wantedMs - todayMs) / 86_400_000);
  if (days > 1) throw new Error("date cannot be more than 1 day in the future.");
  if (days < -21) throw new Error("date cannot be more than 21 days in the past.");
  return value;
}

export function normalizeBriefMarkdown(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("content_md must be a markdown string.");
  const content = raw.trim();
  if (content.length < MIN_BRIEF_CHARS) {
    throw new Error(`content_md is too short (need at least ${MIN_BRIEF_CHARS} characters).`);
  }
  if (content.length > MAX_BRIEF_CHARS) {
    throw new Error(`content_md is too long (max ${MAX_BRIEF_CHARS} characters).`);
  }
  return content;
}

export function parseInboxPayload(raw: unknown): Record<string, unknown> {
  let value = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) throw new Error("payload_json is empty.");
    try {
      value = JSON.parse(trimmed) as unknown;
    } catch {
      throw new Error("payload_json is not valid JSON.");
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Inbox dispatch payload must be a JSON object.");
  }
  const obj = value as Record<string, unknown>;
  const hasList =
    Array.isArray(obj.boarding) || Array.isArray(obj.holding) || Array.isArray(obj.noise);
  if (!hasList) {
    throw new Error("Inbox dispatch payload needs boarding, holding, or noise arrays.");
  }
  const encoded = JSON.stringify(obj);
  if (encoded.length > MAX_PAYLOAD_CHARS) {
    throw new Error("Inbox dispatch payload is too large.");
  }
  return obj;
}

export async function publishMorningBrief(input: { date?: string; content_md: string }) {
  const date = resolvePublishDate(input.date);
  const content_md = normalizeBriefMarkdown(input.content_md);
  const now = new Date().toISOString();
  const { data, error } = await publicDb()
    .from("morning_briefs")
    .upsert({ brief_date: date, content_md, created_at: now }, { onConflict: "brief_date" })
    .select("id,brief_date,created_at")
    .single();
  if (error) throw new Error(error.message);
  return {
    ok: true,
    published: "morning_brief",
    brief_date: data.brief_date,
    id: data.id,
    created_at: data.created_at,
    chars: content_md.length,
    home: "https://jasonos.vercel.app/",
  };
}

export async function publishInboxDispatch(input: { date?: string; payload_json: string }) {
  const date = resolvePublishDate(input.date);
  const payload = parseInboxPayload(input.payload_json);
  const now = new Date().toISOString();
  const { data, error } = await publicDb()
    .from("inbox_dispatches")
    .upsert(
      { dispatch_date: date, payload, created_at: now, updated_at: now },
      { onConflict: "dispatch_date" }
    )
    .select("dispatch_date,created_at,updated_at")
    .single();
  if (error) throw new Error(error.message);
  return {
    ok: true,
    published: "inbox_dispatch",
    dispatch_date: data.dispatch_date,
    created_at: data.created_at,
    updated_at: data.updated_at,
    boarding: Array.isArray(payload.boarding) ? payload.boarding.length : 0,
    holding: Array.isArray(payload.holding) ? payload.holding.length : 0,
    home: "https://jasonos.vercel.app/",
  };
}

export function publishOptions() {
  return oauthOptions();
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const raw = (await request.json().catch(() => null)) as unknown;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Send a JSON object.");
  }
  return raw as Record<string, unknown>;
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...OAUTH_CORS, "Cache-Control": "no-store" },
  });
}

function errorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("too short") || message.includes("must be") || message.includes("Send a JSON")) {
    return 400;
  }
  return 500;
}

/** HTTP fallback for scheduled Claude runs that never receive MCP tools. */
export async function handleMorningBriefPublishHttp(request: Request) {
  const denied = await authorizeMcpRequest(request);
  if (denied) return denied;
  try {
    const body = await readJsonBody(request);
    const content_md = typeof body.content_md === "string" ? body.content_md : "";
    const date = typeof body.date === "string" ? body.date : undefined;
    return jsonResponse(await publishMorningBrief({ date, content_md }));
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      errorStatus(error)
    );
  }
}

export async function handleInboxDispatchPublishHttp(request: Request) {
  const denied = await authorizeMcpRequest(request);
  if (denied) return denied;
  try {
    const body = await readJsonBody(request);
    const date = typeof body.date === "string" ? body.date : undefined;
    const payload_json =
      typeof body.payload_json === "string"
        ? body.payload_json
        : JSON.stringify(body.payload ?? body);
    return jsonResponse(await publishInboxDispatch({ date, payload_json }));
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      errorStatus(error)
    );
  }
}
