/** One-sentence explanation for a timeline stage or to-do. Cached by the caller. */

import { clampBlurb, fallbackBlurb } from "@/lib/nudge";

export async function generateNudgeBlurb(title: string, context: string): Promise<string> {
  const fallback = fallbackBlurb(title);
  const { aiGatewayAvailable } = await import("./ai-model");
  if (!(await aiGatewayAvailable())) return fallback;

  try {
    const { generateText } = await import("ai");
    const { FREE_FALLBACK_COLLEGE_AI_MODEL, isGatewayModelAccessError, resolveCollegeModel } =
      await import("./ai-model");

    const run = async (modelOverride?: string | null) => {
      const model = await resolveCollegeModel(modelOverride);
      return generateText({
        model,
        maxOutputTokens: 80,
        system: `You write one sentence for a family college-planning reminder email.
Say what the item is, why it helps, and one calm line of encouragement.
Tone: specific, no pressure. No exclamation marks. No emoji. 25 words maximum.
Return only the sentence.`,
        prompt: `Item: ${title.trim() || "(untitled)"}
Context: ${context.trim() || "(none)"}`,
      });
    };

    let result;
    try {
      result = await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isGatewayModelAccessError(message)) result = await run(FREE_FALLBACK_COLLEGE_AI_MODEL);
      else throw error;
    }
    return clampBlurb(result.text ?? "") || fallback;
  } catch {
    return fallback;
  }
}
