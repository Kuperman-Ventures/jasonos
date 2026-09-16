import { extractUrls } from "@/lib/integrations/job-listing-urls";

export type CompanyUrlSource = "job_description" | "web_search" | "existing";

export interface CompanyUrlContext {
  company?: string | null;
}

export interface RankedCompanyUrl {
  url: string;
  score: number;
}

const ATS_HOST_RE =
  /greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|workday\.com|smartrecruiters\.com|jobvite\.com|icims\.com|indeed\.com|linkedin\.com|theladders\.com|glassdoor\.com|ziprecruiter\.com|wellfound\.com|angel\.co|otta\.com|builtin\.com|simplyhired\.com|monster\.com|careerbuilder\.com/i;

const JUNK_HOST_RE =
  /wikipedia\.org|crunchbase\.com|pitchbook\.com|owler\.com|zoominfo\.com|dnb\.com|bbb\.org|facebook\.com|twitter\.com|\bx\.com\b|youtube\.com|reddit\.com|instagram\.com|tiktok\.com|fonts\.googleapis|gstatic\.com|schema\.org|w3\.org|sentry\.io|doubleclick|googleadservices|googletagmanager|google-analytics|hotjar|segment\.com|bing\.com|duckduckgo\.com/i;

const CAREER_SUBDOMAIN_RE = /^(careers?|jobs?|apply|recruiting|talent|hiring|go)\./i;

const COMPANY_STOPWORDS = new Set([
  "the",
  "inc",
  "llc",
  "ltd",
  "corp",
  "corporation",
  "company",
  "co",
  "group",
  "holdings",
  "partners",
  "lp",
  "plc",
]);

function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function companyTokens(s: string | null | undefined): string[] {
  return normKey(s ?? "")
    .split(" ")
    .filter((w) => w.length > 1 && !COMPANY_STOPWORDS.has(w));
}

function extractBareWwwUrls(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\bwww\.[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<>"'`]*)?/gi)) {
    out.push(`https://${m[0].replace(/[.,;:!?)]+$/, "")}`);
  }
  return out;
}

export function collectUrlCandidates(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const url of extractUrls(text)) found.add(url);
  for (const url of extractBareWwwUrls(text)) found.add(url);
  return [...found];
}

function hostIsBlocked(host: string): boolean {
  const h = host.replace(/^www\./i, "").toLowerCase();
  return ATS_HOST_RE.test(h) || JUNK_HOST_RE.test(h);
}

/** Collapse a URL to the company's homepage. Job boards / ATS links return null. */
export function companyHomepageFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  let host = parsed.hostname.toLowerCase();
  if (!host) return null;
  if (hostIsBlocked(host)) return null;

  const hadWww = host.startsWith("www.");
  host = host.replace(/^www\./, "");
  host = host.replace(CAREER_SUBDOMAIN_RE, "");
  if (hostIsBlocked(host) || !host.includes(".")) return null;

  return `https://${hadWww ? "www." : ""}${host}/`;
}

export function rankCompanyUrl(url: string, ctx: CompanyUrlContext = {}): number {
  const homepage = companyHomepageFromUrl(url);
  if (!homepage) return -1;

  let parsed: URL;
  try {
    parsed = new URL(homepage);
  } catch {
    return -1;
  }

  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  const compactHost = host.replace(/[^a-z0-9]/g, "");
  const tokens = companyTokens(ctx.company);
  const hits = tokens.filter((tok) => compactHost.includes(tok.replace(/[^a-z0-9]/g, "")));

  let score = 15;
  if (tokens.length > 0) {
    if (hits.length === 0) score -= 20;
    else score += hits.length * 28;
    if (hits.length === tokens.length) score += 18;
  }
  // Homepages beat /about /careers /news paths if a raw URL slipped through.
  if (parsed.pathname === "/") score += 20;
  return score;
}

export function pickBestCompanyUrl(
  urls: Iterable<string | null | undefined>,
  ctx: CompanyUrlContext = {}
): RankedCompanyUrl | null {
  let best: RankedCompanyUrl | null = null;
  const seen = new Set<string>();
  for (const raw of urls) {
    const homepage = raw ? companyHomepageFromUrl(raw) : null;
    if (!homepage || seen.has(homepage)) continue;
    seen.add(homepage);
    const score = rankCompanyUrl(homepage, ctx);
    if (score < 25) continue;
    if (!best || score > best.score) best = { url: homepage, score };
  }
  return best;
}

export function pickCompanyUrlFromText(
  text: string | null | undefined,
  ctx: CompanyUrlContext = {}
): string | null {
  return pickBestCompanyUrl(collectUrlCandidates(text), ctx)?.url ?? null;
}
