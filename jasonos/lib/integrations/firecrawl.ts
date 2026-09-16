import "server-only";

export interface FirecrawlSearchHit {
  url: string;
  title: string | null;
  description: string | null;
}

const FIRECRAWL_SEARCH = "https://api.firecrawl.dev/v2/search";

const DEFAULT_EXCLUDE = [
  "wikipedia.org",
  "crunchbase.com",
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "reddit.com",
];

function firecrawlKey(): string | null {
  return process.env.FIRECRAWL_API_KEY?.trim() || null;
}

function asHits(payload: unknown): FirecrawlSearchHit[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as {
    data?: unknown;
    web?: unknown;
    success?: boolean;
  };
  const data = root.data;
  let rows: unknown[] = [];
  if (Array.isArray(data)) {
    rows = data;
  } else if (data && typeof data === "object" && Array.isArray((data as { web?: unknown }).web)) {
    rows = (data as { web: unknown[] }).web;
  } else if (Array.isArray(root.web)) {
    rows = root.web;
  }
  const out: FirecrawlSearchHit[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const url = (row as { url?: unknown }).url;
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) continue;
    const title = (row as { title?: unknown }).title;
    const description =
      (row as { description?: unknown }).description ??
      (row as { snippet?: unknown }).snippet;
    out.push({
      url,
      title: typeof title === "string" ? title : null,
      description: typeof description === "string" ? description : null,
    });
  }
  return out;
}

export async function firecrawlSearch(
  query: string,
  opts?: { limit?: number; excludeDomains?: string[] }
): Promise<FirecrawlSearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = firecrawlKey();
  if (key) headers.Authorization = `Bearer ${key}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(FIRECRAWL_SEARCH, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: q.slice(0, 500),
        limit: opts?.limit ?? 8,
        excludeDomains: opts?.excludeDomains ?? DEFAULT_EXCLUDE,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Firecrawl search ${res.status}${txt ? `: ${txt.slice(0, 160)}` : ""}`);
    }
    return asHits(await res.json());
  } finally {
    clearTimeout(timer);
  }
}
