// Unwrap Outlook → Gmail forwards so pipelines see the original correspondent,
// not jason.kuperman@outlook.com emailing Jason's connected Gmail.
// Gmail-side only. No Microsoft Graph.

export const OUTLOOK_WRAP_EMAIL = "jason.kuperman@outlook.com";

const WRAP_ADDRESSES = [OUTLOOK_WRAP_EMAIL];

const HEADER_LINE =
  /^(From|Sent|Date|To|Cc|CC|Subject)\s*:\s*(.*)$/i;

const FORWARD_SEPARATOR =
  /(?:^|\n)(?:-+\s*Forwarded message\s*-+|-{2,}\s*Original Message\s*-+|Begin forwarded message:)\s*(?:\n|$)/i;

export interface ForwardMailInput {
  from?: string;
  replyTo?: string;
  to?: string;
  cc?: string;
  subject?: string;
  plaintextBody?: string;
  htmlBody?: string;
}

export interface UnwrappedMail {
  from: string;
  fromEmail: string;
  fromName?: string;
  to?: string;
  cc?: string;
  date?: string;
  /** Original subject with leading FW:/Fwd:/Re: stripped. */
  subject?: string;
  body: string;
}

export function extractHeaderEmail(value: string): string {
  const mailto = value.match(/\[mailto:([^\]]+)\]/i);
  if (mailto?.[1]) return mailto[1].trim().toLowerCase();
  const angled = value.match(/<([^>]+)>/);
  return (angled?.[1] ?? value).trim().toLowerCase();
}

export function parseAddressHeader(value: string): {
  email: string;
  name?: string;
} {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return { email: "" };

  const mailto = trimmed.match(/^(.*?)\s*\[mailto:([^\]]+)\]\s*$/i);
  if (mailto) {
    return {
      name: stripQuotes(mailto[1]) || undefined,
      email: mailto[2].trim().toLowerCase(),
    };
  }

  const angled = trimmed.match(/^(.*?)<([^>]+)>$/);
  if (angled) {
    return {
      name: stripQuotes(angled[1]) || undefined,
      email: angled[2].trim().toLowerCase(),
    };
  }

  if (trimmed.includes("@") && !trimmed.includes(" ")) {
    return { email: trimmed.toLowerCase() };
  }

  const embedded = trimmed.match(/[\w.+-]+@[\w.-]+\.\w+/);
  if (embedded) {
    return {
      name: stripQuotes(trimmed.replace(embedded[0], "")) || undefined,
      email: embedded[0].toLowerCase(),
    };
  }

  return { email: "", name: stripQuotes(trimmed) || undefined };
}

export function isOutlookWrapAddress(value: string | undefined | null): boolean {
  if (!value) return false;
  const email = extractHeaderEmail(value);
  return WRAP_ADDRESSES.some((addr) => email === addr);
}

/**
 * True when this Gmail envelope is Jason forwarding from Outlook into a
 * connected mailbox. Random FW: mail from other people is ignored.
 */
export function looksLikeOutlookWrap(input: {
  from?: string;
  replyTo?: string;
  subject?: string;
}): boolean {
  return (
    isOutlookWrapAddress(input.from) || isOutlookWrapAddress(input.replyTo)
  );
}

export function stripForwardPrefixes(subject: string): string {
  return subject.replace(/^\s*((fwd?|fw|re)\s*:\s*)+/i, "").trim();
}

/**
 * Parse Sent/Date from an unwrapped forward header block. Outlook and Gmail use
 * different formats; normalizes " at " (Gmail) before falling back to Date.parse.
 */
export function parseForwardedMailDate(
  raw: string | undefined | null
): Date | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  const candidates = [trimmed, trimmed.replace(/\s+at\s+/i, " ")];
  for (const value of candidates) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

export function htmlToPlaintext(html: string): string {
  return decodeEntities(
    html
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>\s*/gi, "\n")
      .replace(/<\/(p|div|tr|h[1-6]|li|blockquote|table)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Parse a forwarded-message header block from plaintext or HTML. */
export function parseForwardedContent(input: {
  subject?: string;
  plaintext?: string;
  html?: string;
}): UnwrappedMail | null {
  const plaintext = (input.plaintext ?? "").trim();
  const html = (input.html ?? "").trim();
  const fromPlain = parseForwardedPlaintext(plaintext);
  if (fromPlain) return fromPlain;
  if (html) return parseForwardedPlaintext(htmlToPlaintext(html));
  return null;
}

/**
 * If this is an Outlook wrap and the original headers parse, return them.
 * Otherwise null — callers keep the Gmail envelope (and must not invent a contact).
 */
export function unwrapOutlookForward(
  mail: ForwardMailInput
): UnwrappedMail | null {
  if (!looksLikeOutlookWrap(mail)) return null;
  const parsed = parseForwardedContent({
    subject: mail.subject,
    plaintext: mail.plaintextBody,
    html: mail.htmlBody,
  });
  if (!parsed?.fromEmail) return null;
  return parsed;
}

function stripQuotes(value: string): string {
  return value.trim().replace(/^["']+|["']+$/g, "").trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16))
    )
    .replace(/&amp;/gi, "&");
}

function dequoteLine(line: string): string {
  return line.replace(/^[>\s]+/, "").trimEnd();
}

function parseForwardedPlaintext(text: string): UnwrappedMail | null {
  if (!text.trim()) return null;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").map(dequoteLine);

  const start = findHeaderBlockStart(lines);
  if (start < 0) return null;

  const parsed = consumeHeaderBlock(lines, start);
  if (!parsed) return null;

  const from = parseAddressHeader(parsed.headers.from ?? "");
  if (!from.email) return null;

  const to = parsed.headers.to?.trim() || undefined;
  const cc = parsed.headers.cc?.trim() || undefined;
  const date =
    parsed.headers.sent?.trim() || parsed.headers.date?.trim() || undefined;
  const rawSubject = parsed.headers.subject?.trim();

  return {
    from: from.name ? `${from.name} <${from.email}>` : from.email,
    fromEmail: from.email,
    fromName: from.name,
    to,
    cc,
    date,
    subject: rawSubject ? stripForwardPrefixes(rawSubject) : undefined,
    body: parsed.body.replace(/^\n+/, "").trim(),
  };
}

function findHeaderBlockStart(lines: string[]): number {
  const joined = lines.join("\n");
  const sep = FORWARD_SEPARATOR.exec(joined);
  let minIndex = 0;
  if (sep && sep.index !== undefined) {
    const before = joined.slice(0, sep.index + sep[0].length);
    minIndex = before.split("\n").length - 1;
    if (minIndex < 0) minIndex = 0;
  }

  for (let i = minIndex; i < lines.length; i++) {
    if (/^From\s*:/i.test(lines[i].trim())) return i;
  }
  if (minIndex > 0) {
    for (let i = 0; i < minIndex && i < lines.length; i++) {
      if (/^From\s*:/i.test(lines[i].trim())) return i;
    }
  }
  return -1;
}

function nextNonEmptyLine(lines: string[], from: number): string | null {
  for (let i = from; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) return line;
  }
  return null;
}

function consumeHeaderBlock(
  lines: string[],
  start: number
): { headers: Record<string, string>; body: string } | null {
  const headers: Record<string, string> = {};
  let current: string | null = null;
  let i = start;
  let foundFrom = false;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      if (foundFrom) {
        // Outlook HTML often has a blank line between header fields (<br>\n).
        const next = nextNonEmptyLine(lines, i + 1);
        if (next && HEADER_LINE.test(next)) {
          i += 1;
          continue;
        }
        i += 1;
        break;
      }
      i += 1;
      continue;
    }

    const match = line.match(HEADER_LINE);
    if (match) {
      current = match[1].toLowerCase();
      headers[current] = match[2].trim();
      if (current === "from") foundFrom = true;
      i += 1;
      continue;
    }

    if (current && /^\s/.test(raw) && line) {
      headers[current] = `${headers[current]} ${line}`.trim();
      i += 1;
      continue;
    }

    if (foundFrom) break;

    i += 1;
    if (i - start > 20) return null;
  }

  if (!headers.from) return null;

  return {
    headers,
    body: lines.slice(i).join("\n"),
  };
}
