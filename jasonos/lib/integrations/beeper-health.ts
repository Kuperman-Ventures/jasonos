// Shared Beeper Test Connection / Sync probe interpretation.
// GET /v1/info is Desktop discovery ("use before authentication setup") and
// can return 200 even when the token is dead. Chat/account routes 401.

export type BeeperAuthProbe =
  | { kind: "healthy" }
  | { kind: "expired" }
  | { kind: "bad_response"; status: number }
  | { kind: "unreachable" };

export function isAuthDeniedStatus(status: number): boolean {
  return status === 401 || status === 403;
}

/**
 * `null` status = network/timeout (never got an HTTP code).
 * Info 200 + accounts 401 is the false-green Test Connection case.
 */
export function interpretBeeperAuthStatuses(
  infoStatus: number | null,
  accountsStatus: number | null
): BeeperAuthProbe {
  if (infoStatus == null) return { kind: "unreachable" };
  if (isAuthDeniedStatus(infoStatus)) return { kind: "expired" };
  if (infoStatus < 200 || infoStatus >= 300) {
    return { kind: "bad_response", status: infoStatus };
  }
  if (accountsStatus == null) return { kind: "unreachable" };
  if (isAuthDeniedStatus(accountsStatus)) return { kind: "expired" };
  if (accountsStatus < 200 || accountsStatus >= 300) {
    return { kind: "bad_response", status: accountsStatus };
  }
  return { kind: "healthy" };
}
