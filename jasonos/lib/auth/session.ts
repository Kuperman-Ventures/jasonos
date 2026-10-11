export const JASONOS_UNLOCK_COOKIE = "jasonos_unlocked_at";
export const JASONOS_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const JASONOS_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** Emergency switch: Google/email can stamp a 7-day unlock without a passkey. Off by default. */
export function googleUnlockAllowed(): boolean {
  const value = process.env.JASONOS_ALLOW_GOOGLE_UNLOCK?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function unlockSigningSecret(): string {
  return (
    process.env.JASONOS_UNLOCK_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toHex(sig);
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function unlockCookieValue(now = Date.now()): Promise<string | null> {
  const secret = unlockSigningSecret();
  if (!secret) return null;
  const ts = String(now);
  const sig = await hmacHex(secret, ts);
  return `${ts}.${sig}`;
}

export async function isUnlockStampFresh(
  value: string | undefined,
  now = Date.now()
): Promise<boolean> {
  if (!value) return false;
  const secret = unlockSigningSecret();
  if (!secret) return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const ts = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const unlockedAt = Number(ts);
  if (!Number.isFinite(unlockedAt) || unlockedAt <= 0) return false;
  const age = now - unlockedAt;
  if (age < 0 || age > JASONOS_SESSION_MAX_AGE_MS) return false;
  const expected = await hmacHex(secret, ts);
  return timingSafeHexEqual(expected, sig);
}

export function unlockCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: JASONOS_SESSION_MAX_AGE_SECONDS,
  };
}

export function authConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
