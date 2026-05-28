// Centralized model selection for JasonOS.
// Routes through the Vercel AI Gateway so we get observability + cost
// tracking and can swap providers without code changes.
//
// On Vercel deploys an OIDC token is auto-injected and AI_GATEWAY_API_KEY
// is not needed; for local dev set AI_GATEWAY_API_KEY in .env.local.
import { gateway } from "@ai-sdk/gateway";
import { generateText } from "ai";

// Heavy reasoning — used by the Best-Next-Action engine once per morning.
// Sonnet 4.6 — temporary downgrade from Opus until Vercel AI Gateway paid
// credits are enabled on the kuperman-ventures team (Opus 4-7 returns 403
// RestrictedModelsError on the free tier).
export const heavyModel = gateway("anthropic/claude-sonnet-4-6");

// Fast / cheap — used by the always-on "Tell Claude" command bar and
// Goal→Plan refinements.
export const fastModel = gateway("anthropic/claude-sonnet-4-6");

export async function callClaude(input: {
  model: string;
  maxTokens: number;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  const { text } = await generateText({
    model: gateway(`anthropic/${input.model}`),
    maxOutputTokens: input.maxTokens,
    system: input.system,
    messages: input.messages,
  });
  return text;
}
