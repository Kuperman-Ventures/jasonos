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
  "/auth/",
  "/iugr",
  "/projects/ski-tracker",
  "/api/ski-tracker",
  "/api/mcp",
  "/.well-known",
  "/api/auth/google/callback",
  "/api/auth/microsoft/callback",
  "/api/morning-brief/publish",
  "/api/inbox-dispatch/publish",
];

const CRON_PATHS = new Set([
  "/api/bna",
  "/api/monitoring/health-check",
  "/api/inbox-dispatch",
  "/api/job-alerts/harvest",
  "/api/browning-networking/run",
]);

export const PUBLIC_SURFACE_HEADER = "x-jasonos-public";

export function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export function isPublicJasonosPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (PUBLIC_EXACT.has(path)) return true;
  if (path.startsWith("/_next")) return true;
  return PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(prefix));
}

export function isCronPath(pathname: string): boolean {
  return CRON_PATHS.has(normalizePathname(pathname));
}

export function hidesJasonosChrome(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return (
    path === "/login" ||
    path.startsWith("/login/") ||
    path.startsWith("/auth/") ||
    path === "/iugr" ||
    path.startsWith("/iugr/") ||
    path === "/projects/ski-tracker" ||
    path.startsWith("/projects/ski-tracker/")
  );
}
