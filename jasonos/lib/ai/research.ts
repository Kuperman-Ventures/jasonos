import "server-only";

// Meeting-prep research: a web-grounded brief on a person and their company,
// focused on the last 30 days. Uses Anthropic's server-side web search tool
// routed through the Vercel AI Gateway (same auth as the rest of the app).
//
// Guardrails: the model is told to report ONLY items it actually found via web
// search, each with a source + date, and to say plainly when it found nothing
// (never fabricate news). We also surface whether any sources came back so the
// caller can flag "search unavailable" instead of presenting a hallucination.

import { gateway } from "@ai-sdk/gateway";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export interface ResearchResult {
  text: string;
  sources: { title: string | null; url: string }[];
  searched: boolean;
}

export async function researchPersonNews(input: {
  name: string;
  firm: string | null;
}): Promise<ResearchResult> {
  const who = input.firm ? `${input.name} (${input.firm})` : input.name;
  const system =
    "You are a research assistant preparing a networking-meeting brief. Use the web_search tool to find developments from the LAST 30 DAYS about the person and their company. Report ONLY items you actually found via web search, each as a short bullet with a source name and approximate date. Keep it to 3–6 tight bullets. If web search returns nothing relevant, say clearly that you found no notable recent news. Never invent or infer news that you did not find via search.";
  const prompt = `Find news, announcements, funding, product launches, role changes, press, interviews, or notable public activity from roughly the last 30 days about ${who}${
    input.firm ? ` and the company ${input.firm}` : ""
  }. Summarize as short bullets, each with a source and date.`;

  const result = await generateText({
    model: gateway("anthropic/claude-sonnet-4-6"),
    tools: {
      web_search: anthropic.tools.webSearch_20250305({ maxUses: 5 }),
    },
    maxOutputTokens: 1200,
    system,
    prompt,
  });

  const sources = (result.sources ?? [])
    .map((s) => {
      const anyS = s as { url?: string; title?: string };
      return { title: anyS.title ?? null, url: anyS.url ?? "" };
    })
    .filter((s) => s.url);

  return { text: result.text.trim(), sources, searched: sources.length > 0 };
}
