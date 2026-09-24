import "server-only";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  formatSyncSummary,
  isOkPayload,
  isUnavailablePayload,
  payloadIssueText,
} from "@/lib/outreach/sync-log-format";

export type SyncLogSource =
  | "gmail"
  | "gcal"
  | "outlook"
  | "beeper"
  | "hubspot"
  | "suggested"
  | "sent-followups";

export const SYNC_LOG_SOURCE_LABELS: Record<string, string> = {
  gmail: "Gmail",
  gcal: "Calendar",
  outlook: "Outlook",
  beeper: "Beeper",
  hubspot: "HubSpot",
  suggested: "Suggested",
  "sent-followups": "Sent follow-ups",
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

const SOURCE_ORDER = [
  "gmail",
  "outlook",
  "gcal",
  "beeper",
  "suggested",
  "sent-followups",
  "hubspot",
];
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

export { formatSyncSummary } from "@/lib/outreach/sync-log-format";

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
      ok: isOkPayload(payload),
      unavailable: isUnavailablePayload(payload),
      inserted,
      matched: num(payload, "matched"),
      duplicates: num(payload, "duplicates"),
      cadence_updates: num(payload, "cadenceUpdates"),
      skipped: num(payload, "skipped"),
      summary: formatSyncSummary(source, payload),
      error: payloadIssueText(payload),
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
      // Prefer a freshly formatted summary so older rows that only stored
      // issues in `errors[]` still show the warning/failure text.
      const summary = formatSyncSummary(String(row.source ?? ""), {
        ...result,
        ok: row.ok,
        unavailable: row.unavailable,
        error: row.error ?? result.error,
      });
      const ok = isOkPayload({
        ...result,
        ok: row.ok,
        unavailable: row.unavailable,
        error: row.error ?? result.error,
      });
      return {
        id: String(row.id),
        ran_at: String(row.ran_at),
        source: String(row.source ?? ""),
        ok,
        unavailable: row.unavailable === true,
        inserted: Number(row.inserted) || 0,
        matched: Number(row.matched) || 0,
        duplicates: Number(row.duplicates) || 0,
        cadence_updates: Number(row.cadence_updates) || 0,
        skipped: Number(row.skipped) || 0,
        summary,
        error: (row.error as string | null) ?? payloadIssueText(result),
        result,
        run_id: (row.run_id as string | null) ?? null,
      };
    });
  } catch (err) {
    console.error("[sync-log.get]", err);
    return [];
  }
}
