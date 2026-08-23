// Score and pick the best "actual job listing" URL from email body text/HTML.
// Used when a morning-brief Job Alert only deep-links into Gmail.

const SKIP_HOST_RE =
  /mail\.google\.com|accounts\.google\.com|google\.com\/url|unsubscribe|mailto:|linkedin\.com\/comm\/security|linkedin\.com\/uas|indeed\.com\/rc\/clk\?.*ad=|safelinks\.protection\.outlook/i;

type Rule = { re: RegExp; score: number };

const RULES: Rule[] = [
  { re: /linkedin\.com\/(?:comm\/)?jobs\/view\//i, score: 100 },
  { re: /linkedin\.com\/jobs\/collections\//i, score: 85 },
  { re: /linkedin\.com\/jobs\/search/i, score: 70 },
  { re: /indeed\.com\/(?:viewjob|job\/)/i, score: 95 },
  { re: /indeed\.com\/m\/viewjob/i, score: 95 },
  { re: /indeed\.com\/rc\/clk/i, score: 80 },
  { re: /theladders\.com\/job\//i, score: 95 },
  { re: /boards\.greenhouse\.io\//i, score: 90 },
  { re: /job-boards\.greenhouse\.io\//i, score: 90 },
  { re: /greenhouse\.io\//i, score: 85 },
  { re: /jobs\.lever\.co\//i, score: 90 },
  { re: /lever\.co\//i, score: 80 },
  { re: /jobs\.ashbyhq\.com\//i, score: 90 },
  { re: /ashbyhq\.com\//i, score: 80 },
  { re: /myworkdayjobs\.com\//i, score: 85 },
  { re: /workday\.com\//i, score: 70 },
  { re: /smartrecruiters\.com\//i, score: 80 },
  { re: /jobvite\.com\//i, score: 75 },
  { re: /icims\.com\//i, score: 75 },
  { re: /careers\.[a-z0-9.-]+\//i, score: 60 },
  { re: /jobs\.[a-z0-9.-]+\//i, score: 55 },
];

function scoreUrl(url: string): number {
  if (SKIP_HOST_RE.test(url)) return -1;
  let best = -1;
  for (const rule of RULES) {
    if (rule.re.test(url)) best = Math.max(best, rule.score);
  }
  return best;
}

/** Pull absolute http(s) URLs from plaintext or HTML (hrefs + bare URLs). */
export function extractUrls(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();

  for (const m of text.matchAll(/href=["'](https?:\/\/[^"'>\s]+)["']/gi)) {
    found.add(cleanUrl(m[1]));
  }
  for (const m of text.matchAll(/https?:\/\/[^\s<>"'`)\]}]+/gi)) {
    found.add(cleanUrl(m[0]));
  }

  return [...found].filter(Boolean);
}

function cleanUrl(raw: string): string {
  let u = raw.trim();
  // Common trailing junk from email clients / markdown.
  u = u.replace(/&amp;/g, "&").replace(/[.,;:!?)]+$/, "");
  // Unwrap Google redirectors when present.
  try {
    const parsed = new URL(u);
    if (
      parsed.hostname === "www.google.com" &&
      parsed.pathname === "/url" &&
      parsed.searchParams.get("q")
    ) {
      return parsed.searchParams.get("q")!;
    }
    if (parsed.hostname.endsWith("linkedin.com")) {
      // Email alerts use /comm/jobs/view/ — normalize to the public job URL.
      parsed.pathname = parsed.pathname.replace(
        /^\/comm\/jobs\/view\//i,
        "/jobs/view/"
      );
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    }
  } catch {
    // keep original
  }
  return u;
}

/**
 * Stable id for a job posting URL so the same role from different email
 * tracking links (or linkedin /comm/ vs /jobs/view/) collapses to one row.
 */
export function canonicalJobListingKey(
  url: string | null | undefined
): string | null {
  if (!url?.trim()) return null;
  const cleaned = cleanUrl(url.trim());
  try {
    const parsed = new URL(cleaned);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const path = parsed.pathname;

    const linkedIn = path.match(/\/jobs\/view\/(\d+)/i);
    if (linkedIn) return `linkedin:${linkedIn[1]}`;

    if (host.includes("indeed.com")) {
      const jk = parsed.searchParams.get("jk");
      if (jk) return `indeed:jk:${jk}`;
      const pathJk = path.match(/\/viewjob\/([A-Za-z0-9]+)/i);
      if (pathJk) return `indeed:path:${pathJk[1]}`;
    }

    if (host.includes("theladders.com")) {
      const ladders = path.match(/\/job\/([^/]+)/i);
      if (ladders) return `ladders:${ladders[1]}`;
    }

    if (host.includes("greenhouse.io")) {
      const gh = path.match(/\/jobs\/(\d+)/i);
      if (gh) return `greenhouse:${host}:${gh[1]}`;
    }

    if (host.includes("lever.co")) {
      return `lever:${host}${path.replace(/\/$/, "").toLowerCase()}`;
    }

    if (host.includes("ashbyhq.com")) {
      return `ashby:${host}${path.replace(/\/$/, "").toLowerCase()}`;
    }

    if (host.includes("myworkdayjobs.com") || host.includes("workday.com")) {
      return `workday:${host}${path.replace(/\/$/, "").toLowerCase()}`;
    }

    return `url:${host}${path.replace(/\/$/, "").toLowerCase()}`;
  } catch {
    return null;
  }
}

/**
 * Pick the highest-scoring job-listing URL from a blob of email text/HTML.
 * Returns null when nothing looks like a real posting.
 */
export function pickJobListingUrl(...blobs: (string | null | undefined)[]): string | null {
  let best: { url: string; score: number } | null = null;
  for (const blob of blobs) {
    if (!blob) continue;
    for (const url of extractUrls(blob)) {
      const score = scoreUrl(url);
      if (score < 0) continue;
      if (!best || score > best.score) best = { url, score };
    }
  }
  // Require a real job-ish score — bare careers homepages at 55+ still count.
  if (!best || best.score < 55) return null;
  return best.url;
}

/** True when the URL is http(s) and looks like a real job posting (not a tracker). */
export function isValidJobListingUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const cleaned = cleanUrl(url.trim());
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  } catch {
    return false;
  }
  if (/linkedin\.com\/jobs\/search/i.test(cleaned)) return false;
  const score = scoreUrl(cleaned);
  // Match extractJobCards: skip search/home links that are not a single posting.
  return score >= 80;
}

/** Drop junk URLs before storing or rendering a listing link. */
export function sanitizeJobListingUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const cleaned = cleanUrl(url.trim());
  return isValidJobListingUrl(cleaned) ? cleaned : null;
}

export interface JobCard {
  url: string;
  title: string | null;
  compensation: string | null;
}

const WEAK_TITLE_RE =
  /^(view|apply|see (all )?jobs?|read more|click here|linkedin|indeed|ladders|job alert|open)$/i;

function decodeHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractCompensation(text: string): string | null {
  const m = text.match(
    /\$\s*[\d,.]+(?:\s*[kK])?(?:\s*(?:[-–—]|to)\s*\$?\s*[\d,.]+(?:\s*[kK])?)?|\bup to\s+\$\s*[\d,.]+(?:\s*[kK])?/i
  );
  if (!m) return null;
  return m[0].replace(/\s+/g, " ").trim();
}

/**
 * Pull every real job-listing card out of an alert email (LinkedIn/Indeed
 * digests often pack several roles into one message). Search/home URLs are
 * skipped so we don't treat "see all jobs" as a posting.
 */
export function extractJobCards(...blobs: (string | null | undefined)[]): JobCard[] {
  const byKey = new Map<string, JobCard>();

  const consider = (rawUrl: string, rawTitle: string | null, nearby: string) => {
    const url = cleanUrl(rawUrl);
    const score = scoreUrl(url);
    if (score < 80) return;
    const key = canonicalJobListingKey(url) ?? url;
    const title = rawTitle ? decodeHtml(rawTitle) : null;
    const usableTitle =
      title && title.length >= 4 && !WEAK_TITLE_RE.test(title) && !/^https?:/i.test(title)
        ? title.slice(0, 180)
        : null;
    const compensation = extractCompensation(nearby) ?? extractCompensation(title ?? "");
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { url, title: usableTitle, compensation });
      return;
    }
    if (!prev.title && usableTitle) prev.title = usableTitle;
    if (!prev.compensation && compensation) prev.compensation = compensation;
  };

  for (const blob of blobs) {
    if (!blob) continue;
    for (const m of blob.matchAll(
      /<a[^>]+href=["'](https?:\/\/[^"'>\s]+)["'][^>]*>([\s\S]*?)<\/a>/gi
    )) {
      const nearby = blob.slice(m.index ?? 0, (m.index ?? 0) + m[0].length + 240);
      consider(m[1], m[2], nearby);
    }
    for (const url of extractUrls(blob)) {
      const cleaned = cleanUrl(url);
      const key = canonicalJobListingKey(cleaned) ?? cleaned;
      if (byKey.has(key)) continue;
      consider(url, null, blob.slice(0, 400));
    }
  }

  return [...byKey.values()];
}
