import "server-only";

// Company research for Interview Prep. Uses Vercel AI Gateway Perplexity
// search (same pattern as meeting-prep research) so we can ground the brief
// in recent public facts about the hiring company and role.

import { gateway } from "@ai-sdk/gateway";
import { generateText, stepCountIs } from "ai";
import { heavyModel } from "@/lib/ai/models";
import { collectResearchSources } from "@/lib/ai/research";
import { cleanResearchBrief } from "@/lib/ai/research-clean";

export interface CompanyResearchResult {
  text: string;
  sources: { title: string | null; url: string }[];
  searched: boolean;
}

function cleanErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Web search failed.";
  return raw.replace(/\u001b\[[0-9;]*m/g, "").replace(/\s+/g, " ").trim();
}

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
        outputs.push(JSON.stringify(output));
      }
    }
  }
  if (outputs.length === 0) return false;
  return outputs.every((o) =>
    /no results found|returned no results|0 results|nothing found/i.test(o)
  );
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

Format as tight bullets (6-10 max), each with a source name and approximate date when possible. Never invent news. If search is thin, say so plainly.

OUTPUT RULES (hard):
- Return ONLY the final brief the user should read.
- Never narrate that you are searching.
- Never include <tool_call>, <tool_response>, JSON tool payloads, or raw tool output.
- Never paste "No results found for …" lines from the tool.
- If nothing useful was found, reply with 2-4 short sentences saying so. Do not list every failed query.`;

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

    const sources = collectResearchSources(result);
    const cleaned = cleanResearchBrief(result.text);
    const emptyTools = toolOutputsLookEmpty(result);

    if (
      sources.length === 0 &&
      (emptyTools || !cleaned || /no results found for/i.test(cleaned))
    ) {
      return {
        text: [
          `No notable recent public coverage found for ${company}.`,
          "Rely on the job description for company context, and spot-check the company site / LinkedIn / Crunchbase before the interview.",
        ].join(" "),
        sources: [],
        searched: false,
      };
    }

    return {
      text:
        cleaned ||
        "Search completed but produced no summary. See sources below if listed.",
      sources,
      searched: sources.length > 0 || Boolean(cleaned),
    };
  } catch (err) {
    return {
      text: `Company web search unavailable (${cleanErrorMessage(err)}). Prep will rely on the job description and resume only.`,
      sources: [],
      searched: false,
    };
  }
}
