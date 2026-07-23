// Cover Letter Customizer — generates a tailored cover letter from the SAME
// context used to customize the resume (the target job description + the core
// resume), so the letter is skewed to the opportunity and Jason's background.
// Structure follows Jason's cover-letter sample (opening hook, background
// paragraph, four highlight bullets, closing with a concrete ask).

import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { heavyModel } from "@/lib/ai/models";
import { JASON_IDENTITY } from "@/lib/ai/jason-identity";
import { stripAiTells } from "@/lib/resume-customizer/customize";

// Jason's letterhead / signature block (from his cover-letter template).
export const JASON_LETTERHEAD = {
  name: "Jason Kuperman",
  location: "Greater New York City Area",
  phone: "862.400.1149",
  email: "jason.kuperman@outlook.com",
  linkedin: "www.linkedin.com/in/kuperman",
};

export const coverLetterSchema = z.object({
  salutation: z
    .string()
    .describe(
      'Greeting line, e.g. "Dear Hiring Committee:" — use a specific hiring manager only if the JD names one; otherwise "Dear Hiring Committee:".'
    ),
  opening: z
    .string()
    .describe(
      "Paragraph one, 2-3 sentences MAX: a catchy hook (often a question) that matches what the role is looking for, a statement of strong candidacy, and a fact showing research about the company."
    ),
  background: z
    .string()
    .describe(
      "Paragraph two, 3-4 sentences MAX: briefly frame Jason's professional background, matching the role's most significant requirements to his real skills and accomplishments."
    ),
  highlights: z
    .array(z.string())
    .min(3)
    .max(4)
    .describe(
      "Exactly 4 career highlight bullets. Each MUST be a single line (~15-20 words, no semicolons or sub-clauses): one concrete, truthful accomplishment from Jason's background mapped to this role's priorities."
    ),
  closing: z
    .string()
    .describe(
      "Paragraph three, 2-3 sentences MAX: thank them for reviewing, reinforce enthusiasm, tie his abilities to their needs, and invite a conversation (a concrete ask)."
    ),
});

export type CoverLetterContent = z.infer<typeof coverLetterSchema>;

const SYSTEM = `You are writing an executive cover letter for Jason Kuperman, tailored to a specific job. Use the target job description and Jason's resume as the source of truth. Skew the letter to the opportunity and to Jason's real background.

${JASON_IDENTITY}

STRUCTURE (follow it):
- Salutation: "Dear Hiring Committee:" unless the JD names a hiring manager.
- Paragraph one (opening): a catchy hook, often a question, that maps to what the role is searching for; state that Jason is a strong candidate; include one concrete detail showing research about the company.
- Paragraph two (background): briefly describe Jason's professional background, focusing on the skills, activities, and accomplishments that match the role's most significant requirements. Match their stated needs to his experience so the fit is obvious.
- Highlights: 4 bullet points of Jason's most relevant career contributions/achievements for THIS role.
- Paragraph three (closing): thank them for reviewing, reinforce enthusiasm, connect his abilities to their current needs, and end with a concrete invitation to talk.

RULES:
- Truthful only: use accomplishments, roles, metrics, and employers that actually appear in Jason's resume/identity. Never invent numbers, titles, employers, or credentials.
- Voice: Jason's direct, anti-fluff, metric-driven "Architect" voice. Short sentences. No filler greetings ("I hope this finds you well", "circling back", "touching base"). No exclamation points.
- NO AI WRITING TELLS: never use em-dashes or en-dashes (use commas, periods, or hyphens). Straight quotes only, no curly quotes, no ellipsis characters. Avoid clichés ("delve", "leverage" as filler, "seamless", "robust", "moreover", "furthermore", "in today's landscape").
- ONE PAGE — HARD LIMIT: the entire letter (letterhead + date + Re + salutation + opening + background + 4 bullets + closing + sign-off) MUST fit on a single US-Letter page. Budget strictly: opening 2-3 sentences; background 3-4 sentences; exactly 4 bullets, each ONE line (~15-20 words, no semicolons or sub-clauses); closing 2-3 sentences. Keep the whole body under ~300 words. Prefer fewer, sharper sentences over more. Cut any sentence that does not directly prove fit.`;

function clean(s: string): string {
  return stripAiTells(s ?? "");
}

export async function generateCoverLetterContent(input: {
  resumeText: string;
  jobDescription: string;
  company: string;
  roleTitle: string;
  analysisSummary?: string;
}): Promise<CoverLetterContent> {
  const prompt = `TARGET COMPANY: ${input.company}
TARGET ROLE: ${input.roleTitle || "(role in the job description)"}

TARGET JOB DESCRIPTION:
${input.jobDescription}

JASON'S RESUME (source of truth for accomplishments):
${input.resumeText}
${
  input.analysisSummary
    ? `\nRESUME↔JOB FIT NOTES (from the resume customization):\n${input.analysisSummary}`
    : ""
}`;

  const { object } = await generateObject({
    model: heavyModel,
    schema: coverLetterSchema,
    system: SYSTEM,
    prompt,
    maxOutputTokens: 3000,
  });

  return {
    salutation: clean(object.salutation),
    opening: clean(object.opening),
    background: clean(object.background),
    highlights: object.highlights.slice(0, 4).map(clean).filter(Boolean),
    closing: clean(object.closing),
  };
}
