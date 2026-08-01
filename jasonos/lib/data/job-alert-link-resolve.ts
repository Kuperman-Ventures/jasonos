// Resolve Job Alert Gmail permalinks → real job listing URLs (cached).

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { resolveJobAlertFromGmail } from "@/lib/integrations/gmail";
import {
  gmailThreadUrl,
  normalizeGmailUrl,
} from "@/lib/integrations/gmail-links";

export interface DeepLink {
  /** Best click-through: job posting when known, else Gmail conversation. */
  url: string | null;
  jobUrl: string | null;
  gmailUrl: string | null;
}

interface CacheRow {
  source_id: string;
  thread_id: string | null;
  gmail_url: string;
  job_url: string | null;
  resolved_at: string;
}

const GMAIL_ID_RE =
  /mail\.google\.com\/mail\/(?:u\/[^/#]+\/)?#(?:all|inbox|imp|starred|label\/[^/]+)\/([A-Za-z0-9_-]+)/i;

export function extractGmailSourceId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(GMAIL_ID_RE);
  return m?.[1] ?? null;
}

function hasConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function loadCache(ids: string[]): Promise<Map<string, CacheRow>> {
  const map = new Map<string, CacheRow>();
  if (!hasConfig() || ids.length === 0) return map;
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("job_alert_link_cache")
    .select("source_id,thread_id,gmail_url,job_url,resolved_at")
    .in("source_id", ids);
  if (error) {
    console.warn("[job-alert-links] cache read failed:", error.message);
    return map;
  }
  for (const row of (data ?? []) as CacheRow[]) {
    map.set(row.source_id, row);
  }
  return map;
}

async function writeCache(rows: CacheRow[]): Promise<void> {
  if (!hasConfig() || rows.length === 0) return;
  const sb = createServiceRoleClient();
  const { error } = await sb.from("job_alert_link_cache").upsert(
    rows.map((r) => ({
      source_id: r.source_id,
      thread_id: r.thread_id,
      gmail_url: r.gmail_url,
      job_url: r.job_url,
      resolved_at: r.resolved_at,
    })),
    { onConflict: "source_id" }
  );
  if (error) {
    console.warn("[job-alert-links] cache write failed:", error.message);
  }
}

function rowToDeepLink(row: CacheRow): DeepLink {
  const jobUrl = row.job_url;
  const gmailUrl = row.gmail_url ? normalizeGmailUrl(row.gmail_url) : null;
  return {
    url: jobUrl || gmailUrl,
    jobUrl,
    gmailUrl,
  };
}

/**
 * For a set of harvested opportunity URLs, resolve Gmail permalinks to the
 * deepest useful destination (job listing > conversation). Non-Gmail URLs pass
 * through unchanged. Results are cached in jasonos.job_alert_link_cache.
 */
export async function resolveOpportunityDeepLinks(
  urls: (string | null)[]
): Promise<Map<string, DeepLink>> {
  const out = new Map<string, DeepLink>();
  const bySource = new Map<string, string>(); // sourceId → original url

  for (const url of urls) {
    if (!url) continue;
    if (out.has(url)) continue;
    const sourceId = extractGmailSourceId(url);
    if (!sourceId) {
      out.set(url, { url, jobUrl: url, gmailUrl: null });
      continue;
    }
    bySource.set(sourceId, url);
  }

  const sourceIds = [...bySource.keys()];
  const cached = await loadCache(sourceIds);
  const missing: string[] = [];

  for (const id of sourceIds) {
    const original = bySource.get(id)!;
    const hit = cached.get(id);
    if (hit) {
      out.set(original, rowToDeepLink(hit));
    } else {
      missing.push(id);
    }
  }

  // Bound Gmail fan-out so a long brief history doesn't stall the page.
  const toResolve = missing.slice(0, 30);
  const now = new Date().toISOString();
  const fresh: CacheRow[] = [];

  await Promise.all(
    toResolve.map(async (id) => {
      const original = bySource.get(id)!;
      try {
        const resolved = await resolveJobAlertFromGmail(id);
        const gmailUrl =
          resolved.gmailUrl ||
          (resolved.threadId
            ? gmailThreadUrl(resolved.threadId)
            : normalizeGmailUrl(original));
        const row: CacheRow = {
          source_id: id,
          thread_id: resolved.threadId,
          gmail_url: gmailUrl,
          job_url: resolved.jobUrl,
          resolved_at: now,
        };
        fresh.push(row);
        out.set(original, rowToDeepLink(row));
      } catch (err) {
        console.warn("[job-alert-links] resolve failed:", id, err);
        const fallback = normalizeGmailUrl(original);
        out.set(original, {
          url: fallback,
          jobUrl: null,
          gmailUrl: fallback,
        });
      }
    })
  );

  await writeCache(fresh);

  // Anything we skipped (over the resolve cap) still gets a normalized Gmail link.
  for (const id of missing.slice(30)) {
    const original = bySource.get(id)!;
    if (!out.has(original)) {
      const fallback = normalizeGmailUrl(original);
      out.set(original, {
        url: fallback,
        jobUrl: null,
        gmailUrl: fallback,
      });
    }
  }

  return out;
}
