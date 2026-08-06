import "server-only";

import { gateway } from "@ai-sdk/gateway";
import { generateText, stepCountIs } from "ai";
import { getAnthropicModel } from "@/lib/post-master/anthropic";
import type { ResearchFindings, ResearchSource } from "@/lib/post-master/types";

type RawResearch = {
  whitespace?: {
    title?: string;
    summary?: string;
    sources?: { title?: string | null; url?: string }[];
  }[];
  contradictions?: {
    topic?: string;
    sideA?: string;
    sideB?: string;
    sources?: { title?: string | null; url?: string }[];
  }[];
  ideaSeed?: string;
};

function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function extractJsonObject(raw: string): string {
  const text = stripFences(raw);
  try {
    JSON.parse(text);
    return text;
  } catch {
    // Fall through — model sometimes wraps JSON in prose.
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  throw new Error(`Research structuring returned non-JSON output: ${text.slice(0, 240)}`);
}

function normalizeSources(
  sources: { title?: string | null; url?: string }[] | undefined,
  fallback: ResearchSource[]
): ResearchSource[] {
  const fromModel = (sources ?? [])
    .map((s) => ({
      title: s.title?.trim() || null,
      url: (s.url ?? "").trim(),
    }))
    .filter((s) => /^https?:\/\//i.test(s.url));

  if (fromModel.length > 0) return fromModel;
  return fallback.slice(0, 2);
}

function buildIdeaText(input: {
  topic: string;
  guidance: string;
  whitespace: ResearchFindings["whitespace"];
  contradictions: ResearchFindings["contradictions"];
  ideaSeed: string;
}): string {
  const ws = input.whitespace
    .map((w, i) => {
      const links = w.sources.map((s) => s.url).filter(Boolean).join(" | ");
      return `${i + 1}. ${w.title}: ${w.summary}${links ? ` (sources: ${links})` : ""}`;
    })
    .join("\n");

  const cx = input.contradictions
    .map((c, i) => {
      const links = c.sources.map((s) => s.url).filter(Boolean).join(" | ");
      return `${i + 1}. ${c.topic}\n   Side A: ${c.sideA}\n   Side B: ${c.sideB}${
        links ? `\n   Sources: ${links}` : ""
      }`;
    })
    .join("\n");

  return [
    `RESEARCH BRIEF (from web search)`,
    `Topic: ${input.topic}`,
    input.guidance ? `Guidance / angle: ${input.guidance}` : null,
    "",
    "Whitespace / under-discussed angles:",
    ws || "(none found)",
    "",
    "Where credible voices contradict each other:",
    cx || "(none found)",
    "",
    input.ideaSeed ? `Sharpest synthesis: ${input.ideaSeed}` : null,
    "",
    "Use this brief as the core idea for hooks and drafts. Prefer the sharpest whitespace or contradiction. Do not invent sources or stats beyond what is in this brief; use [X] placeholders if a number is implied but not sourced.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function cleanErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Research failed.";
  const cleaned = raw.replace(/\u001b\[[0-9;]*m/g, "").replace(/\s+/g, " ").trim();

  // Anthropic/AI SDK structured-output schema failures show up as opaque pattern errors.
  if (/did not match the expected pattern/i.test(cleaned)) {
    return "Research structuring failed on a schema validation edge case. Please try again — usually a second run works.";
  }
  if (/could not parse the response/i.test(cleaned) || /no object generated/i.test(cleaned)) {
    return "Research structuring failed to return usable findings. Please try again with a slightly sharper topic or guidance.";
  }
  return cleaned;
}

/**
 * Two-step research:
 * 1) Perplexity web search via AI Gateway (notes — prose is fine)
 * 2) structure those notes into JSON via plain generateText (no generateObject /
 *    structured-output schema path — that was throwing pattern-match failures)
 *
 * Uses gateway.tools.perplexitySearch instead of Anthropic's native web_search
 * so research works without enabling web search in the Anthropic Console.
 */
export async function runPostMasterResearch(input: {
  topic: string;
  guidance: string;
}): Promise<ResearchFindings> {
  const topic = input.topic.trim();
  const guidance = input.guidance.trim();
  if (!topic) {
    throw new Error("Topic is required.");
  }

  const model = gateway(
    `anthropic/${getAnthropicModel().replace(/^anthropic\//, "")}`
  );

  try {
    const search = await generateText({
      model,
      tools: {
        perplexity_search: gateway.tools.perplexitySearch({
          maxResults: 10,
          searchRecencyFilter: "month",
          searchLanguageFilter: ["en"],
          country: "US",
        }),
      },
      stopWhen: stepCountIs(8),
      maxOutputTokens: 2500,
      system: `You are a research analyst for Jason Kuperman's Post Master (NarrativeOS).
Use the perplexity_search tool. Report ONLY what you actually find via search — never invent sources, quotes, or debates.

Gather notes on:
1) 2–3 areas of genuine whitespace or under-discussed angles (not the most obvious LinkedIn takes)
2) 2–3 points where credible voices contradict each other

Prefer recent, credible sources. In your final answer, write clear research notes with source titles and full URLs inline. Plain text is fine — no JSON required in this step.`,
      prompt: `Topic: ${topic}
${guidance ? `Guidance / angle to explore: ${guidance}` : "Guidance: find the least-obvious, most operator-relevant angles."}

Search the web, then write research notes with URLs.`,
      providerOptions: {
        anthropic: {
          thinking: { type: "disabled" },
        },
      },
    });

    const toolSources: ResearchSource[] = [];
    const seenToolUrls = new Set<string>();
    const pushSource = (title: string | null, url: string) => {
      if (!url || !/^https?:\/\//i.test(url) || seenToolUrls.has(url)) return;
      seenToolUrls.add(url);
      toolSources.push({ title, url });
    };
    for (const s of search.sources ?? []) {
      const anyS = s as { url?: string; title?: string };
      pushSource(anyS.title ?? null, anyS.url ?? "");
    }
    for (const step of search.steps ?? []) {
      for (const tr of step.toolResults ?? []) {
        const output = tr.output as
          | { results?: Array<{ title?: string; url?: string }> }
          | undefined;
        if (!output?.results) continue;
        for (const r of output.results) {
          pushSource(r.title ?? null, r.url ?? "");
        }
      }
    }

    const notes = search.text.trim();
    if (!notes && toolSources.length === 0) {
      throw new Error(
        "Web search returned no usable findings. Try a sharper topic or guidance."
      );
    }

    const sourceBlock =
      toolSources.length > 0
        ? toolSources
            .map((s, i) => `${i + 1}. ${s.title || "Source"} — ${s.url}`)
            .join("\n")
        : "(no structured tool sources attached; use only URLs present in the notes)";

    const structured = await generateText({
      model,
      maxOutputTokens: 3000,
      system: `Convert research notes into Post Master findings JSON.
Only use facts, claims, and URLs present in the notes or source list.
Prefer 2–3 whitespace items and 2–3 contradictions when the notes support them.
Every source URL must be a full http(s) URL from the notes/source list — never invent URLs.
ideaSeed should be a sharp 2–4 sentence synthesis for a post angle.

Return ONLY valid JSON (no markdown fences, no commentary) in this exact shape:
{
  "whitespace": [
    { "title": "...", "summary": "2–4 sentences", "sources": [{ "title": "...", "url": "https://..." }] }
  ],
  "contradictions": [
    {
      "topic": "short label for the disagreement",
      "sideA": "one credible position",
      "sideB": "the opposing credible position",
      "sources": [{ "title": "...", "url": "https://..." }]
    }
  ],
  "ideaSeed": "2–4 sentence synthesis"
}`,
      prompt: `Topic: ${topic}
${guidance ? `Guidance: ${guidance}` : ""}

RESEARCH NOTES:
${notes || "(empty notes — rely on source list if possible)"}

SOURCE LIST FROM TOOL:
${sourceBlock}`,
      providerOptions: {
        anthropic: {
          thinking: { type: "disabled" },
        },
      },
    });

    let raw: RawResearch;
    try {
      raw = JSON.parse(extractJsonObject(structured.text)) as RawResearch;
    } catch (err) {
      throw new Error(cleanErrorMessage(err));
    }

    const whitespace = (raw.whitespace ?? [])
      .slice(0, 3)
      .map((w) => ({
        title: w.title?.trim() || "Whitespace angle",
        summary: w.summary?.trim() || "",
        sources: normalizeSources(w.sources, toolSources),
      }))
      .filter((w) => w.summary);

    const contradictions = (raw.contradictions ?? [])
      .slice(0, 3)
      .map((c) => ({
        topic: c.topic?.trim() || "Contradiction",
        sideA: c.sideA?.trim() || "",
        sideB: c.sideB?.trim() || "",
        sources: normalizeSources(c.sources, toolSources),
      }))
      .filter((c) => c.sideA && c.sideB);

    if (whitespace.length === 0 && contradictions.length === 0) {
      throw new Error(
        "Research completed but found no clear whitespace or contradictions. Try different guidance."
      );
    }

    const ideaSeed = raw.ideaSeed?.trim() || "";
    const ideaText = buildIdeaText({
      topic,
      guidance,
      whitespace,
      contradictions,
      ideaSeed,
    });

    const seen = new Set<string>();
    const sources: ResearchSource[] = [];
    for (const s of [
      ...whitespace.flatMap((w) => w.sources),
      ...contradictions.flatMap((c) => c.sources),
      ...toolSources,
    ]) {
      if (!s.url || seen.has(s.url)) continue;
      seen.add(s.url);
      sources.push(s);
    }

    return {
      topic,
      guidance,
      whitespace,
      contradictions,
      sources,
      ideaText,
      searched: toolSources.length > 0 || sources.length > 0,
    };
  } catch (err) {
    throw new Error(cleanErrorMessage(err));
  }
}
