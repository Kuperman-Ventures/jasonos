// Pure Weekly Provocation matching. No network, no server-only.
// Sync uses this to decide which emails become briefs.

import {
  canonicalEmail,
  extractDisplayName,
  extractEmail,
  isFromMe,
} from "../../outreach/contact-lookup";

/** Will Duffy's known mailbox. Rover is matched by name until a contact row exists. */
export const WILL_DUFFY_EMAILS = ["wduffy@3cventures.com"];

const RESPONSE_ASK =
  /\b(respond|response|reply|your take|weigh in|thoughts|answer|write back)\b/i;

export function htmlToText(value: string): string {
  const raw = value.replace(/\r\n/g, "\n");
  if (!/<[a-z][\s\S]*>/i.test(raw)) return raw.trim();
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const QUOTE_MARKERS = [
  /\nOn [\s\S]{0,220}?wrote:\s*\n/i,
  /\n-{2,}\s*Original Message\s*-{2,}/i,
  /\n_{5,}\n/,
  /\nFrom:\s.+\nSent:\s/i,
  /\nFrom:\s.+\nDate:\s/i,
];

/** Drop a quoted prior thread when the new message stands on its own. */
export function stripQuotedReply(text: string): string {
  let cut = text.length;
  for (const marker of QUOTE_MARKERS) {
    const match = marker.exec(text);
    if (match && match.index != null && match.index >= 40) {
      cut = Math.min(cut, match.index);
    }
  }
  return text.slice(0, cut).trim();
}

export function rawDisplayName(from: string): string {
  const match = from.match(/^([^<]+)</);
  return (match?.[1] ?? "").trim().replace(/^"|"$/g, "").trim();
}

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/['’.]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function isWillDuffyName(tokens: string[]): boolean {
  if (tokens.length < 2) return false;
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  return (first === "will" || first === "william") && last === "duffy";
}

/**
 * True for Will Duffy or Rover. Extra emails come from contact rows whose
 * names already match, so a Rover address added in People is picked up.
 */
export function isProvocationSender(
  from: string,
  extraEmails: readonly string[] = []
): boolean {
  if (!from.trim() || isFromMe(from)) return false;
  const email = canonicalEmail(from);
  const known = new Set(
    [...WILL_DUFFY_EMAILS, ...extraEmails].map((item) => canonicalEmail(item))
  );
  if (email.includes("@") && known.has(email)) return true;

  const tokens = nameTokens(
    extractDisplayName(from) || rawDisplayName(from) || from
  );
  const local = email.split("@")[0] ?? "";
  if (isWillDuffyName(tokens)) return true;
  if (tokens.includes("rover")) return true;
  if (local === "rover") return true;
  return false;
}

/** The note is asking for a response to a provocation, not a passing use of the word. */
export function looksLikeProvocationRequest(subject: string, body: string): boolean {
  const subjectText = subject.trim();
  const bodyText = body.trim();
  const haystack = `${subjectText}\n${bodyText}`;
  if (/weekly\s+provocations?/i.test(haystack)) return true;
  if (/this\s+week['’]?s\s+provocation/i.test(haystack)) return true;
  if (/\bprovocations?\b/i.test(subjectText)) return true;
  return (
    /\bprovocations?\b/i.test(bodyText) && RESPONSE_ASK.test(haystack)
  );
}

export function isWeeklyProvocationMessage(input: {
  from: string;
  subject: string;
  body: string;
  extraEmails?: readonly string[];
}): boolean {
  if (!isProvocationSender(input.from, input.extraEmails ?? [])) return false;
  return looksLikeProvocationRequest(input.subject, input.body);
}

/**
 * Text sent to the reader model. Keep a short new note plus its questions.
 * If the provocation only shows up under a forward header, keep the full note.
 */
export function bodyForParsing(raw: string): string {
  const full = htmlToText(raw).trim();
  if (!full) return "";
  const stripped = stripQuotedReply(full);
  const strippedHasAsk =
    stripped.length >= 80 &&
    (looksLikeProvocationRequest("", stripped) || /\?/.test(stripped));
  if (strippedHasAsk) return stripped;
  return full;
}

export function bestBody(
  plain?: string | null,
  html?: string | null,
  snippet?: string | null
): string {
  const fromPlain = bodyForParsing(plain ?? "");
  const fromHtml = bodyForParsing(html ?? "");
  const chosen = fromHtml.length > fromPlain.length ? fromHtml : fromPlain;
  return chosen || (snippet ?? "").trim();
}

export function gmailProvocationQuery(input: {
  after: string;
  extraEmails?: readonly string[];
}): string {
  const from = [
    "from:wduffy@3cventures.com",
    'from:"will duffy"',
    "from:rover",
    ...(input.extraEmails ?? [])
      .map((email) => canonicalEmail(email))
      .filter((email) => email.includes("@"))
      .map((email) => `from:${email}`),
  ];
  const uniqueFrom = [...new Set(from)];
  return `(${uniqueFrom.join(" OR ")}) (provocation OR "weekly provocation") after:${input.after} -in:spam -in:trash -in:drafts`;
}

export function normalizeRfc822(value: string | null | undefined): string | null {
  const cleaned = value?.trim().replace(/^<|>$/g, "").toLowerCase() ?? "";
  return cleaned || null;
}

export function senderEmail(from: string): string {
  const email = extractEmail(from).trim().toLowerCase();
  return email.includes("@") ? email : "";
}
