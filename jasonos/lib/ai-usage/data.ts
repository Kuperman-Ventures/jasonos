import "server-only";
import { getAnthropicUsage } from "./anthropic";
import { getOpenAiUsage } from "./openai";
import { getVercelGatewayUsage } from "./vercel-gateway";
import { getSubscriptionData } from "./subscriptions";
import type { AiUsagePayload } from "./types";

export async function getAiUsagePayload(): Promise<AiUsagePayload> {
  const [anthropic, openai, vercelGateway, subscriptions] = await Promise.all([
    getAnthropicUsage(),
    getOpenAiUsage(),
    getVercelGatewayUsage(),
    getSubscriptionData(),
  ]);

  return { anthropic, openai, vercelGateway, subscriptions };
}
