import {
  formatSources,
  lookupSummary,
  mapScorecard,
  mergeFacts,
  parseSearchJson,
  pickScorecardMatch,
  type FoundFacts,
  type ScorecardRow,
  type SearchFacts,
  type SourceLink,
} from "./school-research";

const SCORECARD_FIELDS = [
  "id",
  "school.name",
  "school.city",
  "school.state",
  "school.locale",
  "school.school_url",
  "school.ownership",
  "latest.student.size",
  "latest.admissions.admission_rate.overall",
  "latest.admissions.test_requirements",
  "latest.admissions.sat_scores.25th_percentile.critical_reading",
  "latest.admissions.sat_scores.75th_percentile.critical_reading",
  "latest.admissions.sat_scores.25th_percentile.math",
  "latest.admissions.sat_scores.75th_percentile.math",
  "latest.cost.attendance.academic_year",
  "latest.cost.tuition.in_state",
  "latest.cost.tuition.out_of_state",
  "latest.cost.roomboard.oncampus",
  "latest.cost.booksupply",
  "latest.cost.otherexpense.oncampus",
].join(",");

export type LookupResult = {
  facts: FoundFacts;
  sourcesText: string;
  summary: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function webSearchAvailable(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL,
  );
}

async function scorecardRows(name: string): Promise<ScorecardRow[]> {
  const key = process.env.COLLEGE_SCORECARD_API_KEY?.trim() || "DEMO_KEY";
  const url = new URL("https://api.data.gov/ed/collegescorecard/v1/schools.json");
  url.searchParams.set("api_key", key);
  url.searchParams.set("school.name", name);
  url.searchParams.set("school.operating", "1");
  url.searchParams.set("school.main_campus", "1");
  url.searchParams.set("per_page", "20");
  url.searchParams.set("fields", SCORECARD_FIELDS);
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`College Scorecard returned ${response.status}`);
  const body = (await response.json()) as { results?: ScorecardRow[] };
  return body.results ?? [];
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

async function searchWeb(name: string, today: string): Promise<{ facts: SearchFacts | null; sources: SourceLink[]; status: "filled" | "empty" | "skipped" | "failed" }> {
  if (!webSearchAvailable()) return { facts: null, sources: [], status: "skipped" };
  try {
    const { generateText, stepCountIs } = await import("ai");
    const { gateway } = await import("@ai-sdk/gateway");
    const result = await generateText({
      model: gateway("anthropic/claude-sonnet-4-6"),
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
    if (!facts || sources.length === 0) return { facts: null, sources, status: "empty" };
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
    return { facts, sources, status: hasFact ? "filled" : "empty" };
  } catch (error) {
    console.error("School web search failed", error);
    return { facts: null, sources: [], status: "failed" };
  }
}

export async function lookupSchool(name: string): Promise<LookupResult> {
  const today = todayIso();
  let scorecard: FoundFacts | null = null;
  let scorecardStatus: "hit" | "miss" | "failed" = "miss";
  try {
    const rows = await scorecardRows(name);
    const match = pickScorecardMatch(name, rows);
    if (match) {
      scorecard = mapScorecard(match);
      scorecardStatus = "hit";
    }
  } catch (error) {
    console.error("College Scorecard lookup failed", error);
    scorecardStatus = "failed";
  }

  const search = await searchWeb(name, today);
  if (!scorecard && search.facts?.officialName && search.facts.officialName.toLowerCase() !== name.toLowerCase()) {
    try {
      const rows = await scorecardRows(search.facts.officialName);
      const match = pickScorecardMatch(search.facts.officialName, rows);
      if (match) {
        scorecard = mapScorecard(match);
        scorecardStatus = "hit";
      }
    } catch (error) {
      console.error("College Scorecard retry failed", error);
      if (scorecardStatus !== "hit") scorecardStatus = "failed";
    }
  }

  const facts = mergeFacts(scorecard, search.status === "filled" ? search.facts : null, search.sources);
  return {
    facts,
    sourcesText: formatSources(facts.sources),
    summary: lookupSummary({ name, facts, scorecard: scorecardStatus, search: search.status }),
  };
}
