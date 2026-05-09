"use server";

import { revalidatePath } from "next/cache";
import { saveSubscriptionConfig } from "@/lib/ai-usage/subscriptions";
import type { SubscriptionKey } from "@/lib/ai-usage/subscriptions";
import type { SubscriptionConfig } from "@/lib/ai-usage/types";

export async function updateAiSubscription(
  key: SubscriptionKey,
  config: Partial<SubscriptionConfig>
): Promise<{ ok: boolean; error?: string }> {
  try {
    await saveSubscriptionConfig(key, config);
    revalidatePath("/ai-usage");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed" };
  }
}
