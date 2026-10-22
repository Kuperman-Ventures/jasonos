import "server-only";

export interface FirecrawlSearchHit {
  url: string;
  title: string | null;
  description: string | null;
}

const FIRECRAWL_SEARCH = "https://api.firecrawl.dev/v2/search";
const FIRECRAWL_SCRAPE = "https://api.firecrawl.dev/v2/scrape";
const SCRAPE_TEXT_CAP = 12_000;

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

type FirecrawlConnectionConfig = {
  access_token?: string;
};

async function loadFirecrawlConnectionConfig(): Promise<FirecrawlConnectionConfig> {
  try {
    const { createPublicServiceRoleClient } = await import("@/lib/supabase/server");
    const sb = createPublicServiceRoleClient();
    const { data } = await sb
      .from("service_connections")
      .select("config")
      .eq("service_name", "firecrawl")
      .order("updated_at", { ascending: false });
    for (const row of data ?? []) {
      const cfg = (row.config ?? {}) as FirecrawlConnectionConfig;
      if (cfg.access_token?.trim()) return cfg;
    }
    return {};
  } catch {
    return {};
  }
}

/** Prefer Settings → Firecrawl key; fall back to Vercel env. */
export async function resolveFirecrawlApiKey(): Promise<string | null> {
  const cfg = await loadFirecrawlConnectionConfig();
  const fromSettings = cfg.access_token?.trim();
  if (fromSettings) return fromSettings;
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

/** Scrape one URL to markdown/text. Caps body at 12,000 characters. */
export async function firecrawlScrape(
  url: string,
  opts?: { apiKey?: string | null }
): Promise<{ title: string | null; text: string; links: string[] } | null> {
  const target = url.trim();
  if (!/^https?:\/\//i.test(target)) return null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key =
    (typeof opts?.apiKey === "string" && opts.apiKey.trim()) ||
    (await resolveFirecrawlApiKey());
  if (!key) return null;
  headers.Authorization = `Bearer ${key}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(FIRECRAWL_SCRAPE, {
      method: "POST",
      headers,
      body: JSON.stringify({
        url: target,
        formats: ["markdown", "links"],
        onlyMainContent: true,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: {
        markdown?: string;
        metadata?: { title?: string | null };
        links?: string[];
      };
    };
    const markdown = body.data?.markdown?.trim() ?? "";
    if (!markdown) return null;
    const title =
      typeof body.data?.metadata?.title === "string"
        ? body.data.metadata.title.trim() || null
        : null;
    const links = Array.isArray(body.data?.links)
      ? body.data!.links!.filter((item): item is string => typeof item === "string")
      : [];
    return { title, text: markdown.slice(0, SCRAPE_TEXT_CAP), links };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function firecrawlSearch(
  query: string,
  opts?: { limit?: number; excludeDomains?: string[]; apiKey?: string | null }
): Promise<FirecrawlSearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key =
    (typeof opts?.apiKey === "string" && opts.apiKey.trim()) ||
    (await resolveFirecrawlApiKey());
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
