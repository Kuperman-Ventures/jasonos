// Product Health monitoring targets.
// Edit this file to add/remove targets. Cron picks up changes on next run;
// no migration required (target_id is just a string column).

export type Criticality = "critical" | "high" | "normal";
export type SurfaceKind = "internal_tool" | "public_site";

export interface MonitoringTarget {
  id: string;                 // stable id, used as `health_checks.target_id`
  label: string;              // short display name
  url: string;                // full URL to probe
  intervalMs: number;         // declared cadence (informational)
  timeoutMs: number;          // request timeout
  criticality: Criticality;   // sort order: critical first
  kind: SurfaceKind;
  expect?: {
    statusCodes?: number[];   // allowed status codes (default 200..299)
    bodyIncludes?: string;    // optional substring match
    maxResponseTimeMs?: number; // upper bound before "yellow"
  };
}

const TWO_MIN = 2 * 60_000;
const FIVE_MIN = 5 * 60_000;

export const MONITORING_TARGETS: MonitoringTarget[] = [
  // Internal Refactor Sprint tool surfaces — the critical ones.
  {
    id: "rs-app",
    label: "RS · /app",
    url: "https://refactorsprint.com/app",
    intervalMs: TWO_MIN,
    timeoutMs: 10_000,
    criticality: "critical",
    kind: "internal_tool",
    expect: { maxResponseTimeMs: 2000 },
  },
  {
    id: "rs-board-manager",
    label: "RS · /board-manager",
    url: "https://refactorsprint.com/board-manager",
    intervalMs: TWO_MIN,
    timeoutMs: 10_000,
    criticality: "critical",
    kind: "internal_tool",
    expect: { maxResponseTimeMs: 2000 },
  },
  {
    id: "rs-intelligence-manager",
    label: "RS · /intelligence-manager",
    url: "https://refactorsprint.com/intelligence-manager",
    intervalMs: TWO_MIN,
    timeoutMs: 10_000,
    criticality: "critical",
    kind: "internal_tool",
    expect: { maxResponseTimeMs: 2000 },
  },
  {
    id: "rs-archive",
    label: "RS · /archive",
    url: "https://refactorsprint.com/archive",
    intervalMs: TWO_MIN,
    timeoutMs: 10_000,
    criticality: "high",
    kind: "internal_tool",
    expect: { maxResponseTimeMs: 2000 },
  },
  {
    id: "rs-presales",
    label: "RS · /presales",
    url: "https://refactorsprint.com/presales",
    intervalMs: TWO_MIN,
    timeoutMs: 10_000,
    criticality: "high",
    kind: "internal_tool",
    expect: { maxResponseTimeMs: 2000 },
  },
  // Public marketing sites.
  {
    id: "ka-home",
    label: "kupermanadvisors.com",
    url: "https://kupermanadvisors.com",
    intervalMs: FIVE_MIN,
    timeoutMs: 10_000,
    criticality: "normal",
    kind: "public_site",
    expect: { maxResponseTimeMs: 2500 },
  },
  {
    id: "rs-home",
    label: "refactorsprint.com",
    url: "https://refactorsprint.com",
    intervalMs: FIVE_MIN,
    timeoutMs: 10_000,
    criticality: "normal",
    kind: "public_site",
    expect: { maxResponseTimeMs: 2500 },
  },
];

export type HealthStatus = "green" | "yellow" | "red" | "unknown";

export function classifyStatus(opts: {
  statusCode?: number | null;
  responseTimeMs?: number | null;
  ok?: boolean;
  expect?: MonitoringTarget["expect"];
}): HealthStatus {
  const allowed = opts.expect?.statusCodes;
  const max = opts.expect?.maxResponseTimeMs;
  if (opts.statusCode === undefined || opts.statusCode === null) return "red";
  if (opts.statusCode >= 500) return "red";
  if (opts.statusCode >= 400) return "red";
  if (allowed && allowed.length && !allowed.includes(opts.statusCode)) return "yellow";
  if (opts.statusCode >= 300) return "yellow";
  if (max && opts.responseTimeMs && opts.responseTimeMs > max) return "yellow";
  if (opts.ok === false) return "red";
  return "green";
}
