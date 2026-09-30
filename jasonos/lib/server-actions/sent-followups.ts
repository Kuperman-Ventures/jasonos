"use server";

import { revalidatePath } from "next/cache";
import { etToday } from "@/lib/dates";
import { gmailThreadUrl } from "@/lib/integrations/gmail-links";
import {
  getGmailThread,
  listGoogleSentMailHits,
  type GmailThreadMessage,
} from "@/lib/integrations/gmail";
import { listOutlookSentMailHits } from "@/lib/integrations/outlook";
import { OUTLOOK_ACCOUNT_EMAIL } from "@/lib/integrations/outlook-tokens";
import { isFromMe } from "@/lib/outreach/contact-lookup";
import { appendSyncLog } from "@/lib/outreach/sync-log";
import { SUGGESTED_SCAN_DAYS_BACK } from "@/lib/outreach/suggested-scan";
import {
  followUpDueYmd,
  followupDaysOverdue,
  isFollowupDue,
  latestHitPerThread,
  planSentFollowupUpsert,
  sentFollowupKey,
  type ExistingSentFollowup,
  type MailAddress,
  type SentFollowupStatus,
  type SentMailHit,
} from "@/lib/outreach/sent-followups";
import { createServiceRoleClient } from "@/lib/supabase/server";

export interface SentEmailFollowup {
  id: string;
  subject: string;
  toLine: string;
  recipients: MailAddress[];
  sentAt: string;
  snippet: string | null;
  status: SentFollowupStatus;
  followUpDays: number | null;
  followUpDue: string | null;
  gmailThreadId: string;
  gmailUrl: string;
  accountEmail: string;
  daysOverdue: number;
}

export interface SentThreadMessageView {
  id: string;
  from: string;
  to: string;
  date: string;
  subject: string;
  body: string;
  fromMe: boolean;
}

type ActionResult = { ok: true } | { ok: false; error: string };

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

interface FollowupRow {
  id: string;
  account_email: string;
  gmail_thread_id: string;
  gmail_message_id: string;
  subject: string | null;
  recipients: unknown;
  to_line: string | null;
  sent_at: string;
  snippet: string | null;
  status: SentFollowupStatus;
  follow_up_days: number | null;
  follow_up_due: string | null;
  thread_url?: string | null;
}

function asRecipients(value: unknown): MailAddress[] {
  if (!Array.isArray(value)) return [];
  const out: MailAddress[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const email = (item as { email?: unknown }).email;
    const name = (item as { name?: unknown }).name;
    if (typeof email !== "string" || !email.includes("@")) continue;
    out.push({
      email,
      name: typeof name === "string" && name.trim() ? name : null,
    });
  }
  return out;
}

function threadUrlFor(row: FollowupRow): string {
  const stored = row.thread_url?.trim();
  if (stored) return stored;
  const account = (row.account_email || "").toLowerCase();
  if (account === OUTLOOK_ACCOUNT_EMAIL.toLowerCase()) {
    return "https://outlook.live.com/mail/0/";
  }
  return gmailThreadUrl(row.gmail_thread_id, row.account_email);
}

function toView(row: FollowupRow, today = etToday()): SentEmailFollowup {
  const due = row.follow_up_due?.slice(0, 10) ?? null;
  return {
    id: row.id,
    subject: row.subject?.trim() || "(no subject)",
    toLine: row.to_line?.trim() || "Unknown recipient",
    recipients: asRecipients(row.recipients),
    sentAt: row.sent_at,
    snippet: row.snippet,
    status: row.status,
    followUpDays: row.follow_up_days,
    followUpDue: due,
    gmailThreadId: row.gmail_thread_id,
    gmailUrl: threadUrlFor(row),
    accountEmail: row.account_email,
    daysOverdue: due ? followupDaysOverdue(due, today) : 0,
  };
}

function rowPayload(hit: SentMailHit, status: SentFollowupStatus) {
  return {
    account_email: hit.accountEmail,
    gmail_thread_id: hit.threadId,
    gmail_message_id: hit.messageId,
    subject: hit.subject,
    recipients: hit.recipients,
    to_line: hit.toLine,
    sent_at: hit.sentAt,
    snippet: hit.snippet || null,
    thread_url: hit.webLink?.trim() || null,
    status,
    follow_up_days: null,
    follow_up_due: null,
    decided_at: null,
    updated_at: new Date().toISOString(),
  };
}

export async function captureSentEmailFollowups(opts?: {
  daysBack?: number;
  runId?: string;
}): Promise<
  | { ok: true; scanned: number; created: number; updated: number; skipped: number }
  | { ok: false; error: string; unavailable?: boolean }
> {
  const result = await captureSentEmailFollowupsInner(opts);
  if (result.ok) {
    await appendSyncLog(
      "sent-followups",
      {
        ok: true,
        scanned: result.scanned,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        inserted: result.created,
      },
      opts?.runId
    );
  } else if (result.error !== "Not configured") {
    await appendSyncLog(
      "sent-followups",
      {
        ok: false,
        unavailable: result.unavailable === true,
        error: result.error,
      },
      opts?.runId
    );
  }
  return result;
}

async function captureSentEmailFollowupsInner(opts?: {
  daysBack?: number;
}): Promise<
  | { ok: true; scanned: number; created: number; updated: number; skipped: number }
  | { ok: false; error: string; unavailable?: boolean }
> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const daysBack = opts?.daysBack ?? SUGGESTED_SCAN_DAYS_BACK;

  const [google, outlook] = await Promise.all([
    listGoogleSentMailHits({ daysBack }),
    listOutlookSentMailHits({ daysBack }),
  ]);

  if (!google.configured && !outlook.configured) {
    return {
      ok: false,
      unavailable: true,
      error: "No mail account connected for sent follow-ups.",
    };
  }

  const hits = latestHitPerThread([
    ...(google.data ?? []),
    ...(outlook.data ?? []),
  ]);
  if (
    !hits.length &&
    ((google.error && google.configured) || (outlook.error && outlook.configured))
  ) {
    return {
      ok: false,
      error: [google.error, outlook.error].filter(Boolean).join(" · "),
    };
  }

  const sb = createServiceRoleClient();
  const threadIds = [...new Set(hits.map((hit) => hit.threadId))];
  const existing = new Map<string, ExistingSentFollowup>();
  if (threadIds.length) {
    const { data, error } = await sb
      .from("sent_email_followups")
      .select("account_email, gmail_thread_id, gmail_message_id, sent_at, status")
      .in("gmail_thread_id", threadIds);
    if (error) return { ok: false, error: error.message };
    for (const row of data ?? []) {
      const account = row.account_email as string;
      const threadId = row.gmail_thread_id as string;
      existing.set(sentFollowupKey(account, threadId), {
        threadId,
        messageId: row.gmail_message_id as string,
        sentAt: row.sent_at as string,
        status: row.status as SentFollowupStatus,
      });
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const hit of hits) {
    const key = sentFollowupKey(hit.accountEmail, hit.threadId);
    const plan = planSentFollowupUpsert(existing.get(key), hit);
    if (plan.action === "skip") {
      skipped += 1;
      continue;
    }
    if (plan.action === "insert") {
      const { error } = await sb
        .from("sent_email_followups")
        .insert(rowPayload(hit, "new"));
      if (error) return { ok: false, error: error.message };
      created += 1;
      continue;
    }
    const { error } = await sb
      .from("sent_email_followups")
      .update(rowPayload(hit, "new"))
      .eq("account_email", hit.accountEmail)
      .eq("gmail_thread_id", hit.threadId);
    if (error) return { ok: false, error: error.message };
    updated += 1;
  }

  revalidatePath("/outreach/sent");
  revalidatePath("/");
  return {
    ok: true,
    scanned: hits.length,
    created,
    updated,
    skipped,
  };
}

export async function getSentEmailFollowups(): Promise<SentEmailFollowup[]> {
  if (!hasConfig()) return [];
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("sent_email_followups")
    .select("*")
    .eq("status", "new")
    .order("sent_at", { ascending: false });
  if (error) {
    console.error("[sent-followups.list]", error);
    return [];
  }
  return ((data ?? []) as FollowupRow[]).map((row) => toView(row));
}

export async function getNewSentFollowupCount(): Promise<number> {
  const rows = await getSentEmailFollowups();
  return rows.length;
}

export async function getDueSentEmailFollowups(): Promise<SentEmailFollowup[]> {
  if (!hasConfig()) return [];
  const today = etToday();
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("sent_email_followups")
    .select("*")
    .eq("status", "scheduled")
    .lte("follow_up_due", today)
    .order("follow_up_due", { ascending: true });
  if (error) {
    console.error("[sent-followups.due]", error);
    return [];
  }
  return ((data ?? []) as FollowupRow[])
    .map((row) => toView(row, today))
    .filter((row) => isFollowupDue(row.followUpDue, today));
}

export async function scheduleSentEmailFollowup(
  id: string,
  days: number
): Promise<ActionResult> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const due = followUpDueYmd(etToday(), days);
  if (!due) return { ok: false, error: "Enter a number of days from 1 to 365." };
  const sb = createServiceRoleClient();
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("sent_email_followups")
    .update({
      status: "scheduled",
      follow_up_days: days,
      follow_up_due: due,
      decided_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "That email is no longer in the list." };
  revalidatePath("/outreach/sent");
  revalidatePath("/");
  return { ok: true };
}

export async function dismissSentEmailFollowup(id: string): Promise<ActionResult> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sb = createServiceRoleClient();
  const now = new Date().toISOString();
  const { error } = await sb
    .from("sent_email_followups")
    .update({
      status: "dismissed",
      follow_up_days: null,
      follow_up_due: null,
      decided_at: now,
      updated_at: now,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/outreach/sent");
  revalidatePath("/");
  return { ok: true };
}

export async function completeSentEmailFollowup(id: string): Promise<ActionResult> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sb = createServiceRoleClient();
  const now = new Date().toISOString();
  const { error } = await sb
    .from("sent_email_followups")
    .update({
      status: "done",
      decided_at: now,
      updated_at: now,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  revalidatePath("/outreach/sent");
  return { ok: true };
}

function messageBody(msg: GmailThreadMessage): string {
  const plain = msg.plaintextBody?.replace(/\r\n/g, "\n").trim();
  if (plain) return plain.slice(0, 8000);
  const html = msg.htmlBody ?? "";
  const stripped = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return (stripped || msg.snippet || "").slice(0, 8000);
}

export async function getSentEmailThread(
  id: string
): Promise<
  | { ok: true; messages: SentThreadMessageView[] }
  | { ok: false; error: string }
> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("sent_email_followups")
    .select("gmail_thread_id, account_email, thread_url")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data?.gmail_thread_id) return { ok: false, error: "That email is gone." };

  const account = ((data.account_email as string) || "").toLowerCase();
  if (account === OUTLOOK_ACCOUNT_EMAIL.toLowerCase()) {
    return {
      ok: false,
      error:
        "Open this thread in Outlook (link above). Inline Outlook preview is not wired yet.",
    };
  }

  const thread = await getGmailThread(data.gmail_thread_id as string);
  if (!thread) {
    return { ok: false, error: "Couldn't load that thread from Gmail." };
  }
  const messages = thread.messages.map((msg) => ({
    id: msg.id,
    from: msg.from?.trim() || "Unknown",
    to: msg.to?.trim() || "",
    date: msg.date || "",
    subject: msg.subject?.trim() || "(no subject)",
    body: messageBody(msg),
    fromMe: isFromMe(msg.from ?? ""),
  }));
  return { ok: true, messages };
}
