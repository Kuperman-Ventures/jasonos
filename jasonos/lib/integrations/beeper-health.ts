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

/** Reject Sync-toast paste-ins and other non-token junk before fetch. */
export function describeBeeperTokenProblem(token: string): string | null {
  const value = token.trim();
  if (!value) return "Paste a Desktop API access token.";
  // People paste the Sync failure toast into the token field. That string
  // includes a unicode arrow and makes fetch throw "couldn't reach…".
  if (
    /failed:\s*beeper|beeper api\s*401|token expired|hit test connection|approved connections/i.test(
      value
    )
  ) {
    return "That looks like a Sync error message, not a Beeper token. In Beeper Desktop → Settings → Integrations → Approved connections, create a new token and paste only that token here.";
  }
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) > 255) {
      return "That token has invalid characters (often from pasting an error toast). Create a new Desktop API token in Beeper and paste only the token.";
    }
  }
  if (/\s/.test(value)) {
    return "Beeper tokens don’t contain spaces. Paste only the token from Approved connections.";
  }
  return null;
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
