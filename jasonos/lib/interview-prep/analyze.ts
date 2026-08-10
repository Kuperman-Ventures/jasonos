// Interview Prep — analyze a tailored resume + its job description and
// return structured talking points for the interview.

import "server-only";
import { generateObject } from "ai";
import { hasDirectAnthropicKey, heavyModel } from "@/lib/ai/models";
import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";
import { stripAiTells } from "@/lib/resume-customizer/customize";
import {
  interviewPrepSchema,
  type InterviewPrep,
} from "@/lib/interview-prep/types";

export type { InterviewPrep };

function sanitize(prep: InterviewPrep): InterviewPrep {
  return {
    company: stripAiTells(prep.company),
    roleTitle: stripAiTells(prep.roleTitle),
    framing: stripAiTells(prep.framing),
    backgroundQuestions: prep.backgroundQuestions.map((q) => ({
      question: stripAiTells(q.question),
      why: stripAiTells(q.why),
      angle: stripAiTells(q.angle),
    })),
    gapQuestions: prep.gapQuestions.map((q) => ({
      question: stripAiTells(q.question),
      why: stripAiTells(q.why),
      angle: stripAiTells(q.angle),
    })),
    highlights: prep.highlights.map((h) => ({
      point: stripAiTells(h.point),
      why: stripAiTells(h.why),
      whereOnResume: stripAiTells(h.whereOnResume),
    })),
  };
}

const SYSTEM = `You are Jason Kuperman's interview-prep coach inside JasonOS.

Jason is preparing for an interview for a specific role. You are given:
1) The job description he customized a resume for
2) The tailored resume text that was submitted (or prepared) for that role
3) Optional prior resume-customizer analysis notes

Your job is to produce sharp, practical prep — not generic interview advice.

Produce three buckets:
A) backgroundQuestions — questions about his real background the interviewer is likely to dig into because they map to the JD. Help him know which stories to rehearse.
B) gapQuestions — places where the JD asks for something that looks thin, missing, or differently labeled on the resume. Interviewers will probe these. Give honest handling angles. NEVER invent experience, titles, employers, metrics, or credentials that are not in the resume.
C) highlights — concrete things on the resume he should actively bring up and connect to this company/role, even if not asked directly.

Rules:
- Be specific to THIS JD and THIS resume. Name companies, roles, domains, and bullets when they exist.
- Prefer operator language: blunt, concrete, short.
- Do not invent facts. If something is missing, say so and coach the frame — do not fabricate a backfill.
- Questions should sound like a real interviewer, not a textbook.
- framing should be a tight open for the conversation, not a cover letter.

${NO_AI_SLOP_WRITING_RULES}`;

export async function analyzeInterviewPrep(input: {
  jobDescription: string;
  resumeText: string;
  companyHint?: string | null;
  roleHint?: string | null;
  analysisSummary?: string | null;
}): Promise<InterviewPrep> {
  const hintLines = [
    input.companyHint ? `Known company: ${input.companyHint}` : null,
    input.roleHint ? `Known role: ${input.roleHint}` : null,
    input.analysisSummary
      ? `Prior customizer notes:\n${input.analysisSummary}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `${hintLines ? `${hintLines}\n\n` : ""}TARGET JOB DESCRIPTION:
${input.jobDescription}

TAILORED RESUME (submitted / prepared for this role):
${input.resumeText}`;

  try {
    const { object } = await generateObject({
      model: heavyModel(),
      schema: interviewPrepSchema,
      system: SYSTEM,
      prompt,
      maxOutputTokens: 6000,
      providerOptions: hasDirectAnthropicKey()
        ? { anthropic: { thinking: { type: "disabled" } } }
        : undefined,
    });
    return sanitize(object);
  } catch (err) {
    throw new Error(cleanAiError(err));
  }
}

function cleanAiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "unknown error";
  const message = raw.replace(/\u001b\[[0-9;]*m/g, "").replace(/\s+/g, " ").trim();
  if (
    !hasDirectAnthropicKey() &&
    /credit balance|top-up|insufficient funds/i.test(message)
  ) {
    return `${message} Set ANTHROPIC_API_KEY on Vercel to call Anthropic directly, or top up AI Gateway credits.`;
  }
  return message;
}
