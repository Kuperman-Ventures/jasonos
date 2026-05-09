import "server-only";
import { envConfigured } from "@/lib/integrations/_base";
import { OPENAI_PRICES, type ApiServiceData, type ModelUsage } from "./types";

const API_BASE = "https://api.openai.com/v1";

function billingPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  // OpenAI usage API uses Unix timestamps (seconds)
  return {
    startTs: Math.floor(start.getTime() / 1000),
    endTs: Math.floor(end.getTime() / 1000) + 86400,
    startIso: start.toISOString().split("T")[0],
    endIso: end.toISOString().split("T")[0],
  };
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const normalised = model.toLowerCase().replace(/-\d{4}-\d{2}-\d{2}$/, "");
  const key = Object.keys(OPENAI_PRICES).find((k) => normalised.includes(k)) ?? "";
  const prices = OPENAI_PRICES[key];
  if (!prices) return 0;
  const M = 1_000_000;
  return (inputTokens / M) * prices.input + (outputTokens / M) * prices.output;
}

export async function getOpenAiUsage(): Promise<ApiServiceData> {
  const apiKey = process.env.OPENAI_API_KEY;
  const configured = envConfigured("OPENAI_API_KEY");
  const now = new Date().toISOString();
  const { startTs, endTs, startIso, endIso } = billingPeriod();

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

  if (!configured) return { ...empty, error: "OPENAI_API_KEY not set" };

  try {
    // Newer Org Usage API (groups by model, returns token counts)
    const url = new URL(`${API_BASE}/organization/usage/completions`);
    url.searchParams.set("start_time", String(startTs));
    url.searchParams.set("end_time", String(endTs));
    url.searchParams.set("group_by", "model");
    url.searchParams.set("limit", "50");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      // Fall back to legacy usage endpoint if org API not available
      return await getOpenAiUsageLegacy(apiKey!, startIso, endIso, now, empty);
    }

    const json = await res.json();

    type BucketResult = {
      model_id?: string;
      input_tokens?: number;
      output_tokens?: number;
      num_model_requests?: number;
    };

    type Bucket = {
      results?: BucketResult[];
    };

    const buckets: Bucket[] = json.data ?? [];

    // Aggregate by model across all time buckets
    const modelMap = new Map<string, { input: number; output: number }>();
    for (const bucket of buckets) {
      for (const r of bucket.results ?? []) {
        const m = r.model_id ?? "unknown";
        const existing = modelMap.get(m) ?? { input: 0, output: 0 };
        modelMap.set(m, {
          input: existing.input + (r.input_tokens ?? 0),
          output: existing.output + (r.output_tokens ?? 0),
        });
      }
    }

    const byModel: ModelUsage[] = Array.from(modelMap.entries()).map(([model, t]) => ({
      model,
      inputTokens: t.input,
      outputTokens: t.output,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      estimatedCostUsd: estimateCost(model, t.input, t.output),
    }));

    const totalInputTokens = byModel.reduce((s, m) => s + m.inputTokens, 0);
    const totalOutputTokens = byModel.reduce((s, m) => s + m.outputTokens, 0);
    const totalCostUsd = byModel.reduce((s, m) => s + m.estimatedCostUsd, 0);

    // Also attempt to fetch credit balance
    const creditBalanceUsd = await getOpenAiCreditBalance(apiKey!);

    return {
      configured: true,
      periodStart: startIso,
      periodEnd: endIso,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd,
      byModel,
      creditBalanceUsd: creditBalanceUsd ?? undefined,
      lastFetchedAt: now,
    };
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function getOpenAiUsageLegacy(
  apiKey: string,
  startIso: string,
  endIso: string,
  now: string,
  empty: ApiServiceData
): Promise<ApiServiceData> {
  try {
    // Legacy API returns one day at a time; fetch today and accumulate is not
    // practical — instead we fetch the current month start date and get totals.
    const url = new URL("https://api.openai.com/v1/usage");
    url.searchParams.set("date", startIso);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ...empty, error: `OpenAI API ${res.status}: ${text.slice(0, 200)}` };
    }

    const json = await res.json();

    type LegacyEntry = {
      snapshot_id?: string;
      n_context_tokens_total?: number;
      n_generated_tokens_total?: number;
    };

    const data: LegacyEntry[] = json.data ?? [];
    const modelMap = new Map<string, { input: number; output: number }>();

    for (const entry of data) {
      const m = entry.snapshot_id ?? "unknown";
      const existing = modelMap.get(m) ?? { input: 0, output: 0 };
      modelMap.set(m, {
        input: existing.input + (entry.n_context_tokens_total ?? 0),
        output: existing.output + (entry.n_generated_tokens_total ?? 0),
      });
    }

    const byModel: ModelUsage[] = Array.from(modelMap.entries()).map(([model, t]) => ({
      model,
      inputTokens: t.input,
      outputTokens: t.output,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      estimatedCostUsd: estimateCost(model, t.input, t.output),
    }));

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
    return { ...empty, error: err instanceof Error ? err.message : "Legacy API error" };
  }
}

async function getOpenAiCreditBalance(apiKey: string): Promise<number | null> {
  try {
    const res = await fetch("https://api.openai.com/dashboard/billing/credit_grants", {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json.total_available === "number" ? json.total_available : null;
  } catch {
    return null;
  }
}
