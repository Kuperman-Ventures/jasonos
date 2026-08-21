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
      // Drop tracking noise; keep the job path.
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
  const byUrl = new Map<string, JobCard>();

  const consider = (rawUrl: string, rawTitle: string | null, nearby: string) => {
    const url = cleanUrl(rawUrl);
    const score = scoreUrl(url);
    if (score < 80) return;
    const title = rawTitle ? decodeHtml(rawTitle) : null;
    const usableTitle =
      title && title.length >= 4 && !WEAK_TITLE_RE.test(title) && !/^https?:/i.test(title)
        ? title.slice(0, 180)
        : null;
    const compensation = extractCompensation(nearby) ?? extractCompensation(title ?? "");
    const prev = byUrl.get(url);
    if (!prev) {
      byUrl.set(url, { url, title: usableTitle, compensation });
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
      if (byUrl.has(cleanUrl(url))) continue;
      consider(url, null, blob.slice(0, 400));
    }
  }

  return [...byUrl.values()];
}
