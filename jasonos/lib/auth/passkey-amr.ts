/** Methods that prove Face ID / Touch ID (or MFA WebAuthn) was used. */
export const PASSKEY_AMR_METHODS = new Set(["passkey", "mfa/webauthn", "webauthn"]);

/** Passkey must have been used within this window before we stamp unlock. */
export const PASSKEY_AMR_MAX_AGE_SECONDS = 15 * 60;

export type AmrEntry = {
  method?: string;
  timestamp?: number;
};

/**
 * Normalize JWT `amr` (object entries or RFC-8176 strings) into method + unix seconds.
 */
export function normalizeAmrEntries(amr: unknown): AmrEntry[] {
  if (!Array.isArray(amr)) return [];
  const out: AmrEntry[] = [];
  for (const entry of amr) {
    if (typeof entry === "string") {
      const method = entry.trim().toLowerCase();
      if (method) out.push({ method });
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const record = entry as { method?: unknown; timestamp?: unknown };
    const method =
      typeof record.method === "string" ? record.method.trim().toLowerCase() : "";
    if (!method) continue;
    const timestamp =
      typeof record.timestamp === "number" && Number.isFinite(record.timestamp)
        ? record.timestamp
        : undefined;
    out.push({ method, timestamp });
  }
  return out;
}

export function isPasskeyAmrMethod(method: string | undefined): boolean {
  if (!method) return false;
  return PASSKEY_AMR_METHODS.has(method.trim().toLowerCase());
}

/**
 * True when the session JWT shows a recent passkey / WebAuthn authentication.
 * Entries without a timestamp only count if the access token itself was issued recently
 * (`tokenIssuedAt` within the same max-age window).
 */
export function hasRecentPasskeyAmr(
  amr: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
  options?: { maxAgeSeconds?: number; tokenIssuedAt?: number | null }
): boolean {
  const maxAge = options?.maxAgeSeconds ?? PASSKEY_AMR_MAX_AGE_SECONDS;
  const tokenIssuedAt = options?.tokenIssuedAt;
  const entries = normalizeAmrEntries(amr);

  for (const entry of entries) {
    if (!isPasskeyAmrMethod(entry.method)) continue;
    if (typeof entry.timestamp === "number") {
      const age = nowSeconds - entry.timestamp;
      if (age >= 0 && age <= maxAge) return true;
      continue;
    }
    if (
      typeof tokenIssuedAt === "number" &&
      Number.isFinite(tokenIssuedAt) &&
      nowSeconds - tokenIssuedAt >= 0 &&
      nowSeconds - tokenIssuedAt <= maxAge
    ) {
      return true;
    }
  }
  return false;
}
