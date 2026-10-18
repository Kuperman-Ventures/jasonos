import type { Metadata } from "next";
import { LiveMetricsClient } from "@/components/jasonos/meeting-prep/live-metrics-client";
import { getRelationshipMetrics } from "@/lib/server-actions/live-metrics";

export const metadata: Metadata = { title: "Metrics · Live · JasonOS" };
export const dynamic = "force-dynamic";

function daysOf(value: string | string[] | undefined): number {
  const text = Array.isArray(value) ? value[0] : value;
  const days = Number(text);
  return days === 30 || days === 180 ? days : 90;
}

export default async function LiveMetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  const query = await searchParams;
  const days = daysOf(query.days);
  const result = await getRelationshipMetrics(days);
  return (
    <LiveMetricsClient
      metrics={result.ok ? result.metrics : null}
      days={days}
      error={result.ok ? null : result.error}
    />
  );
}
