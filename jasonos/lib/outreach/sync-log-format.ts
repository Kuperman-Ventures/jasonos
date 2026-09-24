// Pure Sync Log summary helpers — no DB / server-only, safe for unit tests.

export function payloadIssueLines(
  payload: Record<string, unknown>
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };

  if (typeof payload.error === "string") push(payload.error);

  for (const key of ["errors", "warnings"] as const) {
    const raw = payload[key];
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      if (typeof item === "string") push(item);
    }
  }

  return out;
}

export function payloadIssueText(
  payload: Record<string, unknown>
): string | null {
  const lines = payloadIssueLines(payload);
  return lines.length ? lines.join(" · ") : null;
}

export function isUnavailablePayload(
  payload: Record<string, unknown>
): boolean {
  return payload.unavailable === true;
}

/**
 * Soft folder/mailbox warnings keep ok:true. Hard insert / pre-check
 * failures in `errors` flip the run to failed even when callers forgot
 * to set ok:false.
 */
export function isOkPayload(payload: Record<string, unknown>): boolean {
  if (isUnavailablePayload(payload)) return true;
  if (payload.ok === false) return false;

  const hardErrors = Array.isArray(payload.errors)
    ? payload.errors.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0
      )
    : [];
  if (hardErrors.length) return false;

  const error = typeof payload.error === "string" ? payload.error.trim() : "";
  if (
    error &&
    payload.ok !== true &&
    !("inserted" in payload) &&
    !("created" in payload) &&
    !("matched" in payload)
  ) {
    return false;
  }
  return true;
}

function num(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function namesClip(payload: Record<string, unknown>, limit = 4): string | null {
  const raw = payload.unmatchedNames;
  if (!Array.isArray(raw) || !raw.length) return null;
  const names = raw
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
    .map((n) => n.trim());
  if (!names.length) return null;
  const shown = names.slice(0, limit);
  const extra = names.length - shown.length;
  return extra > 0 ? `${shown.join(", ")}, +${extra} more` : shown.join(", ");
}

function suggestedClip(payload: Record<string, unknown>): string | null {
  const staged = num(payload, "candidatesStaged") || num(payload, "created");
  const names = namesClip(payload);
  if (staged <= 0 && !names) return null;
  const count =
    staged ||
    (Array.isArray(payload.unmatchedNames) ? payload.unmatchedNames.length : 0);
  return names ? `+${count} to Suggested (${names})` : `+${count} to Suggested`;
}

/** One-line description of a sync payload for the log list. */
export function formatSyncSummary(
  source: string,
  payload: Record<string, unknown>
): string {
  const issues = payloadIssueLines(payload);
  const error = issues[0] ?? null;

  if (isUnavailablePayload(payload)) {
    return error ?? "skipped";
  }
  if (!isOkPayload(payload)) {
    return issues.length ? `failed: ${issues.join(" · ")}` : "failed";
  }

  if (source === "sent-followups") {
    const created = num(payload, "created");
    const updated = num(payload, "updated");
    const scanned = num(payload, "scanned");
    const parts = [`+${created} to review`];
    if (updated) parts.push(`${updated} reopened`);
    if (scanned) parts.push(`${scanned} threads`);
    if (issues.length) parts.push(issues.join(" · "));
    return parts.join(" · ");
  }

  if (source === "suggested") {
    const created = num(payload, "created");
    const updated = num(payload, "updated");
    const scanned = num(payload, "scanned");
    const skipped = num(payload, "skipped");
    const names = namesClip(payload);
    const parts: string[] = [];
    if (created || names) {
      parts.push(names ? `+${created} new (${names})` : `+${created} new`);
    } else {
      parts.push("+0 new");
    }
    if (updated) parts.push(`${updated} updated`);
    if (scanned) parts.push(`${scanned} scanned`);
    if (skipped) parts.push(`${skipped} skipped`);
    if (issues.length) parts.push(issues.join(" · "));
    return parts.join(" · ");
  }

  const inserted = num(payload, "inserted");
  const duplicates = num(payload, "duplicates");
  const cadence = num(payload, "cadenceUpdates");
  const meetingsInserted = num(payload, "meetingsInserted");
  const meetingsUpdated = num(payload, "meetingsUpdated");
  const parts = [`${inserted > 0 ? "+" : ""}${inserted} new`];
  if (duplicates) parts.push(`${duplicates} already captured`);
  if (cadence) parts.push(`advanced ${cadence}`);
  if (meetingsInserted) parts.push(`+${meetingsInserted} meetings`);
  else if (meetingsUpdated) parts.push(`${meetingsUpdated} meetings updated`);
  const staged = suggestedClip(payload);
  if (staged) parts.push(staged);
  if (issues.length) parts.push(issues.join(" · "));
  return parts.join(" · ");
}
