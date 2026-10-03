import {
  activityIconPromptList,
  parseActivityIconReply,
  pickActivityIcon,
  type ActivityIconId,
  type ActivityIconInput,
} from "./activity-icons";

export async function suggestActivityIcon(input: ActivityIconInput): Promise<ActivityIconId> {
  const fallback = pickActivityIcon(input);
  const { aiGatewayAvailable } = await import("./ai-model");
  if (!(await aiGatewayAvailable())) return fallback;

  try {
    const { generateText } = await import("ai");
    const {
      FREE_FALLBACK_COLLEGE_AI_MODEL,
      isGatewayModelAccessError,
      resolveCollegeModel,
    } = await import("./ai-model");

    const run = async (modelOverride?: string | null) => {
      const model = await resolveCollegeModel(modelOverride);
      return generateText({
        model,
        maxOutputTokens: 80,
        system: `You pick one Phosphor icon for a high-school activity in Kyle's college portal.
Icons are duotone line marks in the product's orange accent. Never invent an icon name.
Return ONLY JSON: {"icon":"SoccerBall"}
icon must be exactly one of: ${activityIconPromptList()}
Prefer the most specific object or action in the activity name. Category is a hint when the name is vague.`,
        prompt: `Activity: ${input.name?.trim() || "(unnamed)"}
Category: ${input.category || "other"}
Organization: ${input.organization?.trim() || "(none)"}
A reasonable fallback is ${fallback}. Only pick a different icon if it is clearly a better match.`,
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
    return parseActivityIconReply(result.text ?? "") ?? fallback;
  } catch {
    return fallback;
  }
}
