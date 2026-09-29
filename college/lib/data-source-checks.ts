/**
 * Persistence for Data Sources checks (college.data_source_checks).
 *
 * Every write is best-effort: a missing table, missing Supabase env, or a network
 * error must never break the caller. This module is imported by libs that also
 * run in the browser, so the database client is loaded lazily and only on the server.
 */

import type { BrokenOrBlockedLink, DataSourceCheckState } from "./data-sources";

export type SourceCallResult = { ok: boolean; ms?: number | null; error?: string | null };

type CheckRow = {
  source_id: string;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  last_ms: number | null;
  broken_links: unknown;
  blocked_links: unknown;
};

const TABLE = "data_source_checks";
const MAX_ERROR_LENGTH = 500;
const MAX_LINKS = 60;

function onServer(): boolean {
  return typeof window === "undefined";
}

async function db() {
  const { collegeDb, supabaseConfigured } = await import("./db");
  return supabaseConfigured() ? collegeDb() : null;
}

function cleanError(message: string | null | undefined): string {
  return (message ?? "Unknown error")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ERROR_LENGTH);
}

export function normalizeLinkList(value: unknown): BrokenOrBlockedLink[] {
  if (!Array.isArray(value)) return [];
  const out: BrokenOrBlockedLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const url = typeof row.url === "string" ? row.url.trim() : "";
    if (!url) continue;
    out.push({
      url,
      ...(typeof row.schoolId === "string" ? { schoolId: row.schoolId } : {}),
      ...(typeof row.schoolName === "string" ? { schoolName: row.schoolName } : {}),
      status: typeof row.status === "number" && Number.isFinite(row.status) ? row.status : null,
    });
    if (out.length >= MAX_LINKS) break;
  }
  return out;
}

export function mapCheckRow(row: CheckRow): DataSourceCheckState {
  return {
    lastCheckedAt: row.last_checked_at ?? null,
    lastSuccessAt: row.last_success_at ?? null,
    lastErrorAt: row.last_error_at ?? null,
    lastErrorMessage: row.last_error_message ?? null,
    lastMs: typeof row.last_ms === "number" ? row.last_ms : null,
    brokenLinks: normalizeLinkList(row.broken_links),
    blockedLinks: normalizeLinkList(row.blocked_links),
  };
}

/** Row patch for a single call or test. Only touches the columns that changed. */
export function callPatch(
  sourceId: string,
  result: SourceCallResult,
  now = new Date(),
): Record<string, string | number | null> {
  const at = now.toISOString();
  const ms = typeof result.ms === "number" && Number.isFinite(result.ms) ? Math.round(result.ms) : null;
  return {
    source_id: sourceId,
    last_checked_at: at,
    last_ms: ms,
    updated_at: at,
    ...(result.ok
      ? { last_success_at: at }
      : { last_error_at: at, last_error_message: cleanError(result.error) }),
  };
}

/** Awaitable write. Resolves false when nothing was stored. Never rejects. */
export async function saveSourceCall(sourceId: string, result: SourceCallResult): Promise<boolean> {
  if (!onServer()) return false;
  try {
    const client = await db();
    if (!client) return false;
    const { error } = await client.from(TABLE).upsert(callPatch(sourceId, result), { onConflict: "source_id" });
    return !error;
  } catch {
    return false;
  }
}

/** Fire-and-forget record of a real call. Safe to call anywhere; never throws. */
export function recordSourceCall(sourceId: string, result: SourceCallResult): void {
  if (!onServer()) return;
  void saveSourceCall(sourceId, result).catch(() => {});
}

/** Run `fn`, record how it went, and pass its result or error through unchanged. */
export async function timeSourceCall<T>(sourceId: string, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    const value = await fn();
    recordSourceCall(sourceId, { ok: true, ms: Date.now() - started });
    return value;
  } catch (error) {
    recordSourceCall(sourceId, {
      ok: false,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function saveLinkCheck(
  sourceId: string,
  input: { broken: BrokenOrBlockedLink[]; blocked: BrokenOrBlockedLink[]; ms: number; error?: string | null },
): Promise<boolean> {
  if (!onServer()) return false;
  try {
    const client = await db();
    if (!client) return false;
    const at = new Date().toISOString();
    const { error } = await client.from(TABLE).upsert(
      {
        source_id: sourceId,
        last_checked_at: at,
        last_ms: Math.round(input.ms),
        broken_links: normalizeLinkList(input.broken),
        blocked_links: normalizeLinkList(input.blocked),
        updated_at: at,
        ...(input.error
          ? { last_error_at: at, last_error_message: cleanError(input.error) }
          : { last_success_at: at }),
      },
      { onConflict: "source_id" },
    );
    return !error;
  } catch {
    return false;
  }
}

/** All recorded checks keyed by source id. Empty when the table is missing. */
export async function listSourceChecks(): Promise<Record<string, DataSourceCheckState>> {
  try {
    const client = await db();
    if (!client) return {};
    const { data, error } = await client
      .from(TABLE)
      .select(
        "source_id, last_checked_at, last_success_at, last_error_at, last_error_message, last_ms, broken_links, blocked_links",
      );
    if (error || !data) return {};
    const out: Record<string, DataSourceCheckState> = {};
    for (const row of data as CheckRow[]) {
      if (row.source_id) out[row.source_id] = mapCheckRow(row);
    }
    return out;
  } catch {
    return {};
  }
}

/** Most recent check across all sources. */
export function latestCheckedAt(checks: Record<string, DataSourceCheckState>): string | null {
  let latest: string | null = null;
  for (const check of Object.values(checks)) {
    if (check.lastCheckedAt && (!latest || check.lastCheckedAt > latest)) latest = check.lastCheckedAt;
  }
  return latest;
}
