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

export function buildPlainTextRawMessage(input: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
}): string {
  const headers = [
    `To: ${input.to}`,
    input.cc ? `Cc: ${input.cc}` : null,
    input.bcc ? `Bcc: ${input.bcc}` : null,
    `Subject: ${encodeMimeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    input.inReplyTo ? `In-Reply-To: ${input.inReplyTo}` : null,
    input.inReplyTo ? `References: ${input.inReplyTo}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\r\n");
  const bodyB64 = Buffer.from(input.body, "utf8").toString("base64");
  const wrapped = bodyB64.replace(/.{1,76}/g, (line) => `${line}\r\n`).trimEnd();
  return `${headers}\r\n\r\n${wrapped}\r\n`;
}
