// Shared window for Suggested "Scan email" and the Sync button's
// people-finding pass. Matches the regular Sync lookback: 90 days of mail
// plus calendar guests 90 days back / 30 days forward.

export const SUGGESTED_SCAN_DAYS_BACK = 90;
export const SUGGESTED_SCAN_DAYS_FORWARD = 30;
/** Metadata pass — high enough to cover 90 days of both inboxes. */
export const SUGGESTED_SCAN_MESSAGE_MAX = 2000;

export type SuggestedScanPart = {
  ok: boolean;
  candidatesStaged?: number;
  error?: string;
};

export type SuggestedCapturePart =
  | {
      ok: true;
      scanned: number;
      created: number;
      updated: number;
      skipped: number;
    }
  | { ok: false; error: string };

export type SuggestedBeeperPart = {
  ok: boolean;
  unavailable?: boolean;
  inserted?: number;
  matched?: number;
  candidatesStaged?: number;
  error?: string;
};

export type SuggestedScanResult =
  | {
      ok: true;
      scanned: number;
      created: number;
      updated: number;
      skipped: number;
      beeper?: SuggestedBeeperPart;
    }
  | { ok: false; error: string };

export function humanScanError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/timeout|timed out|aborted|FUNCTION_INVOCATION/i.test(msg)) {
    return "Scan ran too long and was cut off. Try again.";
  }
  return msg.trim() || "Scan failed";
}

export function scanPartFromUnknown(err: unknown): SuggestedScanPart {
  return { ok: false, error: humanScanError(err) };
}

export function capturePartFromUnknown(err: unknown): SuggestedCapturePart {
  return { ok: false, error: humanScanError(err) };
}

export function beeperScanLine(beeper?: SuggestedBeeperPart): string | null {
  if (!beeper) return null;
  if (beeper.unavailable) return beeper.error || "Beeper closed — skipped";
  if (beeper.ok) {
    const n = beeper.inserted ?? beeper.matched ?? 0;
    return n > 0 ? `Beeper +${n}` : "Beeper checked";
  }
  return beeper.error ? `Beeper: ${beeper.error}` : null;
}

export function combineSuggestedScanResult(input: {
  gmail: SuggestedScanPart;
  gcal: SuggestedScanPart;
  capture: SuggestedCapturePart;
  beeper?: SuggestedBeeperPart;
}): SuggestedScanResult {
  const gmailStaged = input.gmail.ok ? (input.gmail.candidatesStaged ?? 0) : 0;
  const gcalStaged = input.gcal.ok ? (input.gcal.candidatesStaged ?? 0) : 0;
  const beeperStaged =
    input.beeper?.ok && !input.beeper.unavailable
      ? (input.beeper.candidatesStaged ?? 0)
      : 0;
  const captureCreated = input.capture.ok ? input.capture.created : 0;
  const created = gmailStaged + gcalStaged + beeperStaged + captureCreated;
  const scanned = input.capture.ok ? input.capture.scanned : 0;
  const updated = input.capture.ok ? input.capture.updated : 0;
  const skipped = input.capture.ok ? input.capture.skipped : 0;
  const beeperOk = Boolean(
    input.beeper && (input.beeper.ok || input.beeper.unavailable)
  );

  if (
    input.capture.ok ||
    created > 0 ||
    input.gmail.ok ||
    input.gcal.ok ||
    beeperOk
  ) {
    return {
      ok: true,
      scanned,
      created,
      updated,
      skipped,
      beeper: input.beeper,
    };
  }

  return {
    ok: false,
    error:
      input.capture.error ||
      input.gmail.error ||
      input.gcal.error ||
      input.beeper?.error ||
      "Scan failed",
  };
}
