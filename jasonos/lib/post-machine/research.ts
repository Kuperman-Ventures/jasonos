import "server-only";

import { gateway } from "@ai-sdk/gateway";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { getAnthropicModel } from "@/lib/post-machine/anthropic";
import type { ResearchFindings, ResearchSource } from "@/lib/post-machine/types";

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

function normalizeSources(
  sources: { title?: string | null; url?: string }[] | undefined,
  fallback: ResearchSource[]
): ResearchSource[] {
  const fromModel = (sources ?? [])
    .map((s) => ({
      title: s.title?.trim() || null,
      url: s.url?.trim() || "",
    }))
    .filter((s) => s.url.startsWith("http"));

  if (fromModel.length > 0) return fromModel;

  // If the model omitted per-item URLs, attach the strongest tool sources we have.
  return fallback.slice(0, 2);
}

function buildIdeaText(input: {
  topic: string;
  guidance: string;
  whitespace: ResearchFindings["whitespace"];
  contradictions: ResearchFindings["contradictions"];
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
    "Use this brief as the core idea for hooks and drafts. Prefer the sharpest whitespace or contradiction. Do not invent sources or stats beyond what is in this brief; use [X] placeholders if a number is implied but not sourced.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * Isolation-friendly research call: web_search via AI Gateway, structured findings
 * shaped so `ideaText` can drop straight into /api/post-machine/hooks.
 */
export async function runPostMachineResearch(input: {
  topic: string;
  guidance: string;
}): Promise<ResearchFindings> {
  const topic = input.topic.trim();
  const guidance = input.guidance.trim();
  if (!topic) {
    throw new Error("Topic is required.");
  }

  const modelId = getAnthropicModel().replace(/^anthropic\//, "");
  const system = `You are a research analyst for Jason Kuperman's Post Machine (NarrativeOS).
Use the web_search tool. Report ONLY what you actually find via search — never invent sources, quotes, or debates.

Your job:
1) Find 2–3 areas of genuine whitespace or under-discussed angles on the topic (not the most obvious LinkedIn takes).
2) Find 2–3 points where credible voices contradict each other — name the tension clearly, with source URLs.

Prefer recent, credible sources (operators, serious analysts, primary reporting). Skip generic SEO listicles when better sources exist.

After searching, return ONLY valid JSON (no markdown fences) in this shape:
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
  "ideaSeed": "optional 2–4 sentence synthesis of the sharpest angle for a post"
}`;

  const prompt = `Topic: ${topic}
${guidance ? `Guidance / angle to explore: ${guidance}` : "Guidance: find the least-obvious, most operator-relevant angles."}

Search the web, then return the JSON findings.`;

  const result = await generateText({
    model: gateway(`anthropic/${modelId}`),
    tools: {
      web_search: anthropic.tools.webSearch_20250305({ maxUses: 6 }),
    },
    maxOutputTokens: 3500,
    system,
    prompt,
    providerOptions: {
      anthropic: {
        thinking: { type: "disabled" },
      },
    },
  });

  const toolSources: ResearchSource[] = (result.sources ?? [])
    .map((s) => {
      const anyS = s as { url?: string; title?: string };
      return { title: anyS.title ?? null, url: anyS.url ?? "" };
    })
    .filter((s) => s.url.startsWith("http"));

  const text = stripFences(result.text.trim());
  if (!text) {
    throw new Error(
      toolSources.length === 0
        ? "Web search returned no usable findings. Try a sharper topic or guidance."
        : "Model searched the web but returned an empty summary."
    );
  }

  let raw: RawResearch;
  try {
    raw = JSON.parse(text) as RawResearch;
  } catch {
    throw new Error(
      `Research returned non-JSON output: ${text.slice(0, 240)}`
    );
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

  const ideaText =
    raw.ideaSeed?.trim()
      ? [
          buildIdeaText({ topic, guidance, whitespace, contradictions }),
          "",
          `Sharpest synthesis: ${raw.ideaSeed.trim()}`,
        ].join("\n")
      : buildIdeaText({ topic, guidance, whitespace, contradictions });

  // Dedup flat source list for the UI.
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
}
