// Job Alerts — harvests individual opportunities from the morning brief's
// "## Job Alerts…" section (markdown-linked role bullets), and matches them
// against editable keyword capsules on the Job Alerts page.

import "server-only";
import {
  createPublicServiceRoleClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { normalizeGmailUrl } from "@/lib/integrations/gmail-links";
import { listJobAlertKeywords } from "@/lib/server-actions/job-alert-keywords";

export interface JobOpportunity {
  id: string;
  briefDate: string; // YYYY-MM-DD first seen
  /** Role line without the URL, e.g. "Chief Marketing Officer — Ladders: up to $450K". */
  title: string;
  /** Deep link to the Gmail alert / posting, when present. */
  url: string | null;
  /** Keyword capsules that match this opportunity. */
  matchedKeywords: string[];
}

export interface JobAlertsData {
  opportunities: JobOpportunity[];
  keywords: { id: string; keyword: string }[];
  lastScanDate: string | null;
  scannedBriefs: number;
  configured: boolean;
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

type BriefRow = { brief_date: string; content_md: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchRecentBriefs(sb: { from: (t: string) => any }): Promise<
  BriefRow[]
> {
  const res = await sb
    .from("morning_briefs")
    .select("brief_date,content_md")
    .order("brief_date", { ascending: false })
    .limit(45);
  if (res.error) throw res.error;
  return (res.data ?? []) as BriefRow[];
}

async function loadBriefs(): Promise<BriefRow[]> {
  try {
    const rows = await fetchRecentBriefs(createPublicServiceRoleClient());
    if (rows.length) return rows;
  } catch (err) {
    console.warn("[job-alerts] public.morning_briefs unavailable:", err);
  }
  try {
    return await fetchRecentBriefs(createServiceRoleClient());
  } catch (err) {
    console.warn("[job-alerts] jasonos.morning_briefs unavailable:", err);
    return [];
  }
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

function isJobAlertsHeading(heading: string): boolean {
  const k = normKey(heading);
  if (k.includes("job alert")) return true;
  if (k.includes("300") && (k.includes("role") || k.includes("job"))) return true;
  if (k.startsWith("qualifying") && k.includes("role")) return true;
  return false;
}

/** Split raw markdown into ## sections (heading + body). */
function splitH2Sections(
  md: string
): { heading: string; body: string }[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const sections: { heading: string; body: string[] }[] = [];
  let current: { heading: string; body: string[] } | null = null;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      if (current) {
        sections.push({
          heading: current.heading,
          body: current.body,
        });
      }
      current = { heading: h2[1].trim(), body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) {
    sections.push({ heading: current.heading, body: current.body });
  }
  return sections.map((s) => ({
    heading: s.heading,
    body: s.body.join("\n").trim(),
  }));
}

interface Harvested {
  title: string;
  url: string | null;
}

/**
 * Pull individual opportunities from a section body.
 * Preferred shape: `- [Role — Company: $comp](https://…)`
 * Also accepts bare URL bullets and bold role lines with a trailing URL.
 */
function harvestOpportunities(body: string): Harvested[] {
  const out: Harvested[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    // Skip prose notes that aren't opportunities.
    if (!/^[-*]\s+/.test(line) && !/^\d+\.\s+/.test(line)) continue;
    const item = line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
    if (!item) continue;
    if (/^(most of|note:|see |pulled from|everything else)/i.test(item))
      continue;

    const md = item.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)(.*)$/);
    if (md) {
      const title = `${md[1]}${md[3] ?? ""}`.replace(/\s+/g, " ").trim();
      if (title.length < 4) continue;
      out.push({
        title,
        url: normalizeGmailUrl(md[2]),
      });
      continue;
    }

    const bare = item.match(/^(.*?)\s*(https?:\/\/[^\s<>"'`)\]}]+)\s*$/);
    if (bare && bare[1].trim().length >= 4) {
      out.push({
        title: bare[1].trim().replace(/\*\*/g, ""),
        url: normalizeGmailUrl(bare[2].replace(/[.,;:!?]+$/, "")),
      });
      continue;
    }

    // Role-looking line with a salary cue but no URL — still list it.
    if (/\$\s*\d|\bup to\b|\bk\/year\b|\b\d{3},\d{3}\b/i.test(item)) {
      const title = item
        .replace(/\*\*/g, "")
        .replace(/https?:\/\/\S+/g, "")
        .trim();
      if (title.length >= 8) out.push({ title, url: null });
    }
  }
  return out;
}

export async function getJobAlerts(): Promise<JobAlertsData> {
  const empty: JobAlertsData = {
    opportunities: [],
    keywords: [],
    lastScanDate: null,
    scannedBriefs: 0,
    configured: hasConfig(),
  };
  if (!hasConfig()) return empty;

  const [briefs, keywords] = await Promise.all([
    loadBriefs(),
    listJobAlertKeywords(),
  ]);
  const keywordStrings = keywords.map((k) => k.keyword);
  if (briefs.length === 0) {
    return { ...empty, keywords, scannedBriefs: 0 };
  }

  const seen = new Set<string>();
  const opportunities: JobOpportunity[] = [];
  let lastScanDate: string | null = null;

  for (const brief of briefs) {
    const sections = splitH2Sections(brief.content_md);
    let foundInBrief = false;
    for (const sec of sections) {
      if (!isJobAlertsHeading(sec.heading)) continue;
      const harvested = harvestOpportunities(sec.body);
      for (const h of harvested) {
        const key = normKey(h.title);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        foundInBrief = true;
        opportunities.push({
          id: `${brief.brief_date}:${key.slice(0, 80)}`,
          briefDate: brief.brief_date,
          title: h.title,
          url: h.url,
          matchedKeywords: matchKeywords(h.title, keywordStrings),
        });
      }
    }
    if (foundInBrief && !lastScanDate) lastScanDate = brief.brief_date;
  }

  // Matched keywords float to the top; then newest brief date.
  opportunities.sort((a, b) => {
    const am = a.matchedKeywords.length > 0 ? 0 : 1;
    const bm = b.matchedKeywords.length > 0 ? 0 : 1;
    if (am !== bm) return am - bm;
    if (a.briefDate !== b.briefDate) return a.briefDate < b.briefDate ? 1 : -1;
    return a.title.localeCompare(b.title);
  });

  return {
    opportunities,
    keywords,
    lastScanDate,
    scannedBriefs: briefs.length,
    configured: true,
  };
}
