// Harvest job listings from a Gmail folder (label) into jasonos.job_opportunities.
// Independent of the morning-brief publisher. Re-runs skip already-seen messages.
// Sync never deletes rows. Listings stay until Jason removes them (soft-delete).
// Soft-deleted fingerprints are not resurrected on a later scan.

import "server-only";

import {
  getGmailMessagesFull,
  listGmailLabels,
  listGmailMessages,
  type GmailLabel,
  type GmailThreadMessage,
} from "@/lib/integrations/gmail";
import { sanitizeGmailThreadUrl } from "@/lib/integrations/gmail-links";
import {
  extractCompensation,
  extractJobCards,
  pickJobListingUrl,
  sanitizeJobListingUrl,
} from "@/lib/integrations/job-listing-urls";
import { cleanJobAlertTitle } from "@/lib/data/parse-job-opportunity";
import {
  GOOGLE_GMAIL,
  listGoogleAccessTokens,
  type GoogleAccessToken,
} from "@/lib/integrations/google-tokens";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { appendSyncLog } from "@/lib/outreach/sync-log";

const LOOKBACK_DAYS = 14;
const FALLBACK_LOOKBACK_DAYS = 90;
const MAX_LIST = 250;
const MAX_FETCH_PER_RUN = 50;
const STATE_ID = "default";

export interface JobAlertMailboxResult {
  accountEmail: string;
  labelName: string;
  listed: number;
  scanned: number;
  inserted: number;
}

export interface JobAlertHarvestResult {
  ok: boolean;
  configured: boolean;
  labelName: string | null;
  labelId: string | null;
  accountEmail: string | null;
  listed: number;
  unseen: number;
  scanned: number;
  inserted: number;
  duplicates: number;
  skipped: number;
  lookbackDays: number;
  mailboxes: JobAlertMailboxResult[];
  error?: string;
}

function hasConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function wantedLabelName(): string | undefined {
  const raw = process.env.GMAIL_JOB_ALERTS_LABEL?.trim();
  return raw || undefined;
}

function parseSender(from: string | undefined): { email: string; name: string } {
  if (!from) return { email: "", name: "" };
  const m = from.match(/^(.*?)<([^>]+)>$/);
  if (m) {
    return {
      name: m[1].trim().replace(/^"|"$/g, ""),
      email: m[2].trim().toLowerCase(),
    };
  }
  return { email: from.trim().toLowerCase(), name: "" };
}

function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function companyFromTitle(title: string): string | null {
  const m = title.match(
    /\s+(?:@|at|—|–|-)\s+([^|(\[]+?)(?:\s+[—–-]\s+|\s+\(|\s+$|$)/i
  );
  const raw = m?.[1]?.trim();
  if (!raw || raw.length < 2 || raw.length > 80) return null;
  if (/^\$|\d{3}/.test(raw)) return null;
  return raw.replace(/\s+/g, " ");
}

function cleanSubject(subject: string): string {
  return subject
    .replace(/^\s*(fwd|fw|re)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fingerprint(jobUrl: string | null, threadId: string, titleKey: string): string {
  if (jobUrl) return `url:${jobUrl.toLowerCase()}`;
  return `thread:${threadId}:${titleKey}`;
}

function scoreLabel(name: string, wanted?: string): number {
  const n = name.toLowerCase().trim();
  const leaf = n.split("/").pop() ?? n;
  if (wanted) {
    const w = wanted.toLowerCase().trim();
    if (n === w || leaf === w) return 100;
    if (n.includes(w) || leaf.includes(w) || w.includes(leaf)) return 80;
  }
  if (/job[\s/_-]*alerts?/.test(n) || /job[\s/_-]*alerts?/.test(leaf)) return 70;
  return 0;
}

function pickJobAlertsLabel(
  labels: GmailLabel[],
  wanted?: string
): GmailLabel | null {
  let best: { label: GmailLabel; score: number } | null = null;
  for (const label of labels) {
    if (!label.id || !label.name) continue;
    if (label.type === "system") continue;
    const score = scoreLabel(label.name, wanted);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { label, score };
  }
  return best?.label ?? null;
}

function emptyResult(
  configured: boolean,
  extra?: Partial<JobAlertHarvestResult>
): JobAlertHarvestResult {
  return {
    ok: false,
    configured,
    labelName: null,
    labelId: null,
    accountEmail: null,
    listed: 0,
    unseen: 0,
    scanned: 0,
    inserted: 0,
    duplicates: 0,
    skipped: 0,
    lookbackDays: LOOKBACK_DAYS,
    mailboxes: [],
    ...extra,
  };
}

async function persistState(row: {
  label_name: string | null;
  label_id: string | null;
  account_email: string | null;
  last_result: JobAlertHarvestResult;
  error: string | null;
}): Promise<void> {
  if (!hasConfig()) return;
  const sb = createServiceRoleClient();
  await sb.from("job_alert_harvest_state").upsert({
    id: STATE_ID,
    label_name: row.label_name,
    label_id: row.label_id,
    account_email: row.account_email,
    last_run_at: new Date().toISOString(),
    last_result: row.last_result,
    error: row.error,
  });
}

export async function getJobAlertHarvestState(): Promise<{
  labelName: string | null;
  accountEmail: string | null;
  lastRunAt: string | null;
  lastResult: JobAlertHarvestResult | null;
  error: string | null;
}> {
  const empty = {
    labelName: null,
    accountEmail: null,
    lastRunAt: null,
    lastResult: null,
    error: null as string | null,
  };
  if (!hasConfig()) return empty;
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("job_alert_harvest_state")
      .select("label_name,account_email,last_run_at,last_result,error")
      .eq("id", STATE_ID)
      .maybeSingle();
    if (error || !data) return empty;
    return {
      labelName: (data.label_name as string | null) ?? null,
      accountEmail: (data.account_email as string | null) ?? null,
      lastRunAt: (data.last_run_at as string | null) ?? null,
      lastResult: (data.last_result as JobAlertHarvestResult | null) ?? null,
      error: (data.error as string | null) ?? null,
    };
  } catch {
    return empty;
  }
}

function listingsFromMessage(msg: GmailThreadMessage): {
  title: string;
  jobUrl: string | null;
  compensation: string | null;
  company: string | null;
}[] {
  const cards = extractJobCards(msg.htmlBody, msg.plaintextBody, msg.snippet);
  const subject = cleanJobAlertTitle(cleanSubject(msg.subject ?? ""));
  const subjectComp = extractCompensation(subject);
  if (cards.length) {
    return cards.map((c) => {
      const cardTitle = c.title ? cleanJobAlertTitle(c.title) : null;
      const title = (cardTitle || subject || "Job listing").slice(0, 180);
      const company =
        companyFromTitle(title) ?? (subject ? companyFromTitle(subject) : null);
      return {
        title,
        jobUrl: sanitizeJobListingUrl(c.url),
        compensation: c.compensation ?? subjectComp,
        company,
      };
    });
  }

  const jobUrl = sanitizeJobListingUrl(
    pickJobListingUrl(msg.htmlBody, msg.plaintextBody, msg.snippet)
  );
  const title = subject || "Job alert";
  return [
    {
      title,
      jobUrl,
      compensation:
        subjectComp ??
        extractCompensation(msg.plaintextBody ?? msg.snippet ?? ""),
      company: companyFromTitle(title),
    },
  ];
}

async function listFolderMessages(
  labelId: string,
  accessToken: string
): Promise<{ listed: { id: string; threadId: string }[]; lookbackDays: number }> {
  const recent = await listGmailMessages({
    labelIds: [labelId],
    query: `newer_than:${LOOKBACK_DAYS}d`,
    max: MAX_LIST,
    accessToken,
  });
  if (recent.length > 0) {
    return { listed: recent, lookbackDays: LOOKBACK_DAYS };
  }
  const wider = await listGmailMessages({
    labelIds: [labelId],
    query: `newer_than:${FALLBACK_LOOKBACK_DAYS}d`,
    max: MAX_LIST,
    accessToken,
  });
  return { listed: wider, lookbackDays: FALLBACK_LOOKBACK_DAYS };
}

export async function harvestJobAlertsFromGmail(): Promise<JobAlertHarvestResult> {
  if (!hasConfig()) {
    return emptyResult(false, { error: "Supabase is not configured." });
  }

  const tokens = await listGoogleAccessTokens();
  if (!tokens.length) {
    const result = emptyResult(false, { error: "Connect Gmail in Settings first." });
    await persistState({
      label_name: null,
      label_id: null,
      account_email: null,
      last_result: result,
      error: result.error ?? null,
    });
    return result;
  }

  const ordered: GoogleAccessToken[] = [
    ...tokens.filter((t) => t.provider === GOOGLE_GMAIL),
    ...tokens.filter((t) => t.provider !== GOOGLE_GMAIL),
  ];

  const wanted = wantedLabelName();
  const targets: { mailbox: GoogleAccessToken; label: GmailLabel }[] = [];
  for (const token of ordered) {
    const labels = await listGmailLabels(token.token);
    const hit = pickJobAlertsLabel(labels, wanted);
    if (hit) targets.push({ mailbox: token, label: hit });
  }

  if (targets.length === 0) {
    const hint = wanted
      ? `No Gmail folder named “${wanted}”. Set GMAIL_JOB_ALERTS_LABEL to the exact folder name.`
      : "No Gmail folder matching “Job Alerts”. Set GMAIL_JOB_ALERTS_LABEL to the exact folder name.";
    const result = emptyResult(true, { error: hint });
    await persistState({
      label_name: wanted ?? null,
      label_id: null,
      account_email: ordered[0]?.accountEmail ?? null,
      last_result: result,
      error: hint,
    });
    await appendSyncLog("job-alerts", {
      ok: false,
      error: hint,
      inserted: 0,
      skipped: 0,
    });
    return result;
  }

  const sb = createServiceRoleClient();
  let inserted = 0;
  let duplicates = 0;
  let skipped = 0;
  let listedTotal = 0;
  let unseenTotal = 0;
  let scannedTotal = 0;
  let lookbackDays = LOOKBACK_DAYS;
  const mailboxes: JobAlertMailboxResult[] = [];
  const primary = targets[0]!;

  for (const { mailbox, label } of targets) {
    const { listed, lookbackDays: usedLookback } = await listFolderMessages(
      label.id,
      mailbox.token
    );
    lookbackDays = Math.max(lookbackDays, usedLookback);
    listedTotal += listed.length;

    const ids = listed.map((m) => m.id);
    const seen = new Set<string>();
    if (ids.length) {
      const { data: seenRows } = await sb
        .from("job_alert_seen_messages")
        .select("message_id")
        .in("message_id", ids);
      for (const row of seenRows ?? []) {
        if (row.message_id) seen.add(row.message_id as string);
      }
    }

    const remainingBudget = Math.max(0, MAX_FETCH_PER_RUN - scannedTotal);
    const unseen = listed.filter((m) => !seen.has(m.id)).slice(0, remainingBudget);
    unseenTotal += listed.length - seen.size;
    const messages = await getGmailMessagesFull(
      unseen.map((m) => m.id),
      mailbox.token
    );
    scannedTotal += messages.length;

    const seenRows: {
      message_id: string;
      thread_id: string;
      account_email: string;
      received_at: string | null;
      listings_found: number;
    }[] = [];
    let mailboxInserted = 0;

    for (const msg of messages) {
      const receivedAt = msg.internalDate
        ? new Date(msg.internalDate).toISOString()
        : msg.date
          ? new Date(msg.date).toISOString()
          : new Date().toISOString();
      const sender = parseSender(msg.from);
      const listings = listingsFromMessage(msg);
      let found = 0;

      for (const listing of listings) {
        const titleKey = normKey(listing.title);
        if (!titleKey) {
          skipped += 1;
          continue;
        }
        const fp = fingerprint(listing.jobUrl, msg.threadId, titleKey);
        const { data, error } = await sb
          .from("job_opportunities")
          .upsert(
            {
              fingerprint: fp,
              gmail_thread_id: msg.threadId,
              gmail_message_id: msg.id,
              account_email: mailbox.accountEmail,
              source_label: label.name,
              from_email: sender.email || null,
              from_name: sender.name || null,
              subject: msg.subject ?? null,
              title: listing.title,
              company: listing.company,
              compensation: listing.compensation,
              job_url: listing.jobUrl,
              gmail_url: sanitizeGmailThreadUrl(
                null,
                msg.threadId,
                mailbox.accountEmail
              ),
              snippet: (msg.snippet ?? "").slice(0, 280) || null,
              received_at: receivedAt,
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: "fingerprint" }
          )
          .select("id,first_seen_at,last_seen_at,deleted_at")
          .maybeSingle();

        if (error) {
          console.warn("[job-alert-harvest] upsert failed:", error.message);
          skipped += 1;
          continue;
        }
        if (data?.deleted_at) {
          // Jason removed this listing. Leave it hidden.
          skipped += 1;
          continue;
        }
        found += 1;
        const first = data?.first_seen_at as string | undefined;
        const last = data?.last_seen_at as string | undefined;
        if (first && last && first !== last) duplicates += 1;
        else {
          inserted += 1;
          mailboxInserted += 1;
        }
      }

      seenRows.push({
        message_id: msg.id,
        thread_id: msg.threadId,
        account_email: mailbox.accountEmail,
        received_at: receivedAt,
        listings_found: found,
      });
    }

    if (seenRows.length) {
      await sb.from("job_alert_seen_messages").upsert(seenRows, {
        onConflict: "message_id",
      });
    }

    mailboxes.push({
      accountEmail: mailbox.accountEmail,
      labelName: label.name,
      listed: listed.length,
      scanned: messages.length,
      inserted: mailboxInserted,
    });
  }

  const richest = [...mailboxes].sort((a, b) => b.listed - a.listed)[0] ?? null;
  const result: JobAlertHarvestResult = {
    ok: true,
    configured: true,
    labelName: richest?.labelName ?? primary.label.name,
    labelId: primary.label.id,
    accountEmail: richest?.accountEmail ?? primary.mailbox.accountEmail,
    listed: listedTotal,
    unseen: unseenTotal,
    scanned: scannedTotal,
    inserted,
    duplicates,
    skipped,
    lookbackDays,
    mailboxes,
  };

  await persistState({
    label_name: result.labelName,
    label_id: result.labelId,
    account_email: result.accountEmail,
    last_result: result,
    error: null,
  });
  await appendSyncLog("job-alerts", {
    ok: true,
    inserted,
    duplicates,
    skipped,
    scanned: scannedTotal,
    listed: listedTotal,
    label: result.labelName,
    account: result.accountEmail,
    mailboxes,
  });
  return result;
}
