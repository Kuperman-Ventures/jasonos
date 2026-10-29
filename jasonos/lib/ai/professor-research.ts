import "server-only";

import { anthropic } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import {
  generateObject,
  generateText,
  stepCountIs,
  type LanguageModel,
  type ToolSet,
} from "ai";
import { z } from "zod";
import { JASON_IDENTITY } from "@/lib/ai/jason-identity";
import { hasDirectAnthropicKey, heavyModel } from "@/lib/ai/models";
import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";
import {
  cleanResearchBrief,
  collectResearchSources,
  type ResearchResult,
} from "@/lib/ai/research";
import { stripEmDashes } from "@/lib/email-templates/render";
import {
  inferRoleKind,
  type ProfessorDecision,
  type ProfessorQuestion,
  type ProfessorRoadmap,
  type RoleKind,
} from "@/lib/professor-roadmap/types";

function cleanErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Research failed.";
  return raw.replace(/\u001b\[[0-9;]*m/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Web search needs a tool the active model provider supports.
 * Direct Anthropic: native web_search. Gateway: Perplexity (matches research.ts).
 */
function searchSetup(): {
  model: LanguageModel;
  tools: ToolSet;
  toolHint: string;
} {
  if (hasDirectAnthropicKey()) {
    return {
      model: heavyModel(),
      tools: {
        web_search: anthropic.tools.webSearch_20250305({ maxUses: 6 }),
      },
      toolHint: "web_search",
    };
  }
  const id = (process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6").replace(
    /^anthropic\//,
    ""
  );
  return {
    model: gateway(`anthropic/${id}`),
    tools: {
      perplexity_search: gateway.tools.perplexitySearch({
        maxResults: 8,
        searchLanguageFilter: ["en"],
        country: "US",
      }),
    },
    toolHint: "perplexity_search",
  };
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

async function searchBackedBrief(input: {
  system: string;
  prompt: string;
  emptyMessage: string;
}): Promise<ResearchResult> {
  const setup = searchSetup();
  const system = input.system.replaceAll("perplexity_search", setup.toolHint);
  try {
    const result = await generateText({
      model: setup.model,
      tools: setup.tools,
      stopWhen: stepCountIs(6),
      maxOutputTokens: 1600,
      system,
      prompt: input.prompt,
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
        text: input.emptyMessage,
        sources: [],
        searched: false,
      };
    }

    if (!cleaned && sources.length === 0) {
      throw new Error(
        "Web search returned no usable findings. Try again in a moment."
      );
    }

    return {
      text:
        cleaned ||
        "Search completed but produced no summary. See sources below if listed.",
      sources,
      searched: sources.length > 0,
    };
  } catch (err) {
    throw new Error(cleanErrorMessage(err));
  }
}

export async function researchQuestion(input: {
  question: string;
  whyItMatters: string;
  school: {
    name: string;
    businessSchool: string;
    department: string;
    website: string;
  };
}): Promise<ResearchResult> {
  const schoolLabel = [
    input.school.name,
    input.school.businessSchool,
    input.school.department,
  ]
    .filter(Boolean)
    .join(" / ");

  const system = `You research adjunct and faculty hiring questions for one school. Use the perplexity_search tool. Search for this school specifically first, then AACSB norms as a fallback. Report only what was found. Never invent policy.

OUTPUT FORMAT (hard):
- 3 to 8 markdown bullets. Each line starts with "- ".
- Each bullet ends with a source name in parentheses or after an em dash.
- Mark anything that is a general AACSB or industry norm rather than this school's stated policy with the prefix "General norm:".
- End with exactly one line starting "Still needs a person:" naming who at the school could confirm it, or "No person needed." if the finding is conclusive.
- No narration. No tool_call XML. No "I'll search" prose.`;

  const prompt = `School: ${schoolLabel}
Website: ${input.school.website || "(none)"}

Question: ${input.question}

Why it matters: ${input.whyItMatters}

Research this question for this school. Prefer school pages, faculty handbook, AACSB faculty qualification standards, and job postings.`;

  return searchBackedBrief({
    system,
    prompt,
    emptyMessage: [
      `No usable public finding for this question at ${input.school.name}.`,
      "Still needs a person: Department chair or program coordinator.",
    ].join("\n\n"),
  });
}

const schoolExtractSchema = z.object({
  people: z.array(
    z.object({
      name: z.string(),
      title: z.string().default(""),
      role_kind: z
        .enum(["chair", "faculty", "practitioner", "admin", "other"])
        .optional(),
      profile_url: z.string().default(""),
    })
  ),
  postings: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      department: z.string().default(""),
      degree_required: z.string().default(""),
    })
  ),
});

export async function researchSchoolBrief(input: {
  name: string;
  businessSchool: string;
  department: string;
  facultyUrl: string;
  jobsUrl: string;
}): Promise<{
  brief: ResearchResult;
  people: Array<{
    name: string;
    title: string;
    role_kind: RoleKind;
    profile_url: string;
  }>;
  postings: Array<{
    title: string;
    url: string;
    department: string;
    degree_required: string;
  }>;
}> {
  const schoolLabel = [input.name, input.businessSchool, input.department]
    .filter(Boolean)
    .join(" / ");

  const system = `You research a business-school marketing department for someone considering adjunct teaching. Use the perplexity_search tool. Report only what was found.

Cover:
- marketing programs offered
- size of the department if stated
- how adjuncts, instructors, or lecturers appear on the faculty page
- executive education or guest lecture programs
- any current adjunct or instructor postings

OUTPUT: concise markdown (short paragraphs or bullets). Cite source names. No narration. No tool_call XML.`;

  const prompt = `School: ${schoolLabel}
Faculty page: ${input.facultyUrl || "(none)"}
Jobs page: ${input.jobsUrl || "(none)"}

Write a brief on the marketing department and adjunct path.`;

  const brief = await searchBackedBrief({
    system,
    prompt,
    emptyMessage: `No usable public brief found for ${input.name}. Check the faculty and jobs URLs directly.`,
  });

  const extractPrompt = `Extract people and job postings from this school research brief and the search notes.

Brief:
${brief.text}

Sources:
${brief.sources.map((s) => `- ${s.title ?? s.url}: ${s.url}`).join("\n") || "(none)"}

Faculty URL: ${input.facultyUrl}
Jobs URL: ${input.jobsUrl}

role_kind rules from title:
- contains Chair → chair
- Instructor, Lecturer, Professor of Practice, Adjunct, Executive in Residence → practitioner
- Dean, Coordinator, Director without a professor rank → admin
- otherwise faculty

Only include people and postings you can support from the brief or sources. Prefer real profile/job URLs when present.`;

  try {
    const { object } = await generateObject({
      model: heavyModel(),
      schema: schoolExtractSchema,
      prompt: extractPrompt,
      maxOutputTokens: 1200,
      providerOptions: {
        anthropic: {
          thinking: { type: "disabled" },
        },
      },
    });

    const people = object.people
      .map((p) => {
        const name = p.name.trim();
        const title = (p.title ?? "").trim();
        if (!name) return null;
        return {
          name,
          title,
          role_kind: (p.role_kind as RoleKind | undefined) ?? inferRoleKind(title),
          profile_url: (p.profile_url ?? "").trim(),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    const postings = object.postings
      .map((p) => {
        const title = p.title.trim();
        const url = p.url.trim();
        if (!title || !url || !/^https?:\/\//i.test(url)) return null;
        return {
          title,
          url,
          department: (p.department ?? "").trim(),
          degree_required: (p.degree_required ?? "").trim(),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    return { brief, people, postings };
  } catch (err) {
    console.error("[professor-research] extract failed", err);
    return { brief, people: [], postings: [] };
  }
}

const nextStepsSchema = z.object({
  // Anthropic structured output rejects array minItems other than 0 or 1.
  steps: z.array(
    z.object({
      text: z.string(),
      rationale: z.string(),
      question_id: z.string().uuid().optional().nullable(),
      decision_id: z.string().uuid().optional().nullable(),
      school_id: z.string().uuid().optional().nullable(),
    })
  ),
});

export async function proposeNextSteps(input: {
  roadmap: ProfessorRoadmap;
}): Promise<
  Array<{
    text: string;
    rationale: string;
    question_id?: string | null;
    decision_id?: string | null;
    school_id?: string | null;
  }>
> {
  const { roadmap } = input;
  const payload = {
    schools: roadmap.schools.map((s) => ({
      id: s.id,
      name: s.name,
      isPrimary: s.isPrimary,
      briefRefreshedAt: s.briefRefreshedAt,
      people: s.people.map((p) => ({
        name: p.name,
        title: p.title,
        roleKind: p.roleKind,
      })),
    })),
    questions: roadmap.questions.map((q) => ({
      id: q.id,
      sortOrder: q.sortOrder,
      question: q.question,
      status: q.status,
      findingMd: q.findingMd.slice(0, 1200),
    })),
    decisions: roadmap.decisions.map((d) => ({
      id: d.id,
      sortOrder: d.sortOrder,
      title: d.title,
      status: d.status,
      dependsOnQuestionIds: d.dependsOnQuestionIds,
      proposedOption: d.proposedOption,
      decidedOption: d.decidedOption,
    })),
    openNextSteps: roadmap.nextSteps
      .filter((s) => s.status === "open" && !s.generated)
      .map((s) => ({ text: s.text, rationale: s.rationale })),
  };

  const system = `${JASON_IDENTITY}

${NO_AI_SLOP_WRITING_RULES}

You propose the next 3 to 5 concrete steps for Jason's professor path.
Rules:
- Every step must resolve an open question, act on a researched question's "Still needs a person:" line, or move a decision whose dependent questions are all researched or confirmed.
- Prefer steps that take one conversation or one document over steps that take a semester.
- Never propose a degree program as a step unless decision 2 ("Master's gap plan") is already decided that way.
- No web search. Use only the roadmap JSON.
- Return JSON only matching the schema.`;

  const { object } = await generateObject({
    model: heavyModel(),
    schema: nextStepsSchema,
    system,
    prompt: `Professor roadmap state:\n${JSON.stringify(payload)}`,
    maxOutputTokens: 1200,
    providerOptions: {
      anthropic: {
        thinking: { type: "disabled" },
      },
    },
  });

  const steps = object.steps
    .map((step) => ({
      text: stripEmDashes(step.text.trim()),
      rationale: stripEmDashes((step.rationale ?? "").trim()),
      question_id: step.question_id ?? null,
      decision_id: step.decision_id ?? null,
      school_id: step.school_id ?? null,
    }))
    .filter((step) => step.text.length > 0)
    .slice(0, 5);

  if (steps.length < 3) {
    throw new Error("Model returned fewer than 3 next steps. Try again.");
  }
  return steps;
}

const decisionProposalSchema = z.object({
  option: z.string(),
  rationale_md: z.string(),
});

export async function proposeDecision(input: {
  decision: ProfessorDecision;
  questions: ProfessorQuestion[];
}): Promise<{ option: string; rationale_md: string }> {
  const deps = input.decision.dependsOnQuestionIds;
  const related = input.questions.filter((q) => deps.includes(q.id));
  const unfinished = related.filter(
    (q) => q.status !== "researched" && q.status !== "confirmed"
  );
  if (unfinished.length > 0) {
    throw new Error(
      `Research questions ${unfinished.map((q) => q.sortOrder).join(", ")} first.`
    );
  }

  const system = `${JASON_IDENTITY}

${NO_AI_SLOP_WRITING_RULES}

Propose one option for this decision. Rationale is 3 to 6 sentences citing the specific findings from the dependent questions. Pick only from the listed options. No web search.`;

  const { object } = await generateObject({
    model: heavyModel(),
    schema: decisionProposalSchema,
    system,
    prompt: JSON.stringify({
      decision: {
        title: input.decision.title,
        whyItMatters: input.decision.whyItMatters,
        options: input.decision.options,
      },
      questions: related.map((q) => ({
        sortOrder: q.sortOrder,
        question: q.question,
        status: q.status,
        findingMd: q.findingMd,
        confirmedBy: q.confirmedBy,
      })),
    }),
    maxOutputTokens: 900,
    providerOptions: {
      anthropic: {
        thinking: { type: "disabled" },
      },
    },
  });

  const optionNames = input.decision.options.map((o) => o.name);
  const option =
    optionNames.find((name) => name === object.option.trim()) ??
    optionNames.find((name) =>
      object.option.toLowerCase().includes(name.toLowerCase().slice(0, 24))
    ) ??
    object.option.trim();

  return {
    option,
    rationale_md: stripEmDashes(object.rationale_md.trim()),
  };
}
