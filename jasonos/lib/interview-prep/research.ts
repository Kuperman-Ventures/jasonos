import "server-only";

// Company research for Interview Prep. Uses Vercel AI Gateway Perplexity
// search (same pattern as meeting-prep research) so we can ground the brief
// in recent public facts about the hiring company and role.

import { gateway } from "@ai-sdk/gateway";
import { generateText, stepCountIs } from "ai";
import { heavyModel } from "@/lib/ai/models";

export interface CompanyResearchResult {
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

/**
 * Web-grounded brief on the hiring company / role for interview prep.
 * Prefer recent public facts Jason can use in conversation.
 * Soft-fails to an empty result so prep still works if search is down.
 */
export async function researchCompanyForInterview(input: {
  company: string;
  roleTitle?: string | null;
}): Promise<CompanyResearchResult> {
  const company = input.company.trim();
  if (!company || /^the company$/i.test(company)) {
    return {
      text: "No specific company name to research.",
      sources: [],
      searched: false,
    };
  }

  const role = input.roleTitle?.trim() || null;
  const system = `You are researching a company for a candidate preparing for an interview. Use the perplexity_search tool. Report ONLY facts you found via search.

Focus on interview-usable intel:
- what the company does / who it sells to
- recent news (funding, product, leadership, hiring, market moves) from roughly the last 6-12 months
- culture / mission signals only if sourced
- anything that would help a candidate ask sharp questions or connect their background to the company's current priorities

Format as tight bullets (6-10 max), each with a source name and approximate date when possible. Never invent news. If search is thin, say so plainly.`;

  const prompt = `Research ${company}${
    role ? ` for a candidate interviewing for ${role}` : " for a job interview"
  }. Prefer official site, recent press, and reputable coverage. Summarize as short bullets with sources.`;

  try {
    const result = await generateText({
      model: heavyModel(),
      tools: {
        perplexity_search: gateway.tools.perplexitySearch({
          maxResults: 10,
          searchRecencyFilter: "year",
          searchLanguageFilter: ["en"],
          country: "US",
        }),
      },
      stopWhen: stepCountIs(6),
      maxOutputTokens: 1600,
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
    return {
      text:
        text ||
        "Search completed but produced no summary. See sources below if listed.",
      sources,
      searched: sources.length > 0 || Boolean(text),
    };
  } catch (err) {
    return {
      text: `Company web search unavailable (${cleanErrorMessage(err)}). Prep will rely on the job description and resume only.`,
      sources: [],
      searched: false,
    };
  }
}
