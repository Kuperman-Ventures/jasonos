import { getAiUsagePayload } from "@/lib/ai-usage/data";
import { AiUsageClient } from "@/components/jasonos/ai-usage/ai-usage-client";

export const metadata = { title: "AI Usage · JasonOS" };
export const dynamic = "force-dynamic";

export default async function AiUsagePage() {
  const payload = await getAiUsagePayload();
  return <AiUsageClient payload={payload} />;
}
