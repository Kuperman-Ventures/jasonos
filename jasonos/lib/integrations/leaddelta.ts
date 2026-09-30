// LeadDelta — LinkedIn CRM enrichment (profile photo + headline).
// Uses the LeadDelta MCP HTTP endpoint with the Settings / env API key.
// JasonOS does not scrape LinkedIn.
//
// Streamable HTTP requires: initialize → Mcp-Session-Id → tools/call.
// Calling tools without a session returns HTTP 400.

import "server-only";
import { emptyResult, type IntegrationResult } from "./_base";
import { createPublicServiceRoleClient } from "@/lib/supabase/server";
import {
  firstConnectionFromMcp,
  normalizeLeadDeltaConnection,
  normalizeLinkedInUrl,
  type LeadDeltaConnection,
} from "./leaddelta-parse";

export type { LeadDeltaConnection };
export {
  extractLeadDeltaPhotoUrl,
  normalizeLeadDeltaConnection,
  normalizeLinkedInUrl,
} from "./leaddelta-parse";

export interface LinkedInProfile {
  email?: string;
  linkedinUrl?: string;
  fullName?: string;
  headline?: string;
  company?: string;
  photoUrl?: string;
  recentPosts?: { url: string; preview: string; postedAt: string }[];
}

const MCP_URL = "https://mcp.leaddelta.com/mcp";

type ConnectionConfig = { access_token?: string; api_key?: string };

async function resolveLeadDeltaApiKey(): Promise<string | null> {
  try {
    const sb = createPublicServiceRoleClient();
    const { data } = await sb
      .from("service_connections")
      .select("config")
      .eq("service_name", "leaddelta")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const cfg = (data?.config ?? {}) as ConnectionConfig;
    const fromSettings =
      cfg.access_token?.trim() || cfg.api_key?.trim() || null;
    if (fromSettings) return fromSettings;
  } catch {
    // Settings may be unreachable. Fall through to the env key.
  }
  return process.env.LEADDELTA_API_KEY?.trim() || null;
}

export async function getProfileForAttendee(
  attendeeEmail: string
): Promise<IntegrationResult<LinkedInProfile | null>> {
  const key = await resolveLeadDeltaApiKey();
  if (!key) return emptyResult(null, false);
  const email = attendeeEmail.trim().toLowerCase();
  if (!email.includes("@")) return emptyResult(null, true);

  try {
    const listed = await mcpCall(key, "get_connections_mcp", {
      email,
      emails: email,
      q: email,
      query: email,
    });
    if (!listed.ok) return emptyResult(null, true, listed.error);
    const connection =
      firstConnectionFromMcp(listed.data) ??
      normalizeLeadDeltaConnection(listed.data);
    if (!connection) return emptyResult(null, true);
    return emptyResult(toLinkedInProfile(connection), true);
  } catch (err) {
    return emptyResult(
      null,
      true,
      err instanceof Error ? err.message : "LeadDelta request failed."
    );
  }
}

/** Look up one LeadDelta connection by LinkedIn profile URL. */
export async function getConnectionByLinkedInUrl(
  linkedinUrl: string
): Promise<IntegrationResult<LeadDeltaConnection | null>> {
  const key = await resolveLeadDeltaApiKey();
  if (!key) return emptyResult(null, false);
  const url = normalizeLinkedInUrl(linkedinUrl);
  if (!url) return emptyResult(null, true, "Not a LinkedIn profile URL.");
  const publicIdentifier = publicIdentifierFromLinkedInUrl(url);
  if (!publicIdentifier) {
    return emptyResult(null, true, "Not a LinkedIn profile URL.");
  }

  try {
    // LeadDelta get_connection wants publicIdentifier or connectionId —
    // not a raw LinkedIn URL.
    const result = await mcpCall(key, "get_connection", {
      publicIdentifier,
      connectionId: publicIdentifier,
    });
    if (!result.ok) return emptyResult(null, true, result.error);
    const connection =
      firstConnectionFromMcp(result.data) ??
      normalizeLeadDeltaConnection(result.data);
    if (!connection) {
      return emptyResult(
        null,
        true,
        "LeadDelta returned no connection for that URL."
      );
    }
    if (!connection.linkedinUrl) connection.linkedinUrl = url;
    return emptyResult(connection, true);
  } catch (err) {
    return emptyResult(
      null,
      true,
      err instanceof Error ? err.message : "LeadDelta request failed."
    );
  }
}

export async function verifyLeadDeltaKey(
  apiKey?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = apiKey?.trim() || (await resolveLeadDeltaApiKey());
  if (!key) return { ok: false, error: "LeadDelta API key is missing." };
  try {
    const result = await mcpCall(key, "get_connections_list", {
      page: 1,
      limit: 1,
      pageSize: 1,
      page_size: 1,
    });
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "LeadDelta verification failed.",
    };
  }
}

function toLinkedInProfile(connection: LeadDeltaConnection): LinkedInProfile {
  return {
    email: connection.emails?.[0],
    linkedinUrl: connection.linkedinUrl ?? undefined,
    fullName: connection.fullName ?? undefined,
    headline: connection.headline ?? undefined,
    company: connection.company ?? undefined,
    photoUrl: connection.photoUrl ?? undefined,
  };
}

function publicIdentifierFromLinkedInUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/in\/([^/?#]+)/i);
    if (!match?.[1]) return null;
    return decodeURIComponent(match[1]).replace(/\/$/, "") || null;
  } catch {
    return null;
  }
}

async function mcpCall(
  key: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const session = await openMcpSession(key);
  if (!session.ok) return session;
  try {
    // Required by Streamable HTTP; ignore notify failures.
    await mcpFetch(key, session.id, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    const res = await mcpFetch(key, session.id, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    });
    if (!res.ok) {
      return { ok: false, error: formatHttpError(res.status, res.text) };
    }
    return parseMcpResponse(res.text);
  } finally {
    // Best-effort session cleanup.
    void mcpFetch(key, session.id, null, "DELETE").catch(() => undefined);
  }
}

async function openMcpSession(
  key: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await mcpFetch(key, null, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "jasonos", version: "1.0.0" },
    },
  });
  if (!res.ok) {
    return { ok: false, error: formatHttpError(res.status, res.text) };
  }
  const sessionId = res.headers.get("mcp-session-id")?.trim();
  if (!sessionId) {
    return {
      ok: false,
      error: "LeadDelta did not return an MCP session id.",
    };
  }
  const parsed = parseMcpResponse(res.text);
  if (!parsed.ok) return parsed;
  return { ok: true, id: sessionId };
}

async function mcpFetch(
  key: string,
  sessionId: string | null,
  body: Record<string, unknown> | null,
  method: "POST" | "DELETE" = "POST"
): Promise<{ ok: boolean; status: number; text: string; headers: Headers }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    Accept: "application/json, text/event-stream",
  };
  if (method === "POST") {
    headers["Content-Type"] = "application/json";
  }
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const res = await fetch(MCP_URL, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text, headers: res.headers };
}

function formatHttpError(status: number, text: string): string {
  if (status === 401 || status === 403) {
    return "LeadDelta rejected the API key. Paste a new key in Settings.";
  }
  const fromBody = extractErrorMessage(text);
  if (fromBody) {
    if (/session/i.test(fromBody)) {
      return "LeadDelta MCP session failed. Try Verify again.";
    }
    if (/business plan|subscription|plan/i.test(fromBody)) {
      return "LeadDelta MCP needs a Business plan workspace.";
    }
    return fromBody;
  }
  return `LeadDelta returned ${status}.`;
}

function extractErrorMessage(text: string): string | null {
  const jsonText = extractJsonPayload(text);
  if (!jsonText) return null;
  try {
    const envelope = JSON.parse(jsonText) as {
      error?: { message?: string };
      result?: {
        isError?: boolean;
        content?: Array<{ type?: string; text?: string }>;
      };
    };
    if (envelope.error?.message) return envelope.error.message;
    if (envelope.result?.isError) {
      return (
        envelope.result.content
          ?.map((part) => part.text)
          .filter(Boolean)
          .join(" ") || null
      );
    }
  } catch {
    // ignore
  }
  return null;
}

function parseMcpResponse(
  text: string
): { ok: true; data: unknown } | { ok: false; error: string } {
  const jsonText = extractJsonPayload(text);
  if (!jsonText) return { ok: false, error: "LeadDelta returned an empty response." };
  try {
    const envelope = JSON.parse(jsonText) as {
      error?: { message?: string };
      result?: {
        isError?: boolean;
        content?: Array<{ type?: string; text?: string }>;
        structuredContent?: unknown;
      };
    };
    if (envelope.error?.message) {
      return { ok: false, error: envelope.error.message };
    }
    const result = envelope.result;
    if (!result) return { ok: false, error: "LeadDelta returned no result." };
    if (result.isError) {
      const message =
        result.content?.map((part) => part.text).filter(Boolean).join(" ") ||
        "LeadDelta tool error.";
      return { ok: false, error: message };
    }
    if (result.structuredContent != null) {
      return { ok: true, data: result.structuredContent };
    }
    const textParts = (result.content ?? [])
      .filter((part) => part.type === "text" && part.text)
      .map((part) => part.text as string);
    if (!textParts.length) return { ok: true, data: result };
    const joined = textParts.join("\n").trim();
    try {
      return { ok: true, data: JSON.parse(joined) };
    } catch {
      return { ok: true, data: joined };
    }
  } catch {
    return { ok: false, error: "LeadDelta returned invalid JSON." };
  }
}

function extractJsonPayload(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
  const dataLines = trimmed
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  if (dataLines.length) return dataLines[dataLines.length - 1] ?? null;
  return trimmed;
}
