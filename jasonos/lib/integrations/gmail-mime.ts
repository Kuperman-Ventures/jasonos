/**
 * MIME helpers for Gmail raw messages (RFC 2047 headers).
 * Kept free of server-only so unit tests can import it.
 */

/** RFC 2047 encoded-word for header values that may contain non-ASCII. */
export function encodeMimeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  const b64 = Buffer.from(value, "utf8").toString("base64");
  return `=?UTF-8?B?${b64}?=`;
}

function wrapBase64(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/.{1,76}/g, (line) => `${line}\r\n`)
    .trimEnd();
}

function commonHeaders(input: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  inReplyTo?: string | null;
}): string[] {
  return [
    `To: ${input.to}`,
    input.cc ? `Cc: ${input.cc}` : null,
    input.bcc ? `Bcc: ${input.bcc}` : null,
    `Subject: ${encodeMimeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    input.inReplyTo ? `In-Reply-To: ${input.inReplyTo}` : null,
    input.inReplyTo ? `References: ${input.inReplyTo}` : null,
  ].filter((line): line is string => Boolean(line));
}

export function buildPlainTextRawMessage(input: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
}): string {
  const headers = [
    ...commonHeaders(input),
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
  ].join("\r\n");
  return `${headers}\r\n\r\n${wrapBase64(input.body)}\r\n`;
}

/** multipart/alternative so clients that prefer HTML get the designed body. */
export function buildHtmlRawMessage(input: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  htmlBody: string;
  inReplyTo?: string | null;
}): string {
  const boundary = `jasonos_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const headers = [
    ...commonHeaders(input),
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].join("\r\n");
  const parts = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(input.body),
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(input.htmlBody),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return `${headers}\r\n\r\n${parts}`;
}
