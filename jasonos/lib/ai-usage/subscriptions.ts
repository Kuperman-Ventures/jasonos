import "server-only";
import { createPublicServiceRoleClient } from "@/lib/supabase/server";
import {
  subscriptionStatus,
  type BillingCycle,
  type SubscriptionConfig,
  type SubscriptionServiceData,
} from "./types";

export type SubscriptionKey = "claudeAi" | "chatgpt" | "cursor" | "perplexity";

const SUBSCRIPTION_DEFAULTS: Record<SubscriptionKey, SubscriptionConfig> = {
  claudeAi: {
    enabled: false,
    plan: "Pro",
    billingCycle: "monthly",
    monthlyPrice: 20,
    renewalDate: null,
  },
  chatgpt: {
    enabled: false,
    plan: "Plus",
    billingCycle: "monthly",
    monthlyPrice: 20,
    renewalDate: null,
  },
  cursor: {
    enabled: false,
    plan: "Pro",
    billingCycle: "monthly",
    monthlyPrice: 20,
    renewalDate: null,
    monthlyLimit: 500,
    currentUsage: 0,
  },
  perplexity: {
    enabled: false,
    plan: "Pro",
    billingCycle: "monthly",
    monthlyPrice: 20,
    renewalDate: null,
  },
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function buildServiceData(config: SubscriptionConfig): SubscriptionServiceData {
  const days = daysUntil(config.renewalDate);
  const usagePct =
    config.monthlyLimit && config.currentUsage != null
      ? Math.round((config.currentUsage / config.monthlyLimit) * 100)
      : null;
  return {
    configured: config.enabled,
    config,
    daysUntilRenewal: days,
    usagePercent: usagePct,
    status: config.enabled ? subscriptionStatus(days, usagePct) : "unconfigured",
  };
}

function mergeConfig(
  defaults: SubscriptionConfig,
  stored: unknown
): SubscriptionConfig {
  if (!stored || typeof stored !== "object") return defaults;
  const s = stored as Partial<SubscriptionConfig>;
  return {
    enabled: s.enabled ?? defaults.enabled,
    plan: s.plan ?? defaults.plan,
    billingCycle: (s.billingCycle as BillingCycle) ?? defaults.billingCycle,
    monthlyPrice: s.monthlyPrice ?? defaults.monthlyPrice,
    renewalDate: s.renewalDate ?? defaults.renewalDate,
    monthlyLimit: s.monthlyLimit ?? defaults.monthlyLimit,
    currentUsage: s.currentUsage ?? defaults.currentUsage,
    monthlyBudget: s.monthlyBudget ?? defaults.monthlyBudget,
    notes: s.notes ?? defaults.notes,
  };
}

export async function getSubscriptionData(): Promise<
  Record<SubscriptionKey, SubscriptionServiceData>
> {
  try {
    const supabase = createPublicServiceRoleClient();
    const { data } = await supabase
      .from("user_preferences")
      .select("ai_subscriptions")
      .limit(1)
      .maybeSingle();

    type StoredServices = Record<string, unknown>;
    const stored: StoredServices =
      (data?.ai_subscriptions as { services?: StoredServices } | null)?.services ?? {};

    const keys: SubscriptionKey[] = ["claudeAi", "chatgpt", "cursor", "perplexity"];
    return Object.fromEntries(
      keys.map((k) => [k, buildServiceData(mergeConfig(SUBSCRIPTION_DEFAULTS[k], stored[k]))])
    ) as Record<SubscriptionKey, SubscriptionServiceData>;
  } catch {
    return Object.fromEntries(
      (["claudeAi", "chatgpt", "cursor", "perplexity"] as SubscriptionKey[]).map((k) => [
        k,
        buildServiceData(SUBSCRIPTION_DEFAULTS[k]),
      ])
    ) as Record<SubscriptionKey, SubscriptionServiceData>;
  }
}

export async function saveSubscriptionConfig(
  key: SubscriptionKey,
  config: Partial<SubscriptionConfig>
): Promise<void> {
  const supabase = createPublicServiceRoleClient();
  const { data } = await supabase
    .from("user_preferences")
    .select("ai_subscriptions")
    .limit(1)
    .maybeSingle();

  type StoredPrefs = { services?: Record<string, unknown> };
  const existing = (data?.ai_subscriptions as StoredPrefs | null) ?? { services: {} };
  const services = { ...(existing.services ?? {}), [key]: config };

  await supabase
    .from("user_preferences")
    .update({ ai_subscriptions: { services } })
    .limit(1);
}
