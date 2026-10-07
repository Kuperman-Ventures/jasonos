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

function isPerplexityToolName(name: string | undefined): boolean {
  return name === "perplexity_search" || name === "gateway.perplexity_search";
}

/** Perplexity result for a finished run: null when the model never called the search tool. */
export function perplexityOutcome(
  steps: ReadonlyArray<{
    content?: ReadonlyArray<unknown>;
    toolResults?: ReadonlyArray<{ toolName?: string; output?: unknown; type?: string }>;
  }>,
): {
  ok: boolean;
  error?: string;
} | null {
  let called = false;
  for (const step of steps) {
    for (const part of step.content ?? []) {
      const row = part as { type?: string; toolName?: string; error?: unknown };
      if (!isPerplexityToolName(row.toolName)) continue;
      if (row.type === "tool-error") {
        const error = row.error instanceof Error ? row.error.message : String(row.error ?? "Search tool failed");
        return { ok: false, error };
      }
      if (row.type === "tool-result") called = true;
    }
    for (const tool of step.toolResults ?? []) {
      if (!isPerplexityToolName(tool.toolName)) continue;
      const output = tool.output as { error?: string; message?: string } | undefined;
      if (output && typeof output === "object" && typeof output.error === "string") {
        return { ok: false, error: output.message || output.error };
      }
      called = true;
    }
  }
  return called ? { ok: true } : null;
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

    const { recordSourceCall, timeSourceCall } = await import("./data-source-checks");

    const runSearch = async (modelOverride?: string | null) => {
      const model = await resolveCollegeModel(modelOverride);
      const started = Date.now();
      const result = await timeSourceCall("ai-gateway", () => generateText({
        model,
        tools: {
          perplexity_search: gateway.tools.perplexitySearch({
            maxResults: 6,
            country: "US",
            searchLanguageFilter: ["en"],
          }),
        },
        // Step 0 must call Perplexity; later steps answer from those results only.
        prepareStep: ({ stepNumber }) =>
          stepNumber === 0
            ? { toolChoice: { type: "tool" as const, toolName: "perplexity_search" as const } }
            : { toolChoice: "none" as const },
        stopWhen: stepCountIs(6),
        maxOutputTokens: 1400,
        system: `You fill a college record from web search only. Use the perplexity_search tool. Never invent a number, date, major, or requirement. If a fact is not in the search results, use an empty string.

Return ONLY JSON:
{"officialName":"","location":"","campusSetting":"","mechanicalEngineering":"","materials":"","materialsOffering":"","aerospaceEngineering":"","testPolicy":"","applicationPlatform":"","requiredEssays":"","teacherRecs":"","meritAidNotes":"","deadlines":[{"title":"","dueDate":""}]}

mechanicalEngineering, materials, and aerospaceEngineering are Yes, Partial, No, or "". Yes only if a result says that undergraduate major is offered standalone. Partial if only a concentration, track, minor, or certificate exists. No only if a result says it is not offered.
campusSetting is one of Urban, Suburban, Small city, College town, Small town, or "".
dueDate is YYYY-MM-DD only when the result states that exact date, including the year. If the year is missing, put the month and day in the title and leave dueDate empty.
Do not include SAT scores, admit rates, or prices. Do not choose a plan for the family.`,
        prompt: `Look up undergraduate admissions facts for ${name}. Kyle is a junior at Columbia High School in Maplewood, NJ, interested in mechanical engineering, materials, and aerospace, enrolling in fall 2028. Find the application platform, required essays, teacher recommendation count, whether mechanical engineering, materials, and aerospace are offered, merit scholarships that are publicly described, and application deadline dates.`,
      }));
      const searchOutcome = perplexityOutcome(result.steps ?? []);
      if (searchOutcome) {
        recordSourceCall("perplexity", { ...searchOutcome, ms: Date.now() - started });
      }
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
          facts.aerospaceEngineering ||
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
