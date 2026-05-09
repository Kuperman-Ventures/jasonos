import "server-only";
import { envConfigured } from "@/lib/integrations/_base";
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
  // end = first moment of next month (exclusive upper bound for the API)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    startIso: start.toISOString().split("T")[0],
    endIso: end.toISOString().split("T")[0],
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens: number
): number {
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
  // Requires an Admin API key (sk-ant-admin...) — not a regular API key.
  // The usage report endpoint is part of the Anthropic Admin API.
  const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
  const configured = envConfigured("ANTHROPIC_ADMIN_KEY");
  const now = new Date().toISOString();
  const { startIso, endIso, startAt, endAt } = billingPeriod();

  const empty: ApiServiceData = {
    configured,
    periodStart: startIso,
    periodEnd: endIso,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    byModel: [],
    lastFetchedAt: now,
  };

  if (!configured) {
    return { ...empty, error: "ANTHROPIC_ADMIN_KEY not set" };
  }

  try {
    const url = new URL(`${API_BASE}/organizations/usage_report/messages`);
    url.searchParams.set("starting_at", startAt);
    url.searchParams.set("ending_at", endAt);
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.append("group_by[]", "model");
    url.searchParams.set("limit", "31");

    const res = await fetch(url.toString(), {
      headers: {
        "x-api-key": adminKey!,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ...empty,
        error: `Anthropic Admin API ${res.status}: ${text.slice(0, 300)}`,
      };
    }

    const json = await res.json();

    // Response shape:
    // { data: [ { start_time, end_time, results: [ { model, input_tokens, output_tokens, ... } ] } ], has_more }
    type BucketResult = {
      model?: string;
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    type Bucket = { results?: BucketResult[] };
    const buckets: Bucket[] = json.data ?? [];

    // Sum across all daily buckets, grouped by model
    const modelMap = new Map<
      string,
      { input: number; output: number; cacheRead: number; cacheWrite: number }
    >();

    for (const bucket of buckets) {
      for (const r of bucket.results ?? []) {
        const m = r.model ?? "unknown";
        const existing = modelMap.get(m) ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
        modelMap.set(m, {
          input: existing.input + (r.input_tokens ?? 0),
          output: existing.output + (r.output_tokens ?? 0),
          cacheRead: existing.cacheRead + (r.cache_read_input_tokens ?? 0),
          cacheWrite: existing.cacheWrite + (r.cache_creation_input_tokens ?? 0),
        });
      }
    }

    const byModel: ModelUsage[] = Array.from(modelMap.entries()).map(([model, t]) => ({
      model,
      inputTokens: t.input,
      outputTokens: t.output,
      cacheReadTokens: t.cacheRead,
      cacheWriteTokens: t.cacheWrite,
      estimatedCostUsd: estimateCost(model, t.input, t.output, t.cacheRead, t.cacheWrite),
    }));

    byModel.sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd);

    return {
      configured: true,
      periodStart: startIso,
      periodEnd: endIso,
      totalInputTokens: byModel.reduce((s, m) => s + m.inputTokens, 0),
      totalOutputTokens: byModel.reduce((s, m) => s + m.outputTokens, 0),
      totalCostUsd: byModel.reduce((s, m) => s + m.estimatedCostUsd, 0),
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
