import "server-only";

// Meeting-prep research: a web-grounded brief on a person and their company,
// focused on the last 30 days.
//
// Uses Vercel AI Gateway's Perplexity search tool (works with any model, no
// Anthropic Console "web search" toggle required). Anthropic's native
// web_search tool was previously used here and fails when that org setting
// isn't enabled — which is what users saw as "Couldn't run the web search."

import { gateway } from "@ai-sdk/gateway";
import { generateText, stepCountIs } from "ai";
import { heavyModel } from "@/lib/ai/models";

export interface ResearchResult {
  text: string;
  sources: { title: string | null; url: string }[];
  searched: boolean;
}

function cleanErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Web search failed.";
  return raw.replace(/\u001b\[[0-9;]*m/g, "").replace(/\s+/g, " ").trim();
}

function collectSources(result: {
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
  const system =
    "You are a research assistant preparing a networking-meeting brief. Use the perplexity_search tool to find developments from the LAST 30 DAYS about the person and their company. Report ONLY items you actually found via search, each as a short bullet with a source name and approximate date. Keep it to 3–6 tight bullets. If search returns nothing relevant, say clearly that you found no notable recent news. Never invent or infer news that you did not find via search.";
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

    const sources = collectSources(result);
    const text = result.text.trim();
    if (!text && sources.length === 0) {
      throw new Error(
        "Web search returned no usable findings. Try again in a moment."
      );
    }

    return {
      text:
        text ||
        "Search completed but produced no summary. See sources below if listed.",
      sources,
      searched: sources.length > 0,
    };
  } catch (err) {
    throw new Error(cleanErrorMessage(err));
  }
}
