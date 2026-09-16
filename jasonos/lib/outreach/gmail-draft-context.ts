// Pure Gmail-history shaping for outreach drafts. No Gmail API, no server-only
// imports — unit tests cover query building, quote stripping, and the summary
// that Claude actually sees.

/** Keep in sync with OUTLOOK_WRAP_EMAIL in unwrap-forwarded-mail.ts. */
const OUTLOOK_WRAP_EMAIL = "jason.kuperman@outlook.com";

export type GmailHistoryDepth = "preview" | "draft";

export const GMAIL_HISTORY_LIMITS = {
  preview: {
    searchSize: 5,
    fullThreads: 1,
    domainSearchSize: 0,
    domainFullThreads: 0,
    messagesPerThread: 3,
    bodyChars: 1200,
    maxSummaryChars: 6_000,
    domainMaxSummaryChars: 0,
  },
  draft: {
    searchSize: 20,
    fullThreads: 10,
    domainSearchSize: 15,
    domainFullThreads: 6,
    messagesPerThread: 12,
    bodyChars: 2_500,
    maxSummaryChars: 16_000,
    domainMaxSummaryChars: 8_000,
  },
} as const;

export interface DraftMailMessage {
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  snippet?: string;
  plaintextBody?: string;
  internalDate?: number;
}

export interface DraftMailThread {
  id: string;
  messages: DraftMailMessage[];
}

export interface DraftMailThreadMeta {
  id: string;
  snippet?: string;
}

export function uniqueContactEmails(input: {
  primaryEmail?: string | null;
  emails?: string[] | null;
}): string[] {
  const raw = [...(input.emails ?? []), input.primaryEmail ?? ""];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of raw) {
    const email = value.trim().toLowerCase();
    if (!email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export function gmailQueryForContactEmails(emails: string[]): string | null {
  if (!emails.length) return null;
  const terms = emails.map((email) => {
    const q = quoteGmailTerm(email);
    return `from:${q} OR to:${q}`;
  });
  const any = emails.map(quoteGmailTerm).join(" OR ");
  return `(${terms.join(" OR ")}) OR (from:${OUTLOOK_WRAP_EMAIL} (${any}))`;
}

/**
 * Company domains worth searching as firm background. Skip Gmail/Yahoo/etc.,
 * Jason's own domains, and a few platforms whose @domain mail is mostly noise.
 */
const SKIP_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "outlook.co.uk",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "hey.com",
  "fastmail.com",
  "zoho.com",
  "gmx.com",
  "gmx.net",
  "yandex.com",
  "mail.com",
  "kupermanadvisors.com",
  "google.com",
  "googlegroups.com",
  "linkedin.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "github.com",
  "apple.com",
  "amazon.com",
  "paypal.com",
  "beeper.invalid",
]);

export function emailDomain(email: string): string | null {
  const at = email.trim().toLowerCase().lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.trim().toLowerCase().slice(at + 1);
  return domain.includes(".") ? domain : null;
}

export function isSearchableCompanyDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase();
  if (!d.includes(".")) return false;
  if (SKIP_EMAIL_DOMAINS.has(d)) return false;
  const labels = d.split(".");
  // mail.google.com, smtp.gmail.com, etc.
  if (labels.some((_, i) => SKIP_EMAIL_DOMAINS.has(labels.slice(i).join(".")))) {
    return false;
  }
  return true;
}

export function companyDomainsFromEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const email of emails) {
    const domain = emailDomain(email);
    if (!domain || !isSearchableCompanyDomain(domain) || seen.has(domain)) continue;
    seen.add(domain);
    out.push(domain);
  }
  return out;
}

/** Other people at the same company — excludes the recipient's own addresses. */
export function gmailQueryForCompanyDomains(
  domains: string[],
  excludeEmails: string[] = []
): string | null {
  if (!domains.length) return null;
  const domainTerms = domains.map((domain) => {
    const q = quoteGmailTerm(`@${domain}`);
    return `from:${q} OR to:${q}`;
  });
  const wrapHaystack = domains.map((domain) => quoteGmailTerm(domain)).join(" OR ");
  let query = `(${domainTerms.join(" OR ")}) OR (from:${OUTLOOK_WRAP_EMAIL} (${wrapHaystack}))`;
  for (const email of excludeEmails) {
    const q = quoteGmailTerm(email);
    query += ` -from:${q} -to:${q}`;
  }
  return query;
}

function quoteGmailTerm(value: string): string {
  if (/^[^\s"]+$/.test(value)) return value;
  return `"${value.replace(/"/g, "")}"`;
}

/** Keep the new text; drop the quoted prior thread that Gmail/Outlook append. */
export function stripQuotedReply(body: string): string {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^On .+wrote:\s*$/i.test(trimmed)) break;
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(trimmed)) break;
    if (/^-{2,}\s*Forwarded message\s*-{2,}/i.test(trimmed)) break;
    if (/^Begin forwarded message:/i.test(trimmed)) break;
    if (/^_{5,}$/.test(trimmed)) break;
    if (
      /^From:\s.+/i.test(trimmed) &&
      i + 1 < lines.length &&
      /^(Sent|Date):\s/i.test(lines[i + 1].trim())
    ) {
      break;
    }
    if (trimmed.startsWith(">")) continue;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

export function messageTimeMs(message: DraftMailMessage): number {
  if (message.internalDate && Number.isFinite(message.internalDate)) {
    return message.internalDate;
  }
  if (message.date) {
    const parsed = new Date(message.date).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function sortMessagesChronologically(
  messages: DraftMailMessage[]
): DraftMailMessage[] {
  return [...messages].sort((a, b) => messageTimeMs(a) - messageTimeMs(b));
}

export function lastMessageTimeMs(thread: DraftMailThread): number {
  const sorted = sortMessagesChronologically(thread.messages);
  return messageTimeMs(sorted[sorted.length - 1] ?? {});
}

/**
 * Whole short threads stay intact. Long threads keep the opener (how this
 * conversation started) plus the newest tail.
 */
export function selectThreadMessages(
  messages: DraftMailMessage[],
  limit: number
): DraftMailMessage[] {
  const sorted = sortMessagesChronologically(messages);
  if (sorted.length <= limit) return sorted;
  const first = sorted[0];
  const tail = sorted.slice(-(limit - 1));
  if (tail[0] === first) return tail;
  return [first, ...tail];
}

export function formatThreadForDraft(
  thread: DraftMailThread,
  options: { messagesPerThread: number; bodyChars: number }
): string {
  const selected = selectThreadMessages(thread.messages, options.messagesPerThread);
  const blocks = selected.map((message) => formatMessage(message, options.bodyChars));
  const subject = selected[0]?.subject || selected[selected.length - 1]?.subject;
  const header = subject
    ? `Thread: ${subject} (${selected.length} of ${thread.messages.length} messages)`
    : `Thread (${selected.length} of ${thread.messages.length} messages)`;
  return [header, ...blocks].join("\n\n");
}

function formatMessage(message: DraftMailMessage, bodyChars: number): string {
  const raw = (message.plaintextBody || message.snippet || "").trim();
  const body = stripQuotedReply(raw).slice(0, bodyChars);
  return [
    message.date ? `Date: ${message.date}` : null,
    message.from ? `From: ${message.from}` : null,
    message.to ? `To: ${message.to}` : null,
    message.subject ? `Subject: ${message.subject}` : null,
    body || "(no body)",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildGmailHistorySummary(input: {
  searchedCount: number;
  fullThreads: DraftMailThread[];
  leftover: DraftMailThreadMeta[];
  messagesPerThread: number;
  bodyChars: number;
  maxSummaryChars: number;
  title?: string;
}): string {
  const newestFirst = [...input.fullThreads].sort(
    (a, b) => lastMessageTimeMs(b) - lastMessageTimeMs(a)
  );

  const header =
    input.title ??
    `Found ${input.searchedCount} Gmail thread(s). Opened ${newestFirst.length} in full, newest first.`;
  const parts: string[] = [header];
  let used = header.length;

  for (const thread of newestFirst) {
    const formatted = formatThreadForDraft(thread, {
      messagesPerThread: input.messagesPerThread,
      bodyChars: input.bodyChars,
    });
    const chunk = `\n\n${formatted}`;
    if (used + chunk.length > input.maxSummaryChars) {
      const room = input.maxSummaryChars - used - 20;
      if (room > 400) {
        parts.push(formatted.slice(0, room) + "\n[truncated]");
      }
      used = input.maxSummaryChars;
      break;
    }
    parts.push(formatted);
    used += chunk.length;
  }

  if (input.leftover.length && used < input.maxSummaryChars - 200) {
    const leftoverLines = input.leftover
      .map((thread) => `- ${thread.snippet?.trim() || thread.id}`)
      .join("\n");
    const leftoverBlock = `\n\nOlder matching threads (snippet only):\n${leftoverLines}`;
    const room = input.maxSummaryChars - used;
    parts.push(
      leftoverBlock.length > room
        ? leftoverBlock.slice(0, room) + "\n[truncated]"
        : leftoverBlock.trimStart()
    );
  }

  return parts.join("\n\n").trim();
}

export function buildDraftGmailHistorySummary(input: {
  person: {
    searchedCount: number;
    fullThreads: DraftMailThread[];
    leftover: DraftMailThreadMeta[];
  };
  company: {
    domains: string[];
    searchedCount: number;
    fullThreads: DraftMailThread[];
    leftover: DraftMailThreadMeta[];
  };
  messagesPerThread: number;
  bodyChars: number;
  personMaxChars: number;
  companyMaxChars: number;
}): string {
  const personTitle = input.person.searchedCount
    ? `With this person: found ${input.person.searchedCount} Gmail thread(s). Opened ${input.person.fullThreads.length} in full, newest first.`
    : "With this person: no Gmail threads found.";
  const person = buildGmailHistorySummary({
    searchedCount: input.person.searchedCount,
    fullThreads: input.person.fullThreads,
    leftover: input.person.leftover,
    messagesPerThread: input.messagesPerThread,
    bodyChars: input.bodyChars,
    maxSummaryChars: input.personMaxChars,
    title: personTitle,
  });

  if (!input.company.domains.length || input.company.searchedCount === 0) {
    return person;
  }

  const domainList = input.company.domains.join(", ");
  const company = buildGmailHistorySummary({
    searchedCount: input.company.searchedCount,
    fullThreads: input.company.fullThreads,
    leftover: input.company.leftover,
    messagesPerThread: Math.min(input.messagesPerThread, 8),
    bodyChars: Math.min(input.bodyChars, 1_500),
    maxSummaryChars: input.companyMaxChars,
    title: `Same company (${domainList}): found ${input.company.searchedCount} thread(s) with other people at the firm. Opened ${input.company.fullThreads.length} in full. Background only. Do not treat these as emails from the recipient.`,
  });

  return `${person}\n\n---\n\n${company}`;
}
