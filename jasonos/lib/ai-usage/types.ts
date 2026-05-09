// Shared types for the AI Usage monitor tab.

export type ServiceStatus = "ok" | "warning" | "critical" | "unconfigured" | "error";

// ─── API-backed services ────────────────────────────────────────────────────

export interface ModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  estimatedCostUsd: number;
}

export interface ApiServiceData {
  configured: boolean;
  error?: string;
  /** Billing period start (ISO string) */
  periodStart: string;
  /** Billing period end (ISO string) */
  periodEnd: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  byModel: ModelUsage[];
  /** Credit balance if the provider surfaces it */
  creditBalanceUsd?: number;
  /** Hard or soft spending limit if the user has set one */
  spendingLimitUsd?: number;
  lastFetchedAt: string;
}

// ─── Subscription tracking (manual / no public API) ─────────────────────────

export type BillingCycle = "monthly" | "annual";

export interface SubscriptionConfig {
  enabled: boolean;
  plan: string;
  billingCycle: BillingCycle;
  monthlyPrice: number;
  renewalDate: string | null; // ISO date string YYYY-MM-DD
  /** For services like Cursor that expose a request quota */
  monthlyLimit?: number;
  currentUsage?: number;
  /** Budget the user wants to stay under (for API services too) */
  monthlyBudget?: number;
  notes?: string;
}

export interface SubscriptionServiceData {
  configured: boolean;
  config: SubscriptionConfig;
  daysUntilRenewal: number | null;
  usagePercent: number | null;
  status: ServiceStatus;
}

// ─── Combined page payload ───────────────────────────────────────────────────

export interface AiUsagePayload {
  anthropic: ApiServiceData;
  openai: ApiServiceData;
  vercelGateway: VercelGatewayData;
  subscriptions: {
    claudeAi: SubscriptionServiceData;
    chatgpt: SubscriptionServiceData;
    cursor: SubscriptionServiceData;
    perplexity: SubscriptionServiceData;
  };
}

export interface VercelGatewayData {
  configured: boolean;
  error?: string;
  totalRequests: number;
  totalCostUsd: number;
  byModel: { model: string; requests: number; costUsd: number }[];
  periodStart: string;
  periodEnd: string;
  lastFetchedAt: string;
}

// ─── Pricing constants (USD per million tokens) ─────────────────────────────

export const ANTHROPIC_PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-4-7":    { input: 15.00,  output: 75.00,  cacheRead: 1.50,  cacheWrite: 18.75 },
  "claude-opus-4-5":    { input: 15.00,  output: 75.00,  cacheRead: 1.50,  cacheWrite: 18.75 },
  "claude-sonnet-4-6":  { input: 3.00,   output: 15.00,  cacheRead: 0.30,  cacheWrite: 3.75  },
  "claude-sonnet-4-5":  { input: 3.00,   output: 15.00,  cacheRead: 0.30,  cacheWrite: 3.75  },
  "claude-haiku-4-5":   { input: 0.80,   output: 4.00,   cacheRead: 0.08,  cacheWrite: 1.00  },
  "claude-haiku-3-5":   { input: 0.80,   output: 4.00,   cacheRead: 0.08,  cacheWrite: 1.00  },
};

export const OPENAI_PRICES: Record<string, { input: number; output: number }> = {
  "gpt-4o":             { input: 2.50,   output: 10.00  },
  "gpt-4o-mini":        { input: 0.15,   output: 0.60   },
  "gpt-4-turbo":        { input: 10.00,  output: 30.00  },
  "gpt-4":              { input: 30.00,  output: 60.00  },
  "gpt-3.5-turbo":      { input: 0.50,   output: 1.50   },
  "o1":                 { input: 15.00,  output: 60.00  },
  "o1-mini":            { input: 3.00,   output: 12.00  },
  "o3":                 { input: 10.00,  output: 40.00  },
  "o3-mini":            { input: 1.10,   output: 4.40   },
};

export function computeStatus(
  costUsd: number,
  budgetUsd: number | undefined
): ServiceStatus {
  if (!budgetUsd) return "ok";
  const pct = costUsd / budgetUsd;
  if (pct >= 0.90) return "critical";
  if (pct >= 0.70) return "warning";
  return "ok";
}

export function subscriptionStatus(
  daysUntilRenewal: number | null,
  usagePercent: number | null
): ServiceStatus {
  if (daysUntilRenewal !== null && daysUntilRenewal <= 3) return "critical";
  if (daysUntilRenewal !== null && daysUntilRenewal <= 7) return "warning";
  if (usagePercent !== null && usagePercent >= 90) return "critical";
  if (usagePercent !== null && usagePercent >= 70) return "warning";
  return "ok";
}
