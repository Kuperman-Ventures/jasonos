import "server-only";

import { gateway } from "@ai-sdk/gateway";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { getAnthropicModel } from "@/lib/post-machine/anthropic";
import type { ResearchFindings, ResearchSource } from "@/lib/post-machine/types";

const sourceSchema = z.object({
  title: z.string().nullable(),
  url: z.string(),
});

const researchSchema = z.object({
  whitespace: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string(),
        sources: z.array(sourceSchema),
      })
    )
    .max(3),
  contradictions: z
    .array(
      z.object({
        topic: z.string(),
        sideA: z.string(),
        sideB: z.string(),
        sources: z.array(sourceSchema),
      })
    )
    .max(3),
  ideaSeed: z.string(),
});

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

/**
 * Two-step research:
 * 1) web_search notes (tool use — prose is fine)
 * 2) structure those notes into JSON via generateObject (no tools)
 *
 * This avoids the failure mode where the model returns planning prose instead of JSON
 * after tool calls.
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

  const model = gateway(`anthropic/${getAnthropicModel().replace(/^anthropic\//, "")}`);

  const search = await generateText({
    model,
    tools: {
      web_search: anthropic.tools.webSearch_20250305({ maxUses: 6 }),
    },
    maxOutputTokens: 2500,
    system: `You are a research analyst for Jason Kuperman's Post Machine (NarrativeOS).
Use the web_search tool. Report ONLY what you actually find via search — never invent sources, quotes, or debates.

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

  const toolSources: ResearchSource[] = (search.sources ?? [])
    .map((s) => {
      const anyS = s as { url?: string; title?: string };
      return { title: anyS.title ?? null, url: anyS.url ?? "" };
    })
    .filter((s) => s.url.startsWith("http"));

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

  const { object } = await generateObject({
    model,
    schema: researchSchema,
    maxOutputTokens: 2500,
    system: `Convert research notes into the Post Machine findings schema.
Only use facts, claims, and URLs present in the notes or source list.
Prefer 2–3 whitespace items and 2–3 contradictions when the notes support them.
Every source URL must be a real http(s) URL from the notes/source list.
ideaSeed should be a sharp 2–4 sentence synthesis for a post angle.`,
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

  const whitespace = object.whitespace
    .slice(0, 3)
    .map((w) => ({
      title: w.title.trim() || "Whitespace angle",
      summary: w.summary.trim(),
      sources: normalizeSources(w.sources, toolSources),
    }))
    .filter((w) => w.summary);

  const contradictions = object.contradictions
    .slice(0, 3)
    .map((c) => ({
      topic: c.topic.trim() || "Contradiction",
      sideA: c.sideA.trim(),
      sideB: c.sideB.trim(),
      sources: normalizeSources(c.sources, toolSources),
    }))
    .filter((c) => c.sideA && c.sideB);

  if (whitespace.length === 0 && contradictions.length === 0) {
    throw new Error(
      "Research completed but found no clear whitespace or contradictions. Try different guidance."
    );
  }

  const ideaSeed = object.ideaSeed.trim();
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
}
