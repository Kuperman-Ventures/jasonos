// Pure rules for the sent-mail follow-up queue. No DB, no Gmail.
// Sync stages one row per thread from jason@kupermanadvisors.com.
// Jason picks a day count; Home shows the thread once that day arrives.

import { daysBetweenYmd } from "../dates";
import { isGmailDraftMessage, isGmailSentMessage } from "../integrations/gmail-labels";
import { canonicalEmail, isMyOwnAddress } from "./contact-lookup";
import { isCalendarInviteSubject, isNoiseEmail } from "./mail-noise";

export const SENT_FOLLOWUP_DAY_PRESETS = [1, 3, 5] as const;
export const SENT_FOLLOWUP_MAX_DAYS = 365;

export type SentFollowupStatus = "new" | "scheduled" | "done" | "dismissed";

export interface MailAddress {
  name: string | null;
  email: string;
}

export interface SentMailHit {
  threadId: string;
  messageId: string;
  subject: string;
  sentAt: string;
  snippet: string;
  toLine: string;
  recipients: MailAddress[];
}

export interface ExistingSentFollowup {
  threadId: string;
  messageId: string;
  sentAt: string;
  status: SentFollowupStatus;
}

export type SentFollowupPlan =
  | { action: "insert"; hit: SentMailHit }
  | { action: "refresh"; hit: SentMailHit }
  | { action: "reopen"; hit: SentMailHit }
  | { action: "skip"; threadId: string };

export function splitAddressHeader(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const out: string[] = [];
  let buf = "";
  let inQuotes = false;
  let angle = 0;
  for (const ch of raw) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === "<") angle += 1;
    else if (!inQuotes && ch === ">" && angle > 0) angle -= 1;
    if (ch === "," && !inQuotes && angle === 0) {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

export function parseAddressHeader(raw: string | null | undefined): MailAddress[] {
  const seen = new Set<string>();
  const out: MailAddress[] = [];
  for (const part of splitAddressHeader(raw)) {
    const match = part.match(/^(.*)<([^>]+)>\s*$/);
    const email = (match ? match[2] : part).trim().toLowerCase();
    const name = match
      ? match[1].trim().replace(/^"|"$/g, "").trim() || null
      : null;
    if (!email.includes("@")) continue;
    const key = canonicalEmail(email);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, email });
  }
  return out;
}

export function externalRecipients(
  to: string | null | undefined,
  cc: string | null | undefined
): MailAddress[] {
  return [...parseAddressHeader(to), ...parseAddressHeader(cc)].filter((addr) => {
    if (isMyOwnAddress(addr.email)) return false;
    if (isNoiseEmail(addr.email)) return false;
    return true;
  });
}

export function recipientLine(recipients: MailAddress[], limit = 3): string {
  const labels = recipients.map((addr) => addr.name || addr.email);
  if (!labels.length) return "";
  if (labels.length <= limit) return labels.join(", ");
  const shown = labels.slice(0, limit).join(", ");
  return `${shown} +${labels.length - limit}`;
}

export function followUpDueYmd(todayYmd: string, days: number): string | null {
  if (!Number.isInteger(days) || days < 1 || days > SENT_FOLLOWUP_MAX_DAYS) {
    return null;
  }
  const [y, m, d] = todayYmd.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function isFollowupDue(
  dueYmd: string | null | undefined,
  todayYmd: string
): boolean {
  if (!dueYmd) return false;
  return dueYmd <= todayYmd;
}

export function followupDaysOverdue(dueYmd: string, todayYmd: string): number {
  if (dueYmd > todayYmd) return 0;
  return daysBetweenYmd(dueYmd, todayYmd);
}

/**
 * Keep a real sent message that has someone else on To/Cc.
 * Drafts, calendar invites, and mail only to Jason stay out.
 */
export function qualifySentMessage(msg: {
  labelIds?: string[] | null;
  subject?: string | null;
  to?: string | null;
  cc?: string | null;
}): { ok: true; recipients: MailAddress[]; toLine: string } | { ok: false } {
  if (isGmailDraftMessage(msg)) return { ok: false };
  if (msg.labelIds?.length && !isGmailSentMessage(msg)) return { ok: false };
  if (isCalendarInviteSubject(msg.subject)) return { ok: false };
  const recipients = externalRecipients(msg.to, msg.cc);
  if (!recipients.length) return { ok: false };
  return { ok: true, recipients, toLine: recipientLine(recipients) };
}

/** Latest sent hit per thread. Later sentAt wins; ties keep the first seen. */
export function latestHitPerThread(hits: SentMailHit[]): SentMailHit[] {
  const byThread = new Map<string, SentMailHit>();
  for (const hit of hits) {
    const prev = byThread.get(hit.threadId);
    if (!prev || Date.parse(hit.sentAt) > Date.parse(prev.sentAt)) {
      byThread.set(hit.threadId, hit);
    }
  }
  return [...byThread.values()];
}

/**
 * New threads get a review row. A newer send on a thread Jason already
 * decided reopens it, because that send is a new email.
 */
export function planSentFollowupUpsert(
  existing: ExistingSentFollowup | undefined,
  hit: SentMailHit
): SentFollowupPlan {
  if (!existing) return { action: "insert", hit };
  if (existing.messageId === hit.messageId) return { action: "skip", threadId: hit.threadId };
  const incoming = Date.parse(hit.sentAt);
  const stored = Date.parse(existing.sentAt);
  if (!Number.isFinite(incoming) || !Number.isFinite(stored) || incoming <= stored) {
    return { action: "skip", threadId: hit.threadId };
  }
  if (existing.status === "new") return { action: "refresh", hit };
  return { action: "reopen", hit };
}
