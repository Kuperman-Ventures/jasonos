// Interview Prep — analyze a tailored resume + its job description and
// return structured talking points for the interview.

import "server-only";
import { generateObject } from "ai";
import { hasDirectAnthropicKey, heavyModel } from "@/lib/ai/models";
import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";
import { stripAiTells } from "@/lib/resume-customizer/customize";
import {
  interviewPrepGeneratedSchema,
  type InterviewPrep,
} from "@/lib/interview-prep/types";

export type { InterviewPrep };

function sanitize(prep: InterviewPrep): InterviewPrep {
  return {
    company: stripAiTells(prep.company),
    roleTitle: stripAiTells(prep.roleTitle),
    framing: stripAiTells(prep.framing),
    companyIntel: {
      overview: stripAiTells(prep.companyIntel?.overview ?? ""),
      points: (prep.companyIntel?.points ?? []).map((p) => ({
        fact: stripAiTells(p.fact),
        howToUse: stripAiTells(p.howToUse),
      })),
    },
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
    sources: (prep.sources ?? []).map((s) => ({
      title: s.title ? stripAiTells(s.title) : null,
      url: s.url,
    })),
  };
}

const SYSTEM = `You are Jason Kuperman's interview-prep coach inside JasonOS.

Jason is preparing for an interview for a specific role. You are given:
1) The job description he customized a resume for
2) The tailored resume text that was submitted (or prepared) for that role
3) Optional prior resume-customizer analysis notes
4) COMPANY RESEARCH NOTES from a live web search (may be thin or unavailable)

Your job is to produce a sharp, practical prep brief — not generic interview advice.

Output sections (in this order of importance):
0) companyIntel — reshape the research notes into an interview brief: a short overview plus concrete points with how Jason should use each one in the conversation. Ground ONLY in the research notes + JD. Do not invent company news. If research is thin, keep overview honest and short.
1) framing — tight open for who Jason is for this seat.
2) backgroundQuestions — questions about his real background the interviewer is likely to dig into because they map to the JD.
3) gapQuestions — places where the JD asks for something that looks thin, missing, or differently labeled on the resume. Honest handling angles. NEVER invent experience, titles, employers, metrics, or credentials that are not in the resume.
4) highlights — concrete resume points he should actively bring up and connect to this company/role.
5) Do not invent source URLs.

Rules:
- Be specific to THIS JD, THIS resume, and THIS company's research notes.
- Prefer operator language: blunt, concrete, short.
- Do not invent facts. If something is missing, say so and coach the frame.
- Questions should sound like a real interviewer, not a textbook.
- framing should be a tight open for the conversation, not a cover letter.

${NO_AI_SLOP_WRITING_RULES}`;

export async function analyzeInterviewPrep(input: {
  jobDescription: string;
  resumeText: string;
  companyHint?: string | null;
  roleHint?: string | null;
  analysisSummary?: string | null;
  companyResearchText?: string | null;
  sources?: { title: string | null; url: string }[];
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

  const researchBlock = input.companyResearchText?.trim()
    ? `COMPANY RESEARCH NOTES (from live web search — treat as the only source of company news; do not invent beyond this):\n${input.companyResearchText.trim()}`
    : `COMPANY RESEARCH NOTES:\n(No usable web research. Rely on the job description for company context.)`;

  const prompt = `${hintLines ? `${hintLines}\n\n` : ""}${researchBlock}

TARGET JOB DESCRIPTION:
${input.jobDescription}

TAILORED RESUME (submitted / prepared for this role):
${input.resumeText}`;

  try {
    const { object } = await generateObject({
      model: heavyModel(),
      schema: interviewPrepGeneratedSchema,
      system: SYSTEM,
      prompt,
      maxOutputTokens: 7000,
      providerOptions: hasDirectAnthropicKey()
        ? { anthropic: { thinking: { type: "disabled" } } }
        : undefined,
    });
    const cleaned = sanitize({
      ...object,
      companyIntel: object.companyIntel ?? { overview: "", points: [] },
      sources: [],
    });
    return {
      ...cleaned,
      sources: (input.sources ?? []).slice(0, 12),
    };
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
