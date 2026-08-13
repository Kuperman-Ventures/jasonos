import "server-only";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type SyncLogSource =
  | "gmail"
  | "gcal"
  | "beeper"
  | "hubspot"
  | "suggested";

export const SYNC_LOG_SOURCE_LABELS: Record<string, string> = {
  gmail: "Gmail",
  gcal: "Calendar",
  beeper: "Beeper",
  hubspot: "HubSpot",
  suggested: "Suggested",
};

export interface SyncLogEntry {
  id: string;
  ran_at: string;
  source: string;
  ok: boolean;
  unavailable: boolean;
  inserted: number;
  matched: number;
  duplicates: number;
  cadence_updates: number;
  skipped: number;
  summary: string;
  error: string | null;
  result: Record<string, unknown>;
}

function hasServiceRole() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function num(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function str(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isUnavailable(payload: Record<string, unknown>): boolean {
  return payload.unavailable === true;
}

function isOk(payload: Record<string, unknown>): boolean {
  if (isUnavailable(payload)) return true;
  if (payload.ok === false) return false;
  const error = str(payload, "error");
  if (error && payload.ok !== true && !("inserted" in payload) && !("created" in payload) && !("matched" in payload)) {
    return false;
  }
  return true;
}

/** One-line description of a sync payload for the log list. */
export function formatSyncSummary(
  source: string,
  payload: Record<string, unknown>
): string {
  const error = str(payload, "error");
  if (isUnavailable(payload)) {
    return error ?? "skipped";
  }
  if (!isOk(payload)) {
    return error ? `failed: ${error}` : "failed";
  }

  if (source === "suggested") {
    const created = num(payload, "created");
    const updated = num(payload, "updated");
    const scanned = num(payload, "scanned");
    const skipped = num(payload, "skipped");
    const parts = [`+${created} new`];
    if (updated) parts.push(`${updated} updated`);
    if (scanned) parts.push(`${scanned} scanned`);
    if (skipped) parts.push(`${skipped} skipped`);
    return parts.join(" · ");
  }

  const inserted = num(payload, "inserted");
  const duplicates = num(payload, "duplicates");
  const cadence = num(payload, "cadenceUpdates");
  const meetingsInserted = num(payload, "meetingsInserted");
  const meetingsUpdated = num(payload, "meetingsUpdated");
  const parts = [`${inserted > 0 ? "+" : ""}${inserted} new`];
  if (duplicates) parts.push(`${duplicates} already captured`);
  if (cadence) parts.push(`advanced ${cadence}`);
  if (meetingsInserted) parts.push(`+${meetingsInserted} meetings`);
  else if (meetingsUpdated) parts.push(`${meetingsUpdated} meetings updated`);
  if (error) parts.push(error);
  return parts.join(" · ");
}

/**
 * Append one sync run to jasonos.sync_log. Never throws — a log miss
 * should not fail the sync itself.
 */
export async function appendSyncLog(
  source: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!hasServiceRole()) return;
  try {
    const client = createServiceRoleClient();
    const inserted = num(payload, "inserted") || num(payload, "created");
    const { error } = await client.from("sync_log").insert({
      ran_at: new Date().toISOString(),
      source,
      ok: isOk(payload),
      unavailable: isUnavailable(payload),
      inserted,
      matched: num(payload, "matched"),
      duplicates: num(payload, "duplicates"),
      cadence_updates: num(payload, "cadenceUpdates"),
      skipped: num(payload, "skipped"),
      summary: formatSyncSummary(source, payload),
      error: str(payload, "error"),
      result: payload,
    });
    if (error && !/relation .+ does not exist/i.test(error.message)) {
      console.error("[sync-log.append]", error);
    } else if (!error) {
      revalidatePath("/settings/sync-log");
    }
  } catch (err) {
    console.error("[sync-log.append]", err);
  }
}

export async function getSyncLog(limit = 500): Promise<SyncLogEntry[]> {
  if (!hasServiceRole()) return [];
  try {
    const client = createServiceRoleClient();
    const { data, error } = await client
      .from("sync_log")
      .select(
        "id,ran_at,source,ok,unavailable,inserted,matched,duplicates,cadence_updates,skipped,summary,error,result"
      )
      .order("ran_at", { ascending: false })
      .limit(Math.max(1, Math.min(2000, limit)));
    if (error) {
      if (!/relation .+ does not exist/i.test(error.message)) {
        console.error("[sync-log.get]", error);
      }
      return [];
    }
    return (data ?? []).map((row) => {
      const result = asRecord(row.result);
      const summary =
        (typeof row.summary === "string" && row.summary.trim()) ||
        formatSyncSummary(String(row.source ?? ""), result);
      return {
        id: String(row.id),
        ran_at: String(row.ran_at),
        source: String(row.source ?? ""),
        ok: row.ok === true,
        unavailable: row.unavailable === true,
        inserted: Number(row.inserted) || 0,
        matched: Number(row.matched) || 0,
        duplicates: Number(row.duplicates) || 0,
        cadence_updates: Number(row.cadence_updates) || 0,
        skipped: Number(row.skipped) || 0,
        summary,
        error: (row.error as string | null) ?? null,
        result,
      };
    });
  } catch (err) {
    console.error("[sync-log.get]", err);
    return [];
  }
}
