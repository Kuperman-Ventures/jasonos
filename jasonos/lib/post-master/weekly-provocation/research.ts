import "server-only";

import { gateway } from "@ai-sdk/gateway";
import { generateText, stepCountIs } from "ai";
import Anthropic from "@anthropic-ai/sdk";
import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";
import { callClaude } from "@/lib/ai/models";
import { collectResearchSources } from "@/lib/ai/research";
import { firecrawlSearch, type FirecrawlSearchHit } from "@/lib/integrations/firecrawl";
import { getAnthropicModel } from "@/lib/post-master/anthropic";
import { extractJsonObject } from "@/lib/post-master/weekly-provocation/parse";
import type { ProvocationSource } from "@/lib/post-master/weekly-provocation/types";

const SOCIAL_DOMAINS = [
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "pinterest.com",
];

export type QuestionBackground = {
  background: string;
  sources: ProvocationSource[];
};

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

type SearchHit = ProvocationSource & { description: string | null };

function hitsToSources(hits: FirecrawlSearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const hit of hits) {
    if (seen.has(hit.url)) continue;
    seen.add(hit.url);
    out.push({
      title: hit.title,
      url: hit.url,
      description: hit.description,
    });
  }
  return out;
}

async function searchFirecrawl(query: string): Promise<SearchHit[]> {
  const hits = await firecrawlSearch(query, {
    limit: 6,
    excludeDomains: SOCIAL_DOMAINS,
  });
  return hitsToSources(hits);
}

async function searchPerplexity(query: string): Promise<SearchHit[]> {
  const model = gateway(`anthropic/${getAnthropicModel().replace(/^anthropic\//, "")}`);
  const result = await generateText({
    model,
    tools: {
      perplexity_search: gateway.tools.perplexitySearch({
        maxResults: 6,
        searchRecencyFilter: "year",
        searchLanguageFilter: ["en"],
        country: "US",
      }),
    },
    stopWhen: stepCountIs(4),
    maxOutputTokens: 400,
    system:
      "Search the web for the question. Do not write a brief. Stop after the search.",
    prompt: query,
    providerOptions: {
      anthropic: { thinking: { type: "disabled" } },
    },
  });
  return collectResearchSources(result).map((source) => ({
    title: source.title,
    url: source.url,
    description: null,
  }));
}

async function searchAnthropic(query: string): Promise<SearchHit[]> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return [];
  const client = new Anthropic();
  const message = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6",
    max_tokens: 1400,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
    messages: [
      {
        role: "user",
        content: `Search the web for this question. In your notes, state only facts you found, each with its source URL. Do not advise and do not draft an answer.\n\n${query}`,
      },
    ],
  });

  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  const notes: string[] = [];
  for (const block of message.content) {
    if (block.type === "text" && block.text.trim()) notes.push(block.text.trim());
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
    for (const item of block.content) {
      if (!item || typeof item !== "object" || !("url" in item)) continue;
      const url = typeof item.url === "string" ? item.url.trim() : "";
      if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
      seen.add(url);
      const title = "title" in item && typeof item.title === "string" ? item.title : null;
      hits.push({ title, url, description: null });
    }
  }
  const note = notes.join("\n\n").slice(0, 5000);
  if (note && hits.length) hits[0] = { ...hits[0], description: note };
  return hits;
}

function searchError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "search failed";
  return raw.replace(/\s+/g, " ").slice(0, 180);
}

async function findSources(query: string): Promise<SearchHit[]> {
  try {
    const hits = await searchFirecrawl(query);
    if (hits.length) return hits;
  } catch (err) {
    console.error("[weekly-provocation.search] firecrawl", searchError(err));
  }
  try {
    const hits = await searchAnthropic(query);
    if (hits.length) return hits;
  } catch (err) {
    console.error("[weekly-provocation.search] anthropic", searchError(err));
  }
  try {
    return await searchPerplexity(query);
  } catch (err) {
    console.error("[weekly-provocation.search] perplexity", searchError(err));
    return [];
  }
}

function allowedSources(
  modelSources: { title?: unknown; url?: unknown }[] | undefined,
  found: SearchHit[]
): ProvocationSource[] {
  const allowed = new Map(found.map((source) => [source.url, source]));
  const out: ProvocationSource[] = [];
  const seen = new Set<string>();
  for (const item of modelSources ?? []) {
    const url = typeof item.url === "string" ? item.url.trim() : "";
    const known = allowed.get(url);
    if (!known || seen.has(url)) continue;
    seen.add(url);
    const title = typeof item.title === "string" ? item.title.trim() : "";
    out.push({ title: title || known.title, url });
  }
  if (out.length) return out.slice(0, 5);
  return found.slice(0, 4);
}

/**
 * Background Jason can read before he decides what he thinks.
 * Facts and links come from search results. This does not draft his reply.
 */
export async function researchProvocationQuestion(input: {
  tldr: string;
  question: string;
}): Promise<QuestionBackground> {
  const question = input.question.trim();
  const query = clip(`${question} ${input.tldr}`, 400);
  const found = await findSources(query);
  if (!found.length) {
    return {
      background:
        "No public sources turned up for this question. The email is the only material on file.",
      sources: [],
    };
  }

  const packet = found
    .map((source, index) => {
      const blurb = source.description?.trim();
      return `${index + 1}. ${source.title || "Untitled"}\n${source.url}${
        blurb ? `\n${blurb}` : ""
      }`;
    })
    .join("\n\n");

  const system = `You are briefing Jason Kuperman so he can form his own answer to one question from a Weekly Provocation email.

Do not draft his response. Do not tell him what position to take. Do not open with advice.

Use only the search results below. If a fact is not in those results, leave it out. Never invent a number, quote, or URL.

Write 2 to 4 short paragraphs:
- what the question is about, in concrete terms
- the recent facts the sources actually report
- where those sources disagree, when they do

${NO_AI_SLOP_WRITING_RULES}

Return only JSON:
{"background":"...","sources":[{"title":"...","url":"https://..."}]}
Every URL must be copied from the search results. Keep the JSON complete.`;
  const prompt = `Topic brief:\n${input.tldr}\n\nQuestion:\n${question}\n\nSearch results:\n${packet}`;

  let background = "";
  let picked: { title?: unknown; url?: unknown }[] | undefined;
  for (let attempt = 0; attempt < 2 && !background; attempt += 1) {
    const text = await callClaude({
      model: "claude-sonnet-4-6",
      maxTokens: 2000,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    try {
      const raw = JSON.parse(extractJsonObject(text)) as {
        background?: unknown;
        sources?: { title?: unknown; url?: unknown }[];
      };
      background = typeof raw.background === "string" ? raw.background.trim() : "";
      picked = raw.sources;
    } catch (err) {
      console.error("[weekly-provocation.research] parse", searchError(err));
    }
  }

  return {
    background:
      background ||
      "Search found sources, but the brief did not come back in a usable form. The links below are the pages that matched.",
    sources: allowedSources(picked, found),
  };
}
