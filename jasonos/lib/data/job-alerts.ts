// Job Alerts — pulls the "Job search" bucket out of each morning brief's
// "Email by Group" section and turns the accumulated lines into a running list
// of job opportunities. Opportunities are matched against the role titles that
// have accumulated in NYUI (work_searches.position_applied) so the roles Jason
// is actually pursuing float to the top.

import "server-only";
import {
  createPublicServiceRoleClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { parseMorningBrief } from "@/lib/data/parse-morning-brief";
import { getAllWorkSearches } from "@/lib/server-actions/nyui";
import { normalizeGmailUrl } from "@/lib/integrations/gmail-links";

export interface JobAlert {
  id: string;
  briefDate: string; // YYYY-MM-DD the opportunity was first seen
  text: string; // the opportunity line (role / company summary), links stripped
  url: string | null; // first deep link on the line, if any
  matchedTitles: string[]; // NYUI tracked role titles that appear in the line
}

export interface JobAlertsData {
  matched: JobAlert[]; // opportunities that hit a tracked NYUI role title
  other: JobAlert[]; // remaining job-search lines
  trackedTitles: string[]; // distinct NYUI role titles, most-tracked first
  lastScanDate: string | null; // newest brief date that had a job-search bucket
  scannedBriefs: number; // how many briefs we read
  configured: boolean; // false when Supabase env isn't set
}

const URL_RE = /\bhttps?:\/\/[^\s<>"'`)\]}]+/;
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

/** Recent briefs from whichever schema has them (public first, then jasonos). */
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

function isJobSearchBucket(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes("job") || t.includes("career") || t.includes("recruit");
}

/** Placeholder lines that aren't real opportunities. */
function isNoise(line: string): boolean {
  const t = line.toLowerCase().trim();
  if (t.length < 4) return true;
  return /^(nothing|none|no (new|actionable)|quiet|n\/a|see |all |mostly )/.test(
    t
  );
}

function stripUrls(line: string): string {
  return line
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1")
    .replace(/https?:\/\/[^\s<>"'`)\]}]+/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

function extractUrl(line: string): string | null {
  const md = line.match(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/);
  if (md) return normalizeGmailUrl(md[1]);
  const bare = line.match(URL_RE);
  return bare ? normalizeGmailUrl(bare[0].replace(/[.,;:!?]+$/, "")) : null;
}

function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Significant (non-stopword) tokens from a role title, for fuzzy matching. */
function titleTokens(title: string): string[] {
  return normKey(title)
    .split(" ")
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Distinct NYUI role titles, ordered by how often they've been logged. */
async function trackedRoleTitles(): Promise<string[]> {
  const searches = await getAllWorkSearches();
  const counts = new Map<string, { title: string; n: number }>();
  for (const s of searches) {
    const raw = (s.position_applied ?? "").trim();
    if (!raw) continue;
    const key = normKey(raw);
    if (!key) continue;
    const existing = counts.get(key);
    if (existing) existing.n += 1;
    else counts.set(key, { title: raw, n: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n || a.title.localeCompare(b.title))
    .map((c) => c.title);
}

/**
 * A line matches a tracked title when the full title appears in it, or when at
 * least two of the title's significant tokens do (so "Chief of Staff" still
 * matches "Interim Chief of Staff, Acme"). Returns the matched original titles.
 */
function matchTitles(line: string, tracked: string[]): string[] {
  const hay = normKey(line);
  if (!hay) return [];
  const hits: string[] = [];
  for (const title of tracked) {
    const key = normKey(title);
    if (!key) continue;
    if (hay.includes(key)) {
      hits.push(title);
      continue;
    }
    const tokens = titleTokens(title);
    if (tokens.length >= 2) {
      const present = tokens.filter((tok) =>
        new RegExp(`\\b${tok}\\b`).test(hay)
      );
      if (present.length >= Math.min(2, tokens.length)) hits.push(title);
    }
  }
  return hits;
}

export async function getJobAlerts(): Promise<JobAlertsData> {
  const empty: JobAlertsData = {
    matched: [],
    other: [],
    trackedTitles: [],
    lastScanDate: null,
    scannedBriefs: 0,
    configured: hasConfig(),
  };
  if (!hasConfig()) return empty;

  const [briefs, trackedTitles] = await Promise.all([
    loadBriefs(),
    trackedRoleTitles(),
  ]);
  if (briefs.length === 0) return { ...empty, trackedTitles };

  const seen = new Set<string>();
  const matched: JobAlert[] = [];
  const other: JobAlert[] = [];
  let lastScanDate: string | null = null;

  for (const brief of briefs) {
    const parsed = parseMorningBrief(brief.content_md);
    const bucket = parsed.emailGroups.find((g) => isJobSearchBucket(g.title));
    if (!bucket) continue;

    // Each bullet is one opportunity; fall back to body lines when the
    // publisher wrote prose instead of a list.
    const lines =
      bucket.bullets.length > 0
        ? bucket.bullets
        : bucket.body
          ? bucket.body.split(/\n+/)
          : [];

    let bucketHadContent = false;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || isNoise(line)) continue;
      bucketHadContent = true;

      const text = stripUrls(line) || line;
      const key = normKey(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const alert: JobAlert = {
        id: `${brief.brief_date}:${key.slice(0, 60)}`,
        briefDate: brief.brief_date,
        text,
        url: extractUrl(line),
        matchedTitles: matchTitles(text, trackedTitles),
      };
      if (alert.matchedTitles.length > 0) matched.push(alert);
      else other.push(alert);
    }

    if (bucketHadContent && !lastScanDate) lastScanDate = brief.brief_date;
  }

  return {
    matched,
    other,
    trackedTitles,
    lastScanDate,
    scannedBriefs: briefs.length,
    configured: true,
  };
}
