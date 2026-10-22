import "server-only";

// Person/company research: a web-grounded brief on a person and their company,
// focused on the last 30 days. Used for meeting prep and for research with
// no meeting on the calendar.
//
// Uses Vercel AI Gateway's Perplexity search tool (works with any model, no
// Anthropic Console "web search" toggle required). Anthropic's native
// web_search tool was previously used here and fails when that org setting
// isn't enabled — which is what users saw as "Couldn't run the web search."

import { gateway } from "@ai-sdk/gateway";
import { generateText, stepCountIs } from "ai";
import { heavyModel } from "@/lib/ai/models";
import { parsePersonCompanyResearch, type PersonCompanyResearch } from "@/lib/ai/research-brief";
import { cleanResearchBrief } from "@/lib/ai/research-clean";

export { cleanResearchBrief } from "@/lib/ai/research-clean";

export interface ResearchResult {
  text: string;
  sources: { title: string | null; url: string }[];
  searched: boolean;
}

function cleanErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Web search failed.";
  return raw.replace(/\u001b\[[0-9;]*m/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Models sometimes echo tool_call / tool_response XML and "I'll search…"
 * narration into result.text. Strip that so the UI only shows the brief.
 */
// cleanResearchBrief lives in research-clean.ts (client-safe).

function toolOutputsLookEmpty(result: {
  steps?: Array<{ toolResults?: Array<{ output?: unknown }> }>;
}): boolean {
  const outputs: string[] = [];
  for (const step of result.steps ?? []) {
    for (const tr of step.toolResults ?? []) {
      const output = tr.output;
      if (output == null) continue;
      if (typeof output === "string") {
        outputs.push(output);
        continue;
      }
      if (typeof output === "object") {
        const o = output as {
          content?: string;
          message?: string;
          error?: string;
          results?: unknown[];
        };
        if (Array.isArray(o.results) && o.results.length > 0) return false;
        if (typeof o.content === "string") outputs.push(o.content);
        if (typeof o.message === "string") outputs.push(o.message);
        if (typeof o.error === "string") outputs.push(o.error);
        // Serialize remaining object shapes for the empty-check regex.
        outputs.push(JSON.stringify(output));
      }
    }
  }
  if (outputs.length === 0) return false;
  return outputs.every((o) =>
    /no results found|returned no results|0 results|nothing found/i.test(o)
  );
}

export function collectResearchSources(result: {
  sources?: unknown[];
  steps?: Array<{ toolResults?: Array<{ output?: unknown }> }>;
}): { title: string | null; url: string }[] {
  const out: { title: string | null; url: string }[] = [];
  const seen = new Set<string>();

  const push = (title: string | null, url: string) => {
    if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.add(url);
    out.push({ title, url });
  };

  for (const s of result.sources ?? []) {
    const anyS = s as { url?: string; title?: string };
    push(anyS.title ?? null, anyS.url ?? "");
  }

  for (const step of result.steps ?? []) {
    for (const tr of step.toolResults ?? []) {
      const output = tr.output as
        | { results?: Array<{ title?: string; url?: string }> }
        | { error?: string; message?: string }
        | undefined;
      if (!output || !("results" in output) || !Array.isArray(output.results)) {
        continue;
      }
      for (const r of output.results) {
        push(r.title ?? null, r.url ?? "");
      }
    }
  }

  return out;
}

export async function researchPersonNews(input: {
  name: string;
  firm: string | null;
}): Promise<ResearchResult> {
  const who = input.firm ? `${input.name} (${input.firm})` : input.name;
  const system = `You are a research assistant preparing a networking brief. Use the perplexity_search tool to find developments from the LAST 30 DAYS about the person and their company. Report ONLY items you actually found via search. Never invent or infer news that you did not find via search.

OUTPUT FORMAT (hard — follow exactly):
- Optional: one short lead sentence (plain prose, no bullet).
- Then 3-6 lines that EACH start with "- " (markdown bullets).
- Each bullet: the finding, then " — " and a source name with approximate date when possible.
- If nothing useful was found: one or two plain sentences saying so. No bullets. No list of failed queries.

OUTPUT RULES (hard):
- Return ONLY the final brief.
- Never narrate that you are searching.
- Never include <tool_call>, <tool_response>, JSON tool payloads, or raw tool output.
- Never paste "No results found for …" lines from the tool.`;
  const prompt = `Find news, announcements, funding, product launches, role changes, press, interviews, or notable public activity from roughly the last 30 days about ${who}${
    input.firm ? ` and the company ${input.firm}` : ""
  }. Summarize as short bullets, each with a source and date.`;

  try {
    const result = await generateText({
      model: heavyModel(),
      tools: {
        perplexity_search: gateway.tools.perplexitySearch({
          maxResults: 8,
          searchRecencyFilter: "month",
          searchLanguageFilter: ["en"],
          country: "US",
        }),
      },
      // Default stopWhen is a single step — we need search then a summary.
      stopWhen: stepCountIs(6),
      maxOutputTokens: 1200,
      system,
      prompt,
      providerOptions: {
        anthropic: {
          thinking: { type: "disabled" },
        },
      },
    });

    const sources = collectResearchSources(result);
    const cleaned = cleanResearchBrief(result.text);
    const emptyTools = toolOutputsLookEmpty(result);

    if (sources.length === 0 && (emptyTools || !cleaned || /no results found for/i.test(cleaned))) {
      return {
        text: [
          `No notable recent public news found for ${who}.`,
          "Check LinkedIn activity, the company site, and Crunchbase/PitchBook directly — open web search did not surface usable coverage.",
        ].join("\n\n"),
        sources: [],
        searched: false,
      };
    }

    if (!cleaned && sources.length === 0) {
      throw new Error(
        "Web search returned no usable findings. Try again in a moment."
      );
    }

    return {
      text:
        cleaned ||
        "Search completed but produced no summary. See sources below if listed.",
      sources,
      searched: sources.length > 0,
    };
  } catch (err) {
    throw new Error(cleanErrorMessage(err));
  }
}

const ABOUT_LINK_RE =
  /\/(about|about-us|team|our-team|people|services|process|how-it-works|what-we-do|company)(\/|$|\?)/i;

async function scrapeCompanySite(domain: string): Promise<{
  pages: Array<{ url: string; title: string | null; text: string }>;
  verified: boolean;
}> {
  const { firecrawlScrape } = await import("@/lib/integrations/firecrawl");
  const homeUrl = `https://${domain}`;
  const home = await firecrawlScrape(homeUrl);
  if (!home?.text.trim()) {
    const www = await firecrawlScrape(`https://www.${domain}`);
    if (!www?.text.trim()) return { pages: [], verified: false };
    return scrapeFollowPages(domain, `https://www.${domain}`, www);
  }
  return scrapeFollowPages(domain, homeUrl, home);
}

async function scrapeFollowPages(
  domain: string,
  homeUrl: string,
  home: { title: string | null; text: string; links: string[] }
): Promise<{
  pages: Array<{ url: string; title: string | null; text: string }>;
  verified: boolean;
}> {
  const { firecrawlScrape } = await import("@/lib/integrations/firecrawl");
  const pages: Array<{ url: string; title: string | null; text: string }> = [
    { url: homeUrl, title: home.title, text: home.text },
  ];
  const host = domain.toLowerCase();
  const candidates = home.links
    .map((link) => {
      try {
        const url = new URL(link, homeUrl);
        if (!url.hostname.replace(/^www\./, "").endsWith(host.replace(/^www\./, ""))) {
          return null;
        }
        if (!ABOUT_LINK_RE.test(url.pathname)) return null;
        url.hash = "";
        return url.toString();
      } catch {
        return null;
      }
    })
    .filter((value): value is string => Boolean(value));
  const seen = new Set(pages.map((page) => page.url.replace(/\/$/, "")));
  for (const link of candidates) {
    if (pages.length >= 3) break;
    const key = link.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const page = await firecrawlScrape(link);
    if (!page?.text.trim()) continue;
    pages.push({ url: link, title: page.title, text: page.text });
  }
  return { pages, verified: pages.length > 0 };
}

export async function researchPersonAndCompany(input: {
  name: string;
  email: string | null;
  company: string | null;
  linkedinUrl: string | null;
}): Promise<PersonCompanyResearch> {
  const { companyDomainFromEmail, emailDomain, isPersonalEmailDomain } = await import(
    "@/lib/meeting-prep/personal-domains"
  );
  const who = [input.name, input.company ? `(${input.company})` : "", input.email ? `<${input.email}>` : ""]
    .filter(Boolean)
    .join(" ");
  const domain = companyDomainFromEmail(input.email);
  const personal = isPersonalEmailDomain(emailDomain(input.email));
  let sitePages: Array<{ url: string; title: string | null; text: string }> = [];
  let companyVerified = false;
  let siteNote: string | null = null;

  if (personal) {
    siteNote = "Personal email domain; company website scrape skipped.";
  } else if (!domain) {
    siteNote = "No company email domain on file; company website could not be read.";
  } else {
    const scraped = await scrapeCompanySite(domain);
    sitePages = scraped.pages;
    companyVerified = scraped.verified;
    if (!companyVerified) {
      siteNote = "Company website could not be read.";
    }
  }

  const siteBlock = sitePages.length
    ? sitePages
        .map(
          (page) =>
            `### ${page.url}${page.title ? ` (${page.title})` : ""}\n${page.text.slice(0, 4000)}`
        )
        .join("\n\n")
    : siteNote || "Company website could not be read.";

  const system = `You are researching someone before Jason Kuperman's meeting.

Company website text is provided below as "Company website, verbatim". Describe the company from its own website first. Use perplexity_search (at most 8 times) only to add what the site does not say, and for the person and recent news. Every company bullet that comes from the site must cite that page URL in sources. When the site could not be read, put "Company website could not be read" in the company lead and do not invent what the company does from search alone beyond a cautious unverified note.

Also establish:
- who this person is (current role, company, what they built before, what they are known for)
- anything material from the last 90 days

Report only what was found. Do not invent a role, company, or URL.

Return ONLY JSON:
{"person":{"lead":"","bullets":[],"sources":[{"title":"","url":""}]},"company":{"name":null,"website":null,"lead":"","bullets":[],"sources":[{"title":"","url":""}]},"title":null,"linkedinUrl":null}`;

  const prompt = `Research ${who}.${
    input.linkedinUrl ? ` LinkedIn on file: ${input.linkedinUrl}.` : ""
  }

Company website, verbatim:
${siteBlock}

Return the JSON object and nothing else.`;

  try {
    const result = await generateText({
      model: heavyModel(),
      tools: {
        perplexity_search: gateway.tools.perplexitySearch({
          maxResults: 5,
          searchLanguageFilter: ["en"],
          country: "US",
        }),
      },
      stopWhen: stepCountIs(9),
      maxOutputTokens: 1800,
      system,
      prompt,
      providerOptions: {
        anthropic: {
          thinking: { type: "disabled" },
        },
      },
    });
    const parsed = parsePersonCompanyResearch(result.text ?? "");
    if (!parsed) {
      throw new Error("Web search did not return a usable profile.");
    }
    if (parsed.person.sources.length === 0 && parsed.company.sources.length === 0) {
      const found = collectResearchSources(result);
      if (found.length) parsed.person.sources = found.slice(0, 8);
    }
    for (const page of sitePages) {
      if (!parsed.company.sources.some((source) => source.url === page.url)) {
        parsed.company.sources.unshift({ title: page.title, url: page.url });
      }
    }
    parsed.company.sources = parsed.company.sources.slice(0, 8);
    if (!companyVerified && !parsed.company.lead?.toLowerCase().includes("could not be read")) {
      parsed.company.lead = [
        "Company website could not be read.",
        parsed.company.lead?.trim() || "",
      ]
        .filter(Boolean)
        .join(" ");
    }
    if (domain && !parsed.website) parsed.website = `https://${domain}`;
    parsed.companyVerified = companyVerified;
    return parsed;
  } catch (err) {
    throw new Error(cleanErrorMessage(err));
  }
}
