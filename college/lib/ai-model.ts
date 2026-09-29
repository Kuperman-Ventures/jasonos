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

/** Models Jason can pick in Reference › Data Sources › Vercel AI Gateway. */
export const AI_MODEL_OPTIONS: { id: string; label: string }[] = [
  { id: DEFAULT_COLLEGE_AI_MODEL, label: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
  { id: FREE_FALLBACK_COLLEGE_AI_MODEL, label: "Laguna S 2.1 (free)" },
];

export function isAiModelOption(id: string): boolean {
  return AI_MODEL_OPTIONS.some((option) => option.id === id);
}

/** Per-call override, then the saved Data Sources setting, then env, then the default. */
export function collegeAiModelId(override?: string | null, saved?: string | null): string {
  return (
    override?.trim() ||
    saved?.trim() ||
    process.env.EXTRACTION_MODEL?.trim() ||
    process.env.COLLEGE_AI_MODEL?.trim() ||
    process.env.ANTHROPIC_MODEL?.trim() ||
    DEFAULT_COLLEGE_AI_MODEL
  );
}

const SAVED_MODEL_TTL_MS = 60_000;
let savedModelCache: { value: string | null; at: number } | null = null;

export function clearSavedCollegeAiModelCache(): void {
  savedModelCache = null;
}

/** AI model saved in app_state.data_source_settings. Null when unset or unreadable. */
export async function savedCollegeAiModel(): Promise<string | null> {
  if (savedModelCache && Date.now() - savedModelCache.at < SAVED_MODEL_TTL_MS) {
    return savedModelCache.value;
  }
  let value: string | null = null;
  try {
    const { loadDataSourceSettings } = await import("./data-source-settings");
    const saved = (await loadDataSourceSettings()).aiModel;
    value = saved && isAiModelOption(saved) ? saved : null;
  } catch {
    value = null;
  }
  savedModelCache = { value, at: Date.now() };
  return value;
}

export async function resolveCollegeModel(override?: string | null): Promise<LanguageModel> {
  const { gateway } = await import("@ai-sdk/gateway");
  const saved = override?.trim() ? null : await savedCollegeAiModel();
  return gateway(collegeAiModelId(override, saved));
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
