export type LibraryChannel = "email" | "linkedin" | "text";

export const LIBRARY_CHANNEL_LABEL: Record<LibraryChannel, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  text: "Text",
};

export function libraryChannelLabel(channel: LibraryChannel): string {
  return LIBRARY_CHANNEL_LABEL[channel];
}

/** Store the body as pasted, with Windows line endings turned into `\n`. */
export function storedLibraryBody(body: string): string {
  return body.replace(/\r\n/g, "\n");
}

/** Hash input: stored body, with leading and trailing whitespace removed. */
export function libraryBodyHashSource(body: string): string {
  return storedLibraryBody(body).trim();
}

/**
 * Title used when the title field is left blank.
 * First non-empty line, a leading "Subject:" removed, cut at 80 characters.
 */
export function defaultLibraryTitle(body: string): string {
  const line =
    storedLibraryBody(body)
      .split("\n")
      .find((entry) => entry.trim().length > 0) ?? "";
  const stripped = line.replace(/^\s*subject:\s*/i, "").trim();
  const cut = stripped.slice(0, 80).trim();
  return cut || "Untitled";
}

/**
 * Paste helper. Only when the pasted text's first line starts with "Subject:".
 * Returns the subject and the message with that line, plus one following blank
 * line, removed. Returns null when the paste should be left alone.
 */
export function extractSubjectOnPaste(
  pasted: string
): { subject: string; body: string } | null {
  const normalized = storedLibraryBody(pasted);
  const lines = normalized.split("\n");
  const first = lines[0] ?? "";
  if (!/^subject:/i.test(first)) return null;
  const subject = first.replace(/^subject:\s*/i, "").trim();
  let rest = lines.slice(1);
  if (rest.length > 0 && rest[0].trim() === "") rest = rest.slice(1);
  return { subject, body: rest.join("\n") };
}

export function todayYmd(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function isLibraryYmd(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function formatMonthDay(date: Date, now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
}

/** Detail date, always with the year: "Oct 2, 2026". */
export function formatSentOnLong(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** Calendar date from `YYYY-MM-DD`, shown as "Oct 12". */
export function formatSentOn(ymd: string, now = new Date()): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return formatMonthDay(date, now);
}

export function formatCopiedOn(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return formatMonthDay(date, now);
}

export function formatCopyLine(
  count: number,
  lastCopiedAt: string | null,
  now = new Date()
): string {
  if (count <= 0 || !lastCopiedAt) return "Not copied yet";
  const times = count === 1 ? "time" : "times";
  return `Copied ${count} ${times}, last on ${formatCopiedOn(lastCopiedAt, now)}`;
}

export type LibrarySearchFields = {
  title: string;
  body: string;
  subject: string | null;
  company: string | null;
  contacts: { name: string; company: string | null }[];
};

export function librarySearchMatch(item: LibrarySearchFields, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const fields = [
    item.title,
    item.body,
    item.subject ?? "",
    item.company ?? "",
    ...item.contacts.flatMap((contact) => [contact.name, contact.company ?? ""]),
  ];
  return fields.some((field) => field.toLowerCase().includes(needle));
}

/**
 * Two-line preview. With a search term that appears in the body, the window
 * is centered on the first match.
 */
export function librarySnippet(body: string, query: string): string {
  const flat = storedLibraryBody(body).replace(/\s+/g, " ").trim();
  const needle = query.trim().toLowerCase();
  if (!needle || !flat) return flat;
  const at = flat.toLowerCase().indexOf(needle);
  if (at < 0) return flat;
  const radius = 60;
  let start = Math.max(0, at - radius);
  let end = Math.min(flat.length, at + needle.length + radius);
  if (start > 0) {
    const space = flat.lastIndexOf(" ", start + 12);
    if (space >= start && space < at) start = space + 1;
  }
  if (end < flat.length) {
    const space = flat.indexOf(" ", Math.max(at + needle.length, end - 12));
    if (space > at && space <= end + 12) end = space;
  }
  const prefix = start > 0 ? "… " : "";
  const suffix = end < flat.length ? " …" : "";
  return `${prefix}${flat.slice(start, end).trim()}${suffix}`;
}

export function libraryCountLabel(total: number, shown: number, filtered: boolean): string {
  if (!filtered) {
    return `${total} ${total === 1 ? "message" : "messages"}`;
  }
  return `${shown} of ${total} shown`;
}

export function libraryRowContext(item: {
  channel: LibraryChannel;
  company: string | null;
  contacts: { name: string }[];
}): string {
  const parts = [libraryChannelLabel(item.channel)];
  if (item.contacts.length > 0) {
    const extra = item.contacts.length > 1 ? ` +${item.contacts.length - 1}` : "";
    parts.push(`${item.contacts[0].name}${extra}`);
  }
  if (item.company) parts.push(item.company);
  return parts.join(" · ");
}
