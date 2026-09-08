// Vercel Cron — probes every monitoring target, persists result rows in
// jasonos.health_checks, and triggers an alert when any internal-tool target
// fails twice in a row.
//
// Schedule lives in vercel.ts (runs every 2 minutes).

import { NextResponse } from "next/server";
import { MONITORING_TARGETS, type MonitoringTarget } from "@/lib/monitoring/targets";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface ProbeResult {
  target_id: string;
  url: string;
  status_code: number | null;
  response_time_ms: number | null;
  ok: boolean;
  error_message: string | null;
}

async function probe(target: MonitoringTarget): Promise<ProbeResult> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), target.timeoutMs);
  const startedAt = performance.now();
  try {
    const res = await fetch(target.url, {
      method: "GET",
      redirect: "follow",
      signal: ac.signal,
      headers: {
        "User-Agent": "JasonOS-ProductHealth/0.1 (+https://jasonos.vercel.app)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
    });
    const elapsed = Math.round(performance.now() - startedAt);
    const allowed = target.expect?.statusCodes;
    const ok = allowed
      ? allowed.includes(res.status)
      : res.status >= 200 && res.status < 300;
    return {
      target_id: target.id,
      url: target.url,
      status_code: res.status,
      response_time_ms: elapsed,
      ok,
      error_message: ok ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    const elapsed = Math.round(performance.now() - startedAt);
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      target_id: target.id,
      url: target.url,
      status_code: null,
      response_time_ms: aborted ? target.timeoutMs : elapsed,
      ok: false,
      error_message: aborted ? "timeout" : err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev / local — allow
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function persist(results: ProbeResult[]): Promise<{ persisted: boolean; note?: string }> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return { persisted: false, note: "supabase service role missing" };
  }
  try {
    const sb = createServiceRoleClient();
    const { error } = await sb.from("health_checks").insert(
      results.map((r) => ({
        target_id: r.target_id,
        url: r.url,
        status_code: r.status_code,
        response_time_ms: r.response_time_ms,
        ok: r.ok,
        error_message: r.error_message,
      }))
    );
    if (error) throw error;
    return { persisted: true };
  } catch (err) {
    console.error("[health-check] persist failed:", err);
    return { persisted: false, note: err instanceof Error ? err.message : String(err) };
  }
}

async function alertIfTwoConsecutiveFailures(failed: ProbeResult[]) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    failed.length === 0
  ) {
    return;
  }
  try {
    const sb = createServiceRoleClient();
    for (const f of failed) {
      const target = MONITORING_TARGETS.find((t) => t.id === f.target_id);
      if (!target || target.kind !== "internal_tool") continue;
      // We just inserted the latest failure — look at the row right before it.
      const { data: prior } = await sb
        .from("health_checks")
        .select("ok, checked_at")
        .eq("target_id", f.target_id)
        .order("checked_at", { ascending: false })
        .range(1, 1)
        .limit(1)
        .maybeSingle();
      if (prior && prior.ok === false) {
        await notify({
          source: `Product Health · ${target.label}`,
          title: `${target.label} down for 2+ consecutive checks`,
          body: `${f.error_message ?? "non-200"} at ${f.url}`,
          severity: "critical",
          category: "error",
        });
      }
    }
  } catch (err) {
    console.warn("[health-check] alerting check failed:", err);
  }
}

async function resolveRecoveredInternalTools(results: ProbeResult[]) {
  const recovered = results.filter((r) => r.ok);
  if (
    !recovered.length ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return;
  }
  try {
    const sb = createServiceRoleClient();
    const now = new Date().toISOString();
    for (const r of recovered) {
      const target = MONITORING_TARGETS.find((t) => t.id === r.target_id);
      if (!target || target.kind !== "internal_tool") continue;
      await sb
        .from("alerts")
        .update({ state: "resolved", resolved_at: now })
        .eq("source", `Product Health · ${target.label}`)
        .eq("state", "open");
    }
  } catch (err) {
    console.warn("[health-check] recover resolve failed:", err);
  }
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const startedAt = Date.now();
  const results = await Promise.all(MONITORING_TARGETS.map(probe));
  const persistResult = await persist(results);
  const failed = results.filter((r) => !r.ok);
  await alertIfTwoConsecutiveFailures(failed);
  await resolveRecoveredInternalTools(results);
  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    checked: results.length,
    failed: failed.length,
    persisted: persistResult.persisted,
    note: persistResult.note,
  });
}
