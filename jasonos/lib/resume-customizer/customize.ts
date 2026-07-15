// Resume Customizer — the AI analysis step. Runs the 14-point instruction
// prompt against the core resume + target JD and returns STRUCTURED output so
// we can (a) apply Before/After edits to the .docx and (b) render the report.

import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { heavyModel } from "@/lib/ai/models";
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
- LENGTH / PAGE COUNT (hard constraint): The system automatically rejects any "after" that would wrap the paragraph onto an ADDITIONAL line, because that grows the page count. Each paragraph has a little trailing slack on its last line — you may use it, but do not exceed the paragraph's current number of lines. The safe way to guarantee this is to make each "after" the SAME LENGTH OR SHORTER than its "before": drop filler ("responsible for", "successfully", "in order to", redundant adjectives) to make room for the keyword you're swapping in. Never propose additions with an empty "before".
- Provide up to 20 topKeywords.`;

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

  return object;
}
