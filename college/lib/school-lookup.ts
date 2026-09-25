import {
  formatSources,
  lookupSummary,
  mergeFacts,
  parseSearchJson,
  type FoundFacts,
  type SearchFacts,
  type SourceLink,
} from "./school-research";
import { queryCollegeScorecard } from "./college-scorecard";

export type LookupResult = {
  facts: FoundFacts;
  sourcesText: string;
  summary: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function webSearchAvailable(): Promise<boolean> {
  const { aiGatewayAvailable } = await import("./ai-model");
  return aiGatewayAvailable();
}

function collectSources(result: {
  sources?: unknown[];
  steps?: Array<{ toolResults?: Array<{ output?: unknown }> }>;
}): SourceLink[] {
  const out: SourceLink[] = [];
  const seen = new Set<string>();
  const push = (title: string | null, url: string) => {
    if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.add(url);
    out.push({ title: title || "Source", url });
  };
  for (const source of result.sources ?? []) {
    const item = source as { url?: string; title?: string };
    push(item.title ?? null, item.url ?? "");
  }
  for (const step of result.steps ?? []) {
    for (const tool of step.toolResults ?? []) {
      const output = tool.output as { results?: Array<{ title?: string; url?: string }> } | undefined;
      if (!output || !Array.isArray(output.results)) continue;
      for (const item of output.results) push(item.title ?? null, item.url ?? "");
    }
  }
  return out;
}

async function searchWeb(
  name: string,
  today: string,
): Promise<{ facts: SearchFacts | null; sources: SourceLink[]; status: "filled" | "empty" | "skipped" | "failed" }> {
  if (!(await webSearchAvailable())) return { facts: null, sources: [], status: "skipped" };
  try {
    const { generateText, stepCountIs } = await import("ai");
    const { gateway } = await import("@ai-sdk/gateway");
    const {
      FREE_FALLBACK_COLLEGE_AI_MODEL,
      isGatewayModelAccessError,
      resolveCollegeModel,
    } = await import("./ai-model");

    const runSearch = async (modelOverride?: string | null) => {
      const result = await generateText({
        model: await resolveCollegeModel(modelOverride),
        tools: {
          perplexity_search: gateway.tools.perplexitySearch({
            maxResults: 6,
            country: "US",
            searchLanguageFilter: ["en"],
          }),
        },
        stopWhen: stepCountIs(6),
        maxOutputTokens: 1400,
        system: `You fill a college record from web search only. Use the perplexity_search tool. Never invent a number, date, major, or requirement. If a fact is not in the search results, use an empty string.

Return ONLY JSON:
{"officialName":"","location":"","campusSize":"","mechanicalEngineering":"","materials":"","materialsOffering":"","testPolicy":"","applicationPlatform":"","requiredEssays":"","teacherRecs":"","meritAidNotes":"","deadlines":[{"title":"","dueDate":""}]}

mechanicalEngineering and materials are Yes, No, or "". Yes only if a result says that undergraduate major is offered. No only if a result says it is not offered.
dueDate is YYYY-MM-DD only when the result states that exact date, including the year. If the year is missing, put the month and day in the title and leave dueDate empty.
Do not include SAT scores, admit rates, or prices. Do not choose a plan for the family.`,
        prompt: `Look up undergraduate admissions facts for ${name}. Kyle is a junior at Columbia High School in Maplewood, NJ, interested in mechanical engineering and materials, enrolling in fall 2028. Find the application platform, required essays, teacher recommendation count, whether mechanical engineering and materials are offered, merit scholarships that are publicly described, and application deadline dates.`,
      });
      const sources = collectSources(result);
      const facts = parseSearchJson(result.text ?? "", today);
      if (!facts || sources.length === 0) return { facts: null, sources, status: "empty" as const };
      const hasFact = Boolean(
        facts.location ||
          facts.applicationPlatform ||
          facts.requiredEssays ||
          facts.teacherRecs ||
          facts.mechanicalEngineering ||
          facts.materials ||
          facts.deadlines.length ||
          facts.meritAidNotes ||
          facts.testPolicy,
      );
      return {
        facts,
        sources,
        status: hasFact ? ("filled" as const) : ("empty" as const),
      };
    };

    try {
      return await runSearch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (isGatewayModelAccessError(message)) {
        return await runSearch(FREE_FALLBACK_COLLEGE_AI_MODEL);
      }
      throw error;
    }
  } catch (error) {
    console.error("School web search failed", error);
    return { facts: null, sources: [], status: "failed" };
  }
}

export async function lookupSchool(name: string): Promise<LookupResult> {
  const today = todayIso();
  let scorecard = await queryCollegeScorecard(name);

  const search = await searchWeb(name, today);
  if (
    scorecard.status !== "hit" &&
    search.facts?.officialName &&
    search.facts.officialName.toLowerCase() !== name.toLowerCase()
  ) {
    const retry = await queryCollegeScorecard(search.facts.officialName);
    if (retry.status === "hit") scorecard = retry;
    else if (scorecard.status !== "failed") scorecard = retry;
  }

  const facts = mergeFacts(
    scorecard.status === "hit" ? scorecard.facts : null,
    search.status === "filled" ? search.facts : null,
    search.sources,
  );
  return {
    facts,
    sourcesText: formatSources(facts.sources),
    summary: lookupSummary({
      name,
      facts,
      scorecard: scorecard.status,
      search: search.status,
    }),
  };
}
