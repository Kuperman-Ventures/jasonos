// Vercel Web Analytics adapter — read-only traffic + behavior for a project.
// Uses the public Web Analytics API (GA May 2026):
//   GET /v1/query/web-analytics/visits/aggregate?by=...
//   GET /v1/query/web-analytics/events/aggregate?by=eventName
// Auth: Bearer VERCEL_ANALYTICS_TOKEN, scoped by VERCEL_TEAM_ID + projectId.
// Fails safe: any missing config or error returns a non-ok result so panels
// render a "connect" / "unavailable" state instead of throwing.

import "server-only";

const BASE = "https://api.vercel.com/v1/query/web-analytics";

export interface TrafficPage {
  path: string;
  pageViews: number;
  visitors: number;
}
export interface TrafficReferrer {
  referrer: string;
  pageViews: number;
}
export interface TrafficEvent {
  name: string;
  count: number;
}
export interface SiteTraffic {
  configured: boolean;
  ok: boolean;
  sinceDays: number;
  pageViews: number;
  visitors: number;
  topPages: TrafficPage[];
  topReferrers: TrafficReferrer[];
  topEvents: TrafficEvent[];
  error?: string;
}

function creds() {
  const token = process.env.VERCEL_ANALYTICS_TOKEN?.trim() || null;
  const teamId =
    (process.env.VERCEL_TEAM_ID ?? process.env.VERCEL_ANALYTICS_TEAM_ID)?.trim() ||
    null;
  return { token, teamId };
}

function ymd(d: Date): string {
  return d.toISOString().split("T")[0];
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v) || 0;
}

async function aggregate(
  kind: "visits" | "events",
  projectId: string,
  params: Record<string, string>
): Promise<Record<string, unknown>[] | null> {
  const { token, teamId } = creds();
  if (!token) return null;
  const usp = new URLSearchParams({ projectId, ...params });
  if (teamId) usp.set("teamId", teamId);
  try {
    const res = await fetch(`${BASE}/${kind}/aggregate?${usp.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      // Traffic doesn't need to be real-time; cache for 10 min to avoid
      // hammering the API on every dashboard load.
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as
      | { data?: unknown }
      | null;
    return Array.isArray(json?.data)
      ? (json!.data as Record<string, unknown>[])
      : null;
  } catch {
    return null;
  }
}

export async function getSiteTraffic(input: {
  projectId?: string | null;
  sinceDays?: number;
}): Promise<SiteTraffic> {
  const sinceDays = input.sinceDays ?? 30;
  const projectId = input.projectId?.trim() || "";
  const { token } = creds();
  const base: SiteTraffic = {
    configured: false,
    ok: false,
    sinceDays,
    pageViews: 0,
    visitors: 0,
    topPages: [],
    topReferrers: [],
    topEvents: [],
  };
  if (!token || !projectId) return base;

  const untilD = new Date();
  const sinceD = new Date();
  sinceD.setDate(sinceD.getDate() - sinceDays);
  const range = { since: ymd(sinceD), until: ymd(untilD) };

  const [byDay, byPath, byRef, byEvent] = await Promise.all([
    aggregate("visits", projectId, { ...range, by: "day" }),
    aggregate("visits", projectId, { ...range, by: "requestPath" }),
    aggregate("visits", projectId, { ...range, by: "referrerHostname" }),
    aggregate("events", projectId, { ...range, by: "eventName" }),
  ]);

  if (byDay === null) {
    return {
      ...base,
      configured: true,
      ok: false,
      error:
        "Couldn't reach Vercel Web Analytics — check the token, team ID, project ID, and that Web Analytics is enabled.",
    };
  }

  const pageViews = byDay.reduce((s, r) => s + num(r.pageviews), 0);
  const visitors = byDay.reduce((s, r) => s + num(r.visitors), 0);

  const topPages = (byPath ?? [])
    .map((r) => ({
      path: String(r.requestPath ?? "/"),
      pageViews: num(r.pageviews),
      visitors: num(r.visitors),
    }))
    .sort((a, b) => b.pageViews - a.pageViews)
    .slice(0, 6);

  const topReferrers = (byRef ?? [])
    .map((r) => ({
      referrer: String(r.referrerHostname || "").trim() || "Direct / none",
      pageViews: num(r.pageviews),
    }))
    .sort((a, b) => b.pageViews - a.pageViews)
    .slice(0, 6);

  const topEvents = (byEvent ?? [])
    .map((r) => ({
      name: String(r.eventName ?? "").trim(),
      count: num(r.count ?? r.events ?? r.pageviews ?? r.visitors),
    }))
    .filter((e) => e.name.length > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    configured: true,
    ok: true,
    sinceDays,
    pageViews,
    visitors,
    topPages,
    topReferrers,
    topEvents,
  };
}
