import { z } from "zod";

export const interviewPrepSourceSchema = z.object({
  title: z.string().nullable(),
  url: z.string(),
});

/** Schema sent to the model — sources are attached after web search, not invented. */
export const interviewPrepGeneratedSchema = z.object({
  company: z
    .string()
    .describe("Hiring company from the job description; 'the company' if unclear."),
  roleTitle: z
    .string()
    .describe("Role/title from the job description, if present."),
  framing: z
    .string()
    .describe(
      "2-4 sentence interview framing: who Jason is for this seat and the story arc to open with. No fluff."
    ),
  companyIntel: z
    .object({
      overview: z
        .string()
        .describe(
          "Short company brief (3-5 sentences) grounded ONLY in the provided research notes + JD. If research is thin, say what is known from the JD alone."
        ),
      points: z
        .array(
          z.object({
            fact: z
              .string()
              .describe(
                "Concrete company / market / news finding usable in the interview."
              ),
            howToUse: z
              .string()
              .describe(
                "How Jason should use it: a question to ask, a story to connect, or a risk to acknowledge."
              ),
          })
        )
        .describe(
          "4-6 interview-usable company points derived from the research notes."
        ),
    })
    .describe("Company research shaped for interview use."),
  backgroundQuestions: z
    .array(
      z.object({
        question: z.string().describe("Likely interviewer question about Jason's background."),
        why: z
          .string()
          .describe("Why this question is likely given the JD + resume."),
        angle: z
          .string()
          .describe(
            "What in the resume or background to lean on when answering. Concrete, not generic."
          ),
      })
    )
    .describe(
      "5-8 questions an interviewer would ask about strengths and experience that match the role."
    ),
  gapQuestions: z
    .array(
      z.object({
        question: z
          .string()
          .describe("Question probing something thin or missing vs the JD."),
        why: z
          .string()
          .describe("What the JD wants that looks light or absent on the resume."),
        angle: z
          .string()
          .describe(
            "Honest way to handle it: adjacent proof, transferable work, or how to frame the gap without inventing experience."
          ),
      })
    )
    .describe(
      "4-6 questions about gaps, missing keywords, thinner domains, or unproven requirements."
    ),
  highlights: z
    .array(
      z.object({
        point: z
          .string()
          .describe("Specific resume fact, win, or story to bring up unprompted."),
        why: z
          .string()
          .describe("Why this matters for THIS company/role."),
        whereOnResume: z
          .string()
          .describe("Where it lives on the resume (role, section, or bullet cue)."),
      })
    )
    .describe(
      "5-8 things Jason should proactively highlight based on company/role priorities."
    ),
});

export const interviewPrepSchema = interviewPrepGeneratedSchema.extend({
  sources: z.array(interviewPrepSourceSchema),
});

export type InterviewPrep = z.infer<typeof interviewPrepSchema>;

/** Looser parse for older saved preps that predate companyIntel/sources. */
export function coerceInterviewPrep(raw: unknown): InterviewPrep | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = interviewPrepSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const r = raw as Record<string, unknown>;
  const companyIntelRaw =
    r.companyIntel && typeof r.companyIntel === "object"
      ? (r.companyIntel as Record<string, unknown>)
      : null;

  const base = {
    company: typeof r.company === "string" ? r.company : "the company",
    roleTitle: typeof r.roleTitle === "string" ? r.roleTitle : "",
    framing: typeof r.framing === "string" ? r.framing : "",
    companyIntel: {
      overview:
        typeof companyIntelRaw?.overview === "string"
          ? companyIntelRaw.overview
          : "",
      points: Array.isArray(companyIntelRaw?.points)
        ? companyIntelRaw.points
        : [],
    },
    backgroundQuestions: Array.isArray(r.backgroundQuestions)
      ? r.backgroundQuestions
      : [],
    gapQuestions: Array.isArray(r.gapQuestions) ? r.gapQuestions : [],
    highlights: Array.isArray(r.highlights) ? r.highlights : [],
    sources: Array.isArray(r.sources) ? r.sources : [],
  };

  const retry = interviewPrepSchema.safeParse(base);
  return retry.success ? retry.data : null;
}
