import { NextResponse } from "next/server";
import { getAiUsagePayload } from "@/lib/ai-usage/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await getAiUsagePayload();
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch AI usage" },
      { status: 500 }
    );
  }
}
