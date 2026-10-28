/** Build a calendar event title for a Commitment Check work block. */

export type CommitmentTitleInput = {
  promise: string;
  to: string;
  due_date: string | null;
  context: string | null;
};

/** Deterministic fallback when AI is unavailable or returns junk. */
export function fallbackCommitmentEventTitle(input: CommitmentTitleInput): string {
  const promise = clean(input.promise);
  const to = clean(input.to);
  if (!promise && !to) return "Commitment work";
  if (!promise) return `Work for ${to}`.slice(0, 80);
  if (!to || /^self$/i.test(to)) return clip(promise, 80);
  const withTo = `${promise} (${to})`;
  return clip(withTo.length <= 80 ? withTo : promise, 80);
}

export function commitmentEventDescription(input: CommitmentTitleInput & {
  source_url?: string | null;
}): string {
  const lines = [
    `Promise: ${clean(input.promise) || "(none)"}`,
    `To: ${clean(input.to) || "(unknown)"}`,
  ];
  if (input.due_date) lines.push(`Due: ${input.due_date}`);
  if (clean(input.context)) lines.push(`Context: ${clean(input.context)}`);
  if (input.source_url?.trim()) lines.push(`Source: ${input.source_url.trim()}`);
  lines.push("", "Scheduled from JasonOS Commitments.");
  return lines.join("\n");
}

/** Keep model output as a usable calendar summary. */
export function sanitizeCommitmentEventTitle(
  raw: string,
  fallback: string
): string {
  let title = raw
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^title\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!title || title.length < 3) return fallback;
  if (/^(commitment|task|todo|work block)\s*:?\s*$/i.test(title)) return fallback;
  return clip(title, 80);
}

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
