import { JASONOS_LOGIN_EMAILS, normalizeEmail } from "@/lib/auth/allowlist";
import type { ParticipantMailThread } from "@/lib/meeting-prep/email-threads";

const JASON_EMAILS = new Set<string>(JASONOS_LOGIN_EMAILS);

const JASON_DOMAINS = new Set(["kupermanadvisors.com"]);

const FREEMAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "aol.com",
]);

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export function collectParticipantTargets(
  attendees: Array<{ email: string }>
): { addresses: string[]; domains: string[] } {
  const addresses: string[] = [];
  const domains: string[] = [];
  for (const attendee of attendees) {
    const email = normalizeEmail(attendee.email);
    if (!email.includes("@") || JASON_EMAILS.has(email)) continue;
    if (!addresses.includes(email)) addresses.push(email);
    const domain = email.split("@")[1] ?? "";
    if (!domain || FREEMAIL.has(domain) || JASON_DOMAINS.has(domain)) continue;
    if (!domains.includes(domain)) domains.push(domain);
  }
  return { addresses, domains };
}

export function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(">")) continue;
    if (/^on .+ wrote:$/i.test(trimmed)) break;
    if (/^-{2,}\s*original message\s*-{2,}$/i.test(trimmed)) break;
    if (/^from:\s+\S+/i.test(trimmed) && kept.some((item) => item.trim())) break;
    kept.push(line);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function emailsIn(value: string): string[] {
  return (value.toLowerCase().match(EMAIL_RE) ?? []).map((email) => email.trim());
}

function newestFirst(thread: ParticipantMailThread): ParticipantMailThread["messages"] {
  return [...thread.messages].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export function threadSortKey(thread: ParticipantMailThread): number {
  return newestFirst(thread).reduce((max, message) => Math.max(max, Date.parse(message.date) || 0), 0);
}

/** Up to five threads, three newest messages each, 6,000 characters total. */
export function buildEmailContextPacket(threads: ParticipantMailThread[], limit = 6000): string {
  const ranked = [...threads].sort((a, b) => threadSortKey(b) - threadSortKey(a)).slice(0, 5);
  const blocks: string[] = [];
  let used = 0;
  for (const thread of ranked) {
    const messages = newestFirst(thread)
      .slice(0, 3)
      .map((message) => ({ ...message, text: stripQuotedReply(message.text) }))
      .filter((message) => message.text);
    if (!messages.length) continue;
    const people = [
      ...new Set([
        ...thread.participants,
        ...messages.flatMap((message) => emailsIn(`${message.from} ${message.to} ${message.cc}`)),
      ]),
    ];
    const dates = messages
      .map((message) => message.date)
      .filter(Boolean)
      .reverse();
    const body = messages
      .slice()
      .reverse()
      .map((message) => `From ${message.from} (${message.date})\n${message.text}`)
      .join("\n\n");
    const block = [
      `Subject: ${thread.subject || "(no subject)"}`,
      people.length ? `Participants: ${people.join(", ")}` : "",
      dates.length ? `Dates: ${dates.join(", ")}` : "",
      body,
    ]
      .filter(Boolean)
      .join("\n");
    if (used + block.length > limit) {
      const room = limit - used;
      if (room > 80) blocks.push(block.slice(0, room).trim());
      break;
    }
    blocks.push(block);
    used += block.length + 2;
  }
  return blocks.join("\n\n").trim();
}

export function emailContextIsStale(at: string | null | undefined, now: Date = new Date()): boolean {
  if (!at) return true;
  const parsed = Date.parse(at);
  if (Number.isNaN(parsed)) return true;
  return now.getTime() - parsed > 24 * 60 * 60 * 1000;
}
