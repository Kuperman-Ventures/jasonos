export const JASONOS_UNLOCK_COOKIE = "jasonos_unlocked_at";
export const JASONOS_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const JASONOS_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function isUnlockStampFresh(value: string | undefined, now = Date.now()): boolean {
  if (!value) return false;
  const unlockedAt = Number(value);
  if (!Number.isFinite(unlockedAt) || unlockedAt <= 0) return false;
  const age = now - unlockedAt;
  return age >= 0 && age <= JASONOS_SESSION_MAX_AGE_MS;
}

export function unlockCookieValue(now = Date.now()): string {
  return String(now);
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
