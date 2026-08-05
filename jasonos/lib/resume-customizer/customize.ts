// Resume Customizer — the AI analysis step. Runs the 14-point instruction
// prompt against the core resume + target JD and returns STRUCTURED output so
// we can (a) apply Before/After edits to the .docx and (b) render the report.

import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { heavyModel } from "@/lib/ai/models";
import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";
import { RESUME_CUSTOMIZER_SYSTEM_PROMPT } from "@/lib/resume-customizer/prompt";

export const resumeChangeSchema = z.object({
  priority: z.enum(["critical", "important", "optional"]),
  changeType: z.enum(["missing", "reposition", "reorder"]),
  section: z.string(),
  reason: z.string(),
  jobRequirement: z.string(),
  before: z.string(),
  after: z.string(),
});

export const resumeAnalysisSchema = z.object({
  company: z.string().describe("The hiring company named in the job description; 'the company' if unclear."),
  roleTitle: z.string().describe("The role/title from the job description, if present."),
  matchScore: z.number().int().min(1).max(100),
  assessment: z.enum(["strong_customization", "significant_rewrite"]),
  topKeywords: z
    .array(z.object({ keyword: z.string(), present: z.boolean() }))
    .describe("Top 20 keywords from the JD; present=true if already in the resume."),
  changes: z.array(resumeChangeSchema),
  summary: z.string().describe("A concise summary of the changes and overall fit."),
});

export type ResumeAnalysis = z.infer<typeof resumeAnalysisSchema>;
export type ResumeChange = z.infer<typeof resumeChangeSchema>;

/**
 * Strip "AI writing tells" from generated text so the tailored resume reads as
 * human-written. Hard rule (per requirements): NEVER emit em-dashes. Also
 * normalizes en-dashes, smart quotes, ellipsis, and non-breaking spaces to
 * plain punctuation. Applied to every model-produced string that can reach the
 * .docx or the report.
 */
export function stripAiTells(s: string): string {
  return s
    // Numeric ranges with an en-dash → hyphen (e.g. 2019–2024 → 2019-2024).
    .replace(/(\d)\s*[\u2013\u2014\u2015]\s*(\d)/g, "$1-$2")
    // Em / en / horizontal dashes used as punctuation → comma (human phrasing).
    .replace(/\s*[\u2014\u2015]\s*/g, ", ")
    .replace(/\s*\u2013\s*/g, ", ")
    // Smart quotes → straight quotes.
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    // Ellipsis → three dots; non-breaking / thin spaces → normal space.
    .replace(/\u2026/g, "...")
    .replace(/[\u00A0\u2009\u202F]/g, " ")
    // Tidy artifacts from the replacements above.
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sanitizeAnalysis(a: ResumeAnalysis): ResumeAnalysis {
  return {
    ...a,
    company: stripAiTells(a.company),
    roleTitle: stripAiTells(a.roleTitle),
    summary: stripAiTells(a.summary),
    // NOTE: `before` is left untouched — it must match the resume verbatim so
    // the edit can be located. Only `after` (what gets written) is sanitized.
    changes: a.changes.map((c) => ({
      ...c,
      section: stripAiTells(c.section),
      reason: stripAiTells(c.reason),
      jobRequirement: stripAiTells(c.jobRequirement),
      after: stripAiTells(c.after),
    })),
  };
}

export async function analyzeResume(input: {
  resumeText: string;
  resumeParagraphs: { index: number; text: string }[];
  jobDescription: string;
}): Promise<ResumeAnalysis> {
  const numbered = input.resumeParagraphs
    .map((p) => `[${p.index}] ${p.text}`)
    .join("\n");

  const system = `${RESUME_CUSTOMIZER_SYSTEM_PROMPT}

You are returning STRUCTURED data (not a document). Rules for the structured output:
- For every change, "before" MUST be the exact, verbatim text of ONE resume paragraph from the RESUME PARAGRAPHS list (copy it character-for-character) so the edit can be applied automatically. Use an empty "before" only for a genuinely new line to add.
- "after" must be truthful and paste-ready. Never invent experience, titles, employers, dates, credentials, or metrics not present in the resume — only reword, reposition, resurface, or reorder what genuinely exists.
- Use changeType "reorder" only to suggest moving an existing bullet; for reorder, set before/after to that bullet's exact text.
- STRATEGY — PRIORITIZED SUBSTITUTION (most important): This is a fixed-length document. You are not adding content; you are UPGRADING it in place. Rank the resume's existing wording by how relevant it is to THIS job description, then spend your edits replacing the LEAST job-relevant existing words/phrases with the MOST job-relevant ones (missing keywords, required skills, the role's terminology). Every edit is a swap: keep what already aligns, and trade out generic or off-target wording for language that maps directly to the JD's priorities. Focus first on the highest-impact bullets (summary, most recent role, core-competency lines).
- LENGTH / PAGE COUNT (hard constraint): The system automatically rejects any "after" that would wrap the paragraph onto an ADDITIONAL line, because that grows the page count. Each paragraph has a little trailing slack on its last line, you may use it, but do not exceed the paragraph's current number of lines. The safe way to guarantee this is to make each "after" the SAME LENGTH OR SHORTER than its "before": drop filler ("responsible for", "successfully", "in order to", redundant adjectives) to make room for the keyword you're swapping in. Never propose additions with an empty "before".
- NO AI WRITING TELLS (hard rule): NEVER use em-dashes (—) or en-dashes (–) anywhere in "after" text — use commas, periods, or hyphens instead. Use straight quotes (' and ") only, never curly quotes. No ellipsis characters. Avoid clichéd AI filler words (e.g. "delve", "leverage" as filler, "seamless", "robust", "moreover", "furthermore", "in today's landscape"). Write plainly, like a human executive wrote it.
- Provide up to 20 topKeywords.

${NO_AI_SLOP_WRITING_RULES}`;

  const prompt = `TARGET JOB DESCRIPTION:
${input.jobDescription}

CORE RESUME (full text):
${input.resumeText}

RESUME PARAGRAPHS (use the exact text as "before"):
${numbered}`;

  const { object } = await generateObject({
    model: heavyModel,
    schema: resumeAnalysisSchema,
    system,
    prompt,
    maxOutputTokens: 8000,
  });

  return sanitizeAnalysis(object);
}
