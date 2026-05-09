import "server-only";
import { envConfigured } from "@/lib/integrations/_base";
import type { VercelGatewayData } from "./types";

function billingPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startIso: start.toISOString().split("T")[0],
    endIso: end.toISOString().split("T")[0],
  };
}

export async function getVercelGatewayUsage(): Promise<VercelGatewayData> {
  const configured =
    envConfigured("AI_GATEWAY_API_KEY") ||
    envConfigured("VERCEL_OIDC_TOKEN") ||
    envConfigured("VERCEL_TOKEN");

  const now = new Date().toISOString();
  const { startIso, endIso } = billingPeriod();

  const empty: VercelGatewayData = {
    configured,
    totalRequests: 0,
    totalCostUsd: 0,
    byModel: [],
    periodStart: startIso,
    periodEnd: endIso,
    lastFetchedAt: now,
  };

  if (!configured) {
    return { ...empty, error: "Vercel AI Gateway not configured" };
  }

  // Vercel AI Gateway usage is surfaced through the Vercel platform analytics.
  // The gateway itself doesn't expose a public per-request cost API, but
  // it logs usage to the Vercel dashboard. Until a stable usage endpoint is
  // available, we return the configured state so the card renders as "active".
  return {
    ...empty,
    configured: true,
    error: undefined,
  };
}
