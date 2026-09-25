/**
 * College AI model selection via Vercel AI Gateway.
 *
 * Claude Sonnet is paid-tier only on AI Gateway. This app defaults to a
 * free-tier model so ingest and school lookup work without topping up credits.
 * Override with EXTRACTION_MODEL / COLLEGE_AI_MODEL when the team has paid access.
 */

import type { LanguageModel } from "ai";

/** Free-tier capable default — strong enough for structured JSON extraction. */
export const DEFAULT_COLLEGE_AI_MODEL = "google/gemini-2.5-flash";

/** Always-$0 fallback when the preferred model is blocked on free tier. */
export const FREE_FALLBACK_COLLEGE_AI_MODEL = "poolside/laguna-s-2.1-free";

export function aiGatewayAvailable(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL ||
      process.env.ANTHROPIC_API_KEY?.trim(),
  );
}

export function collegeAiModelId(override?: string | null): string {
  return (
    override?.trim() ||
    process.env.EXTRACTION_MODEL?.trim() ||
    process.env.COLLEGE_AI_MODEL?.trim() ||
    process.env.ANTHROPIC_MODEL?.trim() ||
    DEFAULT_COLLEGE_AI_MODEL
  );
}

export async function resolveCollegeModel(override?: string | null): Promise<LanguageModel> {
  const { gateway } = await import("@ai-sdk/gateway");
  return gateway(collegeAiModelId(override));
}

export function isGatewayModelAccessError(message: string): boolean {
  return /free tier users do not have access|upgrade to paid credits|insufficient.?credits|credit balance|top-?up|purchase .*credits/i.test(
    message,
  );
}

export function formatGatewayAccessError(raw: string): string {
  const clean = raw.replace(/\u001b\[[0-9;]*m/g, "").replace(/\s+/g, " ").trim();
  if (isGatewayModelAccessError(clean)) {
    return (
      "This AI model needs paid Vercel AI Gateway credits (or a free-tier model). " +
      "The app will try a free model automatically; if this still appears, set " +
      `EXTRACTION_MODEL=${FREE_FALLBACK_COLLEGE_AI_MODEL} or top up credits at ` +
      "https://vercel.com/ai."
    );
  }
  return clean;
}
