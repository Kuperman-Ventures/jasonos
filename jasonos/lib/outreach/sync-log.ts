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
  "job-alerts": "Job Alerts",
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
  run_id: string | null;
}

export interface SyncLogInstance {
  id: string;
  ran_at: string;
  sources: string[];
  ok: boolean;
  hasUnavailable: boolean;
  hasError: boolean;
  inserted: number;
  entries: SyncLogEntry[];
}

const SOURCE_ORDER = ["gmail", "gcal", "beeper", "suggested", "hubspot"];
const CLUSTER_MS = 90_000;

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

function namesClip(payload: Record<string, unknown>, limit = 4): string | null {
  const raw = payload.unmatchedNames;
  if (!Array.isArray(raw) || !raw.length) return null;
  const names = raw
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
    .map((n) => n.trim());
  if (!names.length) return null;
  const shown = names.slice(0, limit);
  const extra = names.length - shown.length;
  return extra > 0 ? `${shown.join(", ")}, +${extra} more` : shown.join(", ");
}

function suggestedClip(payload: Record<string, unknown>): string | null {
  const staged = num(payload, "candidatesStaged") || num(payload, "created");
  const names = namesClip(payload);
  if (staged <= 0 && !names) return null;
  const count = staged || (Array.isArray(payload.unmatchedNames) ? payload.unmatchedNames.length : 0);
  return names ? `+${count} to Suggested (${names})` : `+${count} to Suggested`;
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
    const names = namesClip(payload);
    const parts: string[] = [];
    if (created || names) {
      parts.push(names ? `+${created} new (${names})` : `+${created} new`);
    } else {
      parts.push("+0 new");
    }
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
  const staged = suggestedClip(payload);
  if (staged) parts.push(staged);
  if (error) parts.push(error);
  return parts.join(" · ");
}

export function syncLogSourceTitle(
  source: string,
  result: Record<string, unknown>
): string {
  const base = SYNC_LOG_SOURCE_LABELS[source] ?? source;
  const email = str(result, "accountEmail");
  return email ? `${base} · ${email}` : base;
}

function sortInstanceEntries(entries: SyncLogEntry[]): SyncLogEntry[] {
  return [...entries].sort((a, b) => {
    const ai = SOURCE_ORDER.indexOf(a.source);
    const bi = SOURCE_ORDER.indexOf(b.source);
    const ao = ai === -1 ? 99 : ai;
    const bo = bi === -1 ? 99 : bi;
    if (ao !== bo) return ao - bo;
    return a.ran_at.localeCompare(b.ran_at);
  });
}

function toInstance(id: string, entries: SyncLogEntry[]): SyncLogInstance {
  const sorted = sortInstanceEntries(entries);
  const newest = sorted.reduce(
    (max, row) => (row.ran_at > max ? row.ran_at : max),
    sorted[0]?.ran_at ?? ""
  );
  const hasError = sorted.some((row) => !row.ok && !row.unavailable);
  const hasUnavailable = sorted.some((row) => row.unavailable);
  return {
    id,
    ran_at: newest,
    sources: [...new Set(sorted.map((row) => row.source))],
    ok: !hasError,
    hasUnavailable,
    hasError,
    inserted: sorted.reduce((sum, row) => sum + row.inserted, 0),
    entries: sorted,
  };
}

/**
 * One Sync click → one instance. Rows that share a run_id stay together.
 * Older rows without a run_id cluster if they ran within 90 seconds.
 */
export function groupSyncLog(rows: SyncLogEntry[]): SyncLogInstance[] {
  const byRunId = new Map<string, SyncLogEntry[]>();
  const ungrouped: SyncLogEntry[] = [];
  for (const row of rows) {
    if (row.run_id) {
      const list = byRunId.get(row.run_id) ?? [];
      list.push(row);
      byRunId.set(row.run_id, list);
    } else {
      ungrouped.push(row);
    }
  }

  const instances: SyncLogInstance[] = [];
  for (const [runId, entries] of byRunId) {
    instances.push(toInstance(runId, entries));
  }

  const clusters: SyncLogEntry[][] = [];
  for (const row of ungrouped) {
    const prev = clusters[clusters.length - 1];
    const last = prev?.[prev.length - 1];
    if (
      last &&
      Math.abs(Date.parse(last.ran_at) - Date.parse(row.ran_at)) <= CLUSTER_MS
    ) {
      prev.push(row);
    } else {
      clusters.push([row]);
    }
  }
  for (const cluster of clusters) {
    instances.push(toInstance(cluster[0].id, cluster));
  }

  return instances.sort((a, b) => b.ran_at.localeCompare(a.ran_at));
}

/**
 * Append one sync run to jasonos.sync_log. Never throws — a log miss
 * should not fail the sync itself.
 */
export async function appendSyncLog(
  source: string,
  payload: Record<string, unknown>,
  runId?: string | null
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
      run_id: runId ?? null,
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
        "id,ran_at,source,ok,unavailable,inserted,matched,duplicates,cadence_updates,skipped,summary,error,result,run_id"
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
        run_id: (row.run_id as string | null) ?? null,
      };
    });
  } catch (err) {
    console.error("[sync-log.get]", err);
    return [];
  }
}
