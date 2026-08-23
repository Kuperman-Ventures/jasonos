// Job Alerts — listings harvested from a Gmail folder (cron + Scan now),
// matched against editable keyword capsules on the Job Alerts page.

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { listJobAlertKeywords } from "@/lib/server-actions/job-alert-keywords";
import { getJobAlertHarvestState, type JobAlertHarvestResult } from "@/lib/data/job-alert-harvest";
import { resolveOpportunityLinks } from "@/lib/data/job-opportunity-links";
import {
  cleanJobAlertTitle,
  isDigestOnlyTitle,
  parseOpportunityLine,
} from "@/lib/data/parse-job-opportunity";
import { isGmailConnected } from "@/lib/integrations/gmail";
import type { JobOpportunity } from "@/lib/data/job-alerts-types";

export type { JobOpportunity } from "@/lib/data/job-alerts-types";

export interface JobAlertsData {
  opportunities: JobOpportunity[];
  keywords: { id: string; keyword: string }[];
  lastScanDate: string | null;
  scannedBriefs: number;
  configured: boolean;
  gmailConnected: boolean;
  folderName: string | null;
  harvestError: string | null;
  accountEmail: string | null;
  lastResult: JobAlertHarvestResult | null;
}

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "or",
  "for",
  "to",
  "in",
  "at",
  "on",
  "with",
  "role",
  "position",
  "job",
  "jobs",
  "opportunity",
  "senior",
  "sr",
  "junior",
  "jr",
  "lead",
  "staff",
  "principal",
]);

function hasConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function titleTokens(title: string): string[] {
  return normKey(title)
    .split(" ")
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function matchKeywords(line: string, keywords: string[]): string[] {
  const hay = normKey(line);
  if (!hay) return [];
  const hits: string[] = [];
  for (const kw of keywords) {
    const key = normKey(kw);
    if (!key) continue;
    if (hay.includes(key)) {
      hits.push(kw);
      continue;
    }
    const tokens = titleTokens(kw);
    if (tokens.length >= 2) {
      const present = tokens.filter((tok) =>
        new RegExp(`\\b${tok}\\b`).test(hay)
      );
      if (present.length >= Math.min(2, tokens.length)) hits.push(kw);
    }
  }
  return hits;
}

function dayFromIso(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso.slice(0, 10);
  return new Date(t).toISOString().slice(0, 10);
}

type OpportunityRow = {
  id: string;
  title: string;
  company: string | null;
  compensation: string | null;
  job_url: string | null;
  gmail_url: string | null;
  gmail_thread_id: string | null;
  account_email: string | null;
  received_at: string;
  first_seen_at: string;
};

export async function getJobAlerts(): Promise<JobAlertsData> {
  const empty: JobAlertsData = {
    opportunities: [],
    keywords: [],
    lastScanDate: null,
    scannedBriefs: 0,
    configured: hasConfig(),
    gmailConnected: false,
    folderName: null,
    harvestError: null,
    accountEmail: null,
    lastResult: null,
  };
  if (!hasConfig()) return empty;

  const [keywords, harvest, gmailConnected] = await Promise.all([
    listJobAlertKeywords(),
    getJobAlertHarvestState(),
    isGmailConnected(),
  ]);
  const keywordStrings = keywords.map((k) => k.keyword);

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("job_opportunities")
    .select(
      "id,title,company,compensation,job_url,gmail_url,gmail_thread_id,account_email,received_at,first_seen_at"
    )
    .is("deleted_at", null)
    .order("received_at", { ascending: false })
    .limit(2000);

  if (error) {
    console.warn("[job-alerts] load failed:", error.message);
    return {
      ...empty,
      keywords,
      gmailConnected,
      folderName: harvest.labelName,
      harvestError: harvest.error ?? error.message,
      lastScanDate: harvest.lastRunAt,
      accountEmail: harvest.accountEmail,
      lastResult: harvest.lastResult,
    };
  }

  const opportunities: JobOpportunity[] = ((data ?? []) as OpportunityRow[])
    .map((row) => {
      const links = resolveOpportunityLinks(
        row.job_url,
        row.gmail_url,
        row.gmail_thread_id,
        row.account_email
      );
      const cleanedTitle = cleanJobAlertTitle(row.title);
      const parsed = parseOpportunityLine(cleanedTitle);
      const title = parsed.roleTitle || cleanedTitle || row.title;
      const company = row.company ?? parsed.company ?? null;
      const compensation = row.compensation ?? parsed.salary ?? null;
      const hay = [title, company, compensation].filter(Boolean).join(" ");
      return {
        id: row.id,
        briefDate: dayFromIso(row.received_at || row.first_seen_at),
        title,
        company,
        compensation,
        url: links.url,
        jobUrl: links.jobUrl,
        gmailUrl: links.gmailUrl,
        matchedKeywords: matchKeywords(hay, keywordStrings),
      };
    })
    .filter((row) => {
      if (row.jobUrl) return true;
      return !isDigestOnlyTitle(row.title);
    });

  opportunities.sort((a, b) => {
    if (a.briefDate !== b.briefDate) return a.briefDate < b.briefDate ? 1 : -1;
    const aRich = (a.compensation ? 0 : 1) + (a.company ? 0 : 1);
    const bRich = (b.compensation ? 0 : 1) + (b.company ? 0 : 1);
    if (aRich !== bRich) return aRich - bRich;
    return a.title.localeCompare(b.title);
  });

  return {
    opportunities,
    keywords,
    lastScanDate: harvest.lastRunAt,
    scannedBriefs: harvest.lastResult?.scanned ?? 0,
    configured: true,
    gmailConnected,
    folderName: harvest.labelName,
    harvestError: harvest.error,
    accountEmail: harvest.accountEmail,
    lastResult: harvest.lastResult,
  };
}
