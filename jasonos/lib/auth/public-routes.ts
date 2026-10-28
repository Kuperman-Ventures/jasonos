/** Paths that skip JasonOS login. College lives on a different host and is not listed here. */

const PUBLIC_EXACT = new Set([
  "/login",
  "/favicon.ico",
  "/icon.png",
  "/apple-icon.png",
  "/logo.png",
  "/logo.svg",
]);

const PUBLIC_PREFIXES = [
  "/login",
  "/auth",
  "/iugr",
  "/projects/ski-tracker",
  "/api/ski-tracker",
  "/projects/dark-matter-travel-tracker",
  "/api/dark-matter-travel-tracker",
  "/dark-matter",
  "/rank",
  "/api/rank",
  "/christmas",
  "/api/mcp",
  "/.well-known",
  "/api/auth/google/callback",
  "/api/auth/microsoft/callback",
  "/api/auth/wispr/callback",
  "/api/morning-brief/publish",
  "/api/inbox-dispatch/publish",
  "/api/commitment-check/publish",
  "/api/fyb",
];

const CRON_PATHS = new Set([
  "/api/monitoring/health-check",
  "/api/sync/daily",
  "/api/job-alerts/harvest",
  "/api/browning-networking/run",
  "/api/browning-networking/holds",
  "/api/browning-networking/reminders",
  "/api/family-meeting/freeze-print",
]);

export const PUBLIC_SURFACE_HEADER = "x-jasonos-public";

export function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

/** Exact match, or prefix followed by `/` (path boundary). */
export function matchesPathPrefix(path: string, prefix: string): boolean {
  const normalizedPrefix = normalizePathname(prefix);
  return path === normalizedPrefix || path.startsWith(`${normalizedPrefix}/`);
}

export function isPublicJasonosPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (PUBLIC_EXACT.has(path)) return true;
  if (matchesPathPrefix(path, "/_next")) return true;
  return PUBLIC_PREFIXES.some((prefix) => matchesPathPrefix(path, prefix));
}

export function isCronPath(pathname: string): boolean {
  return CRON_PATHS.has(normalizePathname(pathname));
}

/** Live call screen hides the top nav so the agenda stays on one viewport. */
export function isLiveCallPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return (
    /^\/live\/decks\/[^/]+\/run$/.test(path) ||
    /^\/live\/decks\/[^/]+\/rehearse$/.test(path) ||
    /^\/live\/slides\/[^/]+\/run$/.test(path) ||
    /^\/live\/slides\/[^/]+\/rehearse$/.test(path) ||
    /^\/live\/playbooks\/[^/]+\/rehearse$/.test(path)
  );
}

export function hidesJasonosChrome(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return (
    matchesPathPrefix(path, "/login") ||
    matchesPathPrefix(path, "/auth") ||
    matchesPathPrefix(path, "/iugr") ||
    matchesPathPrefix(path, "/projects/ski-tracker") ||
    matchesPathPrefix(path, "/projects/dark-matter-travel-tracker") ||
    matchesPathPrefix(path, "/dark-matter") ||
    matchesPathPrefix(path, "/rank") ||
    matchesPathPrefix(path, "/christmas") ||
    matchesPathPrefix(path, "/projects/family-meeting/print")
  );
}
