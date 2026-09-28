// Pull a contact out of Tracy's handoff. The LinkedIn URL is often an
// Outlook safelink. Availability lives in the quoted reply.

import { canonicalEmail, isMyOwnAddress } from "@/lib/outreach/contact-lookup";
import {
  HANDOFF_OPENING,
  TRACY_EMAIL,
  type AvailabilityWindow,
  type ParsedHandoff,
} from "./types";

const SAFELINK_HOST = "safelinks.protection.outlook.com";

export function isTracyHandoff(from: string, body: string): boolean {
  if (canonicalEmail(from) !== TRACY_EMAIL) return false;
  const text = stripHtml(body).replace(/\s+/g, " ").trim();
  return text.includes(HANDOFF_OPENING);
}

export function decodeOutlookSafelink(rawUrl: string): string {
  const trimmed = rawUrl.replace(/[>),.;\]]+$/, "");
  try {
    const url = new URL(trimmed);
    if (!url.hostname.toLowerCase().endsWith(SAFELINK_HOST)) return trimmed;
    const inner = url.searchParams.get("url");
    if (!inner) return trimmed;
    return decodeURIComponent(inner);
  } catch {
    return trimmed;
  }
}

export function linkedInUrlFromText(text: string): string | null {
  const decoded = text.replace(/https?:\/\/[^\s<>"']+/gi, (raw) =>
    decodeOutlookSafelink(raw)
  );
  const match = decoded.match(
    /https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/in\/([A-Za-z0-9_%-]+)/i
  );
  if (!match?.[1]) return null;
  const slug = decodeURIComponent(match[1]).replace(/\/+$/, "");
  if (!slug) return null;
  return `https://www.linkedin.com/in/${slug}`;
}

export function parseHandoff(body: string): ParsedHandoff {
  const text = stripHtml(body);
  const quoted = extractQuotedReply(text);
  const scan = `${quoted}\n${text}`;
  const email = firstOtherEmail(scan);
  const phone = firstPhone(quoted || text);
  const linkedinUrl = linkedInUrlFromText(scan);
  const name = extractName(quoted, text, email);
  const availabilityNote = availabilitySentence(quoted || text);
  const whyTheyReplied = whySentence(quoted || text, availabilityNote);
  const role = titleAndCompany(quoted || text);

  return {
    name,
    email,
    phone,
    linkedinUrl,
    availabilityNote,
    quotedReply: quoted ? clip(quoted, 4000) : null,
    whyTheyReplied,
    title: role.title,
    company: role.company,
  };
}

export function parseAvailabilityWindow(
  note: string | null | undefined
): AvailabilityWindow {
  const text = (note ?? "").toLowerCase();
  let earliest = 10 * 60;
  let latest = 16 * 60;
  if (/after\s*5(?!\d)|after\s*5\s*p\.?m|after\s*17/.test(text)) {
    earliest = 17 * 60;
    latest = 18 * 60 + 30;
  } else if (/after\s*(\d{1,2})/.test(text)) {
    const hour = Number(text.match(/after\s*(\d{1,2})/)?.[1]);
    if (hour >= 1 && hour <= 11) {
      earliest = hour * 60;
      latest = Math.max(earliest, 16 * 60);
    } else if (hour >= 12 && hour <= 20) {
      earliest = hour * 60;
      latest = Math.min(20 * 60, earliest + 2 * 60);
    }
  } else if (/morning/.test(text)) {
    earliest = 9 * 60;
    latest = 11 * 60 + 30;
  } else if (/afternoon/.test(text)) {
    earliest = 13 * 60;
    latest = 16 * 60;
  }

  const weekdays = weekdayConstraint(text);
  return { earliestStartMin: earliest, latestStartMin: latest, weekdays };
}

function weekdayConstraint(text: string): number[] | null {
  const names: [RegExp, number][] = [
    [/\bsundays?\b/, 0],
    [/\bmondays?\b/, 1],
    [/\btuesdays?\b/, 2],
    [/\bwednesdays?\b/, 3],
    [/\bthursdays?\b/, 4],
    [/\bfridays?\b/, 5],
    [/\bsaturdays?\b/, 6],
  ];
  const hits = names.filter(([re]) => re.test(text)).map(([, day]) => day);
  return hits.length ? hits : null;
}

function stripHtml(body: string): string {
  return body
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/?[a-z][a-z0-9]*(\s[^<>]*)?>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "");
}

function extractQuotedReply(text: string): string | null {
  const markers = [
    /\n-{2,}\s*original message\s*-{2,}\n/i,
    /\nfrom:\s.+\n/i,
    /\non .+ wrote:\s*\n/i,
  ];
  let best: string | null = null;
  for (const marker of markers) {
    const match = marker.exec(text);
    if (!match || match.index == null) continue;
    const slice = text.slice(match.index + match[0].length).trim();
    if (slice.length > (best?.length ?? 0)) best = slice;
  }
  if (best) return unquote(best);
  const quotedLines = text
    .split("\n")
    .filter((line) => line.trim().startsWith(">"))
    .map((line) => line.replace(/^>\s?/, ""));
  if (quotedLines.length >= 2) return quotedLines.join("\n").trim();
  return null;
}

function unquote(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^>\s?/, ""))
    .filter((line) => !/^(from|sent|to|cc|subject|date):\s/i.test(line.trim()))
    .join("\n")
    .trim();
}

function firstOtherEmail(text: string): string | null {
  const found = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  for (const raw of found) {
    const email = canonicalEmail(raw);
    if (!email.includes("@")) continue;
    if (email === TRACY_EMAIL) continue;
    if (email.endsWith("@executivejobsearch.net")) continue;
    if (isMyOwnAddress(email)) continue;
    if (email.endsWith("@linkedin.com")) continue;
    return email;
  }
  return null;
}

function firstPhone(text: string): string | null {
  const match = text.match(
    /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/
  );
  if (!match) return null;
  const digits = match[0].replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return null;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

function extractName(
  quoted: string | null,
  full: string,
  email: string | null
): string | null {
  const sources = [quoted, full].filter((s): s is string => Boolean(s));
  for (const source of sources) {
    const from = source.match(
      /from:\s*"?([^"<\n]+?)"?\s*<[^>\n]+>/i
    );
    const name = cleanName(from?.[1]);
    if (name) return name;
    const wrote = source.match(/\n?on .+?,\s*([^<\n]+?)\s+wrote:/i);
    const wroteName = cleanName(wrote?.[1]);
    if (wroteName) return wroteName;
  }
  if (email) {
    const near = full.match(
      new RegExp(`([A-Z][a-z]+(?:\\s+[A-Z][a-z]+){1,2})\\s*<?\\s*${escapeReg(email)}`, "i")
    );
    const nearName = cleanName(near?.[1]);
    if (nearName) return nearName;
  }
  return null;
}

function cleanName(raw: string | undefined): string | null {
  if (!raw) return null;
  const name = raw.replace(/["']/g, "").replace(/\s+/g, " ").trim();
  if (!/[A-Za-z]/.test(name)) return null;
  if (name.length < 3 || name.length > 80) return null;
  if (/executive networking|thank you|tracy/i.test(name)) return null;
  const parts = name.split(" ");
  if (parts.length < 2) return null;
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function availabilitySentence(text: string): string | null {
  const sentences = splitSentences(text);
  const hit = sentences.find((sentence) =>
    /after\s*\d|before\s*\d|available|mornings?|afternoons?|evenings?|only take|call after|free after|\bweekdays\b/i.test(
      sentence
    )
  );
  return hit ? clip(hit, 400) : null;
}

function whySentence(text: string, availability: string | null): string | null {
  const sentences = splitSentences(text).filter((sentence) => {
    if (availability && sentence === availability) return false;
    if (sentence.length < 40) return false;
    if (/linkedin|safelinks|phone|@|https?:/i.test(sentence)) return false;
    if (/thank you for your reply and interest/i.test(sentence)) return false;
    return true;
  });
  if (!sentences.length) return null;
  return clip(sentences.slice(0, 2).join(" "), 600);
}

function titleAndCompany(text: string): { title: string | null; company: string | null } {
  const line = text
    .split("\n")
    .map((row) => row.trim())
    .find((row) =>
      /\b(chief|ceo|cmo|cro|cgo|vp|vice president|president|partner|director|head of|operating partner)\b.+\bat\b.+/i.test(
        row
      )
    );
  if (!line) return { title: null, company: null };
  const match = line.match(/^(.+?)\s+at\s+(.+)$/i);
  if (!match) return { title: null, company: null };
  return {
    title: clip(match[1].trim(), 120),
    company: clip(match[2].replace(/[|].*$/, "").trim(), 120),
  };
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function clip(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
