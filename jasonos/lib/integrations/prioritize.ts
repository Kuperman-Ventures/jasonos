/**
 * Prioritize (v0-prioritization-sorting-tool) — export JasonOS commitments
 * as Prioritize cards via the secret-protected import API.
 *
 * Credentials: Settings → Prioritize (import secret + optional base URL),
 * then Vercel env PRIORITIZE_IMPORT_SECRET / PRIORITIZE_BASE_URL.
 */
import "server-only";

import type { CommitmentView } from "@/lib/commitments/types";
import { buildPrioritizeImportBody } from "@/lib/integrations/prioritize-payload";

export const DEFAULT_PRIORITIZE_BASE_URL =
  "https://v0-prioritization-sorting-tool.vercel.app";

export {
  PRIORITIZE_DEFAULT_TRACK_NAME,
  buildPrioritizeImportBody,
} from "@/lib/integrations/prioritize-payload";

type PrioritizeConnectionConfig = {
  access_token?: string;
  base_url?: string;
};

export type PrioritizeImportResult =
  | { ok: true; card_id: string; created: boolean; url: string | null }
  | { ok: false; error: string };

async function loadPrioritizeConnectionConfig(): Promise<PrioritizeConnectionConfig> {
  try {
    const { createPublicServiceRoleClient } = await import("@/lib/supabase/server");
    const sb = createPublicServiceRoleClient();
    const { data } = await sb
      .from("service_connections")
      .select("config")
      .eq("service_name", "prioritize")
      .order("updated_at", { ascending: false });
    for (const row of data ?? []) {
      const cfg = (row.config ?? {}) as PrioritizeConnectionConfig;
      if (cfg.access_token?.trim() || cfg.base_url?.trim()) return cfg;
    }
    return {};
  } catch {
    return {};
  }
}

/** Prefer Settings; fall back to Vercel env. */
export async function resolvePrioritizeCredentials(): Promise<{
  secret: string | null;
  baseUrl: string;
}> {
  const cfg = await loadPrioritizeConnectionConfig();
  const secret =
    cfg.access_token?.trim() ||
    process.env.PRIORITIZE_IMPORT_SECRET?.trim() ||
    null;
  const baseUrl = (
    cfg.base_url?.trim() ||
    process.env.PRIORITIZE_BASE_URL?.trim() ||
    DEFAULT_PRIORITIZE_BASE_URL
  ).replace(/\/$/, "");
  return { secret, baseUrl };
}

function importHeaders(secret: string): HeadersInit {
  // Prioritize accepts Bearer (prompt contract). Also send the named header
  // in case the Prioritize agent used that variant.
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
    "x-jasonos-import-secret": secret,
  };
}

/** Settings → Test Connection. Hits GET /api/import/health. */
export async function testPrioritizeConnection(input?: {
  secret?: string | null;
  baseUrl?: string | null;
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const resolved = await resolvePrioritizeCredentials();
  const secret = input?.secret?.trim() || resolved.secret;
  const baseUrl = (input?.baseUrl?.trim() || resolved.baseUrl).replace(/\/$/, "");
  if (!secret) {
    return {
      ok: false,
      message:
        "Paste the same PRIORITIZE_IMPORT_SECRET you set on the Prioritize Vercel project.",
    };
  }
  try {
    const res = await fetch(`${baseUrl}/api/import/health`, {
      headers: importHeaders(secret),
      cache: "no-store",
    });
    const text = await res.text();
    let body: { ok?: boolean; error?: string } = {};
    try {
      body = JSON.parse(text) as { ok?: boolean; error?: string };
    } catch {
      // non-JSON
    }
    if (res.status === 401) {
      return {
        ok: false,
        message: body.error || "Import secret was rejected. Check it matches Prioritize.",
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        message: body.error || `Prioritize health check returned ${res.status}.`,
      };
    }
    if (body.ok === false) {
      return { ok: false, message: body.error || "Prioritize health check failed." };
    }
    return { ok: true, message: `Prioritize import reachable at ${baseUrl}.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not reach Prioritize.",
    };
  }
}

/** Create or update a Prioritize card for a Home commitment (idempotent by key). */
export async function importCommitmentToPrioritize(
  item: CommitmentView
): Promise<PrioritizeImportResult> {
  const { secret, baseUrl } = await resolvePrioritizeCredentials();
  if (!secret) {
    return {
      ok: false,
      error:
        "Prioritize is not connected. Paste the import secret in Settings → Prioritize.",
    };
  }

  const body = buildPrioritizeImportBody(item);

  try {
    const res = await fetch(`${baseUrl}/api/import/jasonos-commitment`, {
      method: "POST",
      headers: importHeaders(secret),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    let parsed: {
      ok?: boolean;
      error?: string;
      card_id?: string;
      created?: boolean;
      url?: string | null;
    } = {};
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      // non-JSON
    }
    if (res.status === 401) {
      return {
        ok: false,
        error: parsed.error || "Prioritize rejected the import secret.",
      };
    }
    if (!res.ok || parsed.ok === false) {
      return {
        ok: false,
        error: parsed.error || `Prioritize import failed (${res.status}).`,
      };
    }
    const cardId = typeof parsed.card_id === "string" ? parsed.card_id : "";
    if (!cardId) {
      return { ok: false, error: "Prioritize did not return a card id." };
    }
    return {
      ok: true,
      card_id: cardId,
      created: parsed.created !== false,
      url: typeof parsed.url === "string" ? parsed.url : null,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not reach Prioritize.",
    };
  }
}
