const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

const attempts = new Map<string, number[]>();

export function mcpLoginAllowed(ip: string, now = Date.now()): boolean {
  const key = ip.trim() || "unknown";
  const recent = (attempts.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(key, recent);
    return false;
  }
  recent.push(now);
  attempts.set(key, recent);
  return true;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
