import "server-only";

import { firecrawlSearch } from "@/lib/integrations/firecrawl";
import {
  collectUrlCandidates,
  guessedCompanyHomepages,
  pickBestCompanyUrl,
  pickDirectoryDomain,
  type CompanyUrlContext,
} from "@/lib/nyui/work-search-url";

const UA = "JasonOS/1.0 (company homepage lookup)";

async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lookupClearbit(company: string): Promise<string[]> {
  const query = encodeURIComponent(company.slice(0, 80));
  const json = await fetchJson(
    `https://autocomplete.clearbit.com/v1/companies/suggest?query=${query}`,
    5_000
  );
  if (!Array.isArray(json)) return [];
  const rows = json.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const name = (row as { name?: unknown }).name;
    const domain = (row as { domain?: unknown }).domain;
    if (typeof name !== "string" || typeof domain !== "string" || !domain.includes(".")) {
      return [];
    }
    return [{ name, domain }];
  });
  const picked = pickDirectoryDomain(rows, company);
  return [
    ...(picked ? [picked] : []),
    ...rows.map((row) => `https://${row.domain.replace(/^https?:\/\//, "")}/`),
  ];
}

async function lookupWikidata(company: string): Promise<string[]> {
  const search = (await fetchJson(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
      company
    )}&language=en&format=json&limit=5`,
    5_000
  )) as { search?: Array<{ id?: string; label?: string; description?: string }> } | null;
  const hits = search?.search ?? [];
  const orgs = hits.filter((hit) => {
    const desc = (hit.description ?? "").toLowerCase();
    if (/\b(person|human|born \d{4})\b/.test(desc)) return false;
    return true;
  });
  const id = (orgs[0] ?? hits[0])?.id;
  if (!id) return [];
  const entity = (await fetchJson(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(
      id
    )}&props=claims&format=json`,
    5_000
  )) as {
    entities?: Record<
      string,
      { claims?: { P856?: Array<{ mainsnak?: { datavalue?: { value?: unknown } } }> } }
    >;
  } | null;
  const claims = entity?.entities?.[id]?.claims?.P856 ?? [];
  return claims.flatMap((claim) => {
    const value = claim.mainsnak?.datavalue?.value;
    return typeof value === "string" && /^https?:\/\//i.test(value) ? [value] : [];
  });
}

async function lookupFirecrawl(company: string): Promise<string[]> {
  const hits = await firecrawlSearch(`${company} official website`, { limit: 8 });
  const urls: string[] = [];
  for (const hit of hits) {
    urls.push(hit.url);
    urls.push(...collectUrlCandidates(`${hit.title ?? ""}\n${hit.description ?? ""}`));
  }
  return urls;
}

/** Corporate homepage for a company name. Firecrawl first, then directories. */
export async function lookupCompanyHomepage(company: string): Promise<string | null> {
  const name = company.trim();
  if (!name) return null;
  const ctx: CompanyUrlContext = { company: name };
  const settled = await Promise.allSettled([
    lookupFirecrawl(name),
    lookupClearbit(name),
    lookupWikidata(name),
  ]);
  const urls: string[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") urls.push(...result.value);
  }
  urls.push(...guessedCompanyHomepages(name));
  return pickBestCompanyUrl(urls, ctx)?.url ?? null;
}
