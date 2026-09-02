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

export type SuggestedScanResult =
  | {
      ok: true;
      scanned: number;
      created: number;
      updated: number;
      skipped: number;
    }
  | { ok: false; error: string };

export function combineSuggestedScanResult(input: {
  gmail: SuggestedScanPart;
  gcal: SuggestedScanPart;
  capture: SuggestedCapturePart;
}): SuggestedScanResult {
  const gmailStaged = input.gmail.ok ? (input.gmail.candidatesStaged ?? 0) : 0;
  const gcalStaged = input.gcal.ok ? (input.gcal.candidatesStaged ?? 0) : 0;
  const captureCreated = input.capture.ok ? input.capture.created : 0;
  const created = gmailStaged + gcalStaged + captureCreated;
  const scanned = input.capture.ok ? input.capture.scanned : 0;
  const updated = input.capture.ok ? input.capture.updated : 0;
  const skipped = input.capture.ok ? input.capture.skipped : 0;

  if (input.capture.ok || created > 0 || input.gmail.ok || input.gcal.ok) {
    return { ok: true, scanned, created, updated, skipped };
  }

  return {
    ok: false,
    error:
      input.capture.error ||
      input.gmail.error ||
      input.gcal.error ||
      "Scan failed",
  };
}
