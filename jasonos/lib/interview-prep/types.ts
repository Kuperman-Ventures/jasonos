import { z } from "zod";

export const interviewPrepSchema = z.object({
  company: z
    .string()
    .describe("Hiring company from the job description; 'the company' if unclear."),
  roleTitle: z
    .string()
    .describe("Role/title from the job description, if present."),
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
  framing: z
    .string()
    .describe(
      "2-4 sentence interview framing: who Jason is for this seat and the story arc to open with. No fluff."
    ),
});

export type InterviewPrep = z.infer<typeof interviewPrepSchema>;
