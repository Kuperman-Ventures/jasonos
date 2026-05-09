import "server-only";
import { emptyResult, envConfigured } from "@/lib/integrations/_base";
import {
  ANTHROPIC_PRICES,
  type ApiServiceData,
  type ModelUsage,
} from "./types";

const API_BASE = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

function billingPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

function estimateCost(model: string, inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheWriteTokens: number): number {
  const key = Object.keys(ANTHROPIC_PRICES).find((k) => model.includes(k)) ?? "";
  const prices = ANTHROPIC_PRICES[key];
  if (!prices) return 0;
  const M = 1_000_000;
  return (
    (inputTokens / M) * prices.input +
    (outputTokens / M) * prices.output +
    (cacheReadTokens / M) * prices.cacheRead +
    (cacheWriteTokens / M) * prices.cacheWrite
  );
}

export async function getAnthropicUsage(): Promise<ApiServiceData> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const configured = envConfigured("ANTHROPIC_API_KEY");
  const now = new Date().toISOString();
  const { start, end } = billingPeriod();

  const empty: ApiServiceData = {
    configured,
    periodStart: start,
    periodEnd: end,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    byModel: [],
    lastFetchedAt: now,
  };

  if (!configured) return { ...empty, error: "ANTHROPIC_API_KEY not set" };

  try {
    const url = new URL(`${API_BASE}/usage/models`);
    url.searchParams.set("start_date", start);
    url.searchParams.set("end_date", end);

    const res = await fetch(url.toString(), {
      headers: {
        "x-api-key": apiKey!,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ...empty, error: `Anthropic API ${res.status}: ${text.slice(0, 200)}` };
    }

    const json = await res.json();
    const rows: Array<{
      model: string;
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    }> = json.data ?? [];

    const byModel: ModelUsage[] = rows.map((r) => {
      const cacheWrite = r.cache_creation_input_tokens ?? 0;
      const cacheRead = r.cache_read_input_tokens ?? 0;
      const cost = estimateCost(r.model, r.input_tokens, r.output_tokens, cacheRead, cacheWrite);
      return {
        model: r.model,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        cacheReadTokens: cacheRead,
        cacheWriteTokens: cacheWrite,
        estimatedCostUsd: cost,
      };
    });

    const totalInputTokens = byModel.reduce((s, m) => s + m.inputTokens, 0);
    const totalOutputTokens = byModel.reduce((s, m) => s + m.outputTokens, 0);
    const totalCostUsd = byModel.reduce((s, m) => s + m.estimatedCostUsd, 0);

    return {
      configured: true,
      periodStart: start,
      periodEnd: end,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd,
      byModel,
      lastFetchedAt: now,
    };
  } catch (err) {
    return {
      ...empty,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
