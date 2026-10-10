import { NextResponse } from "next/server";
import { getSkiTrackerStatus } from "@/lib/ski-tracker/status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await getSkiTrackerStatus();
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load Ski Tracker" },
      { status: 500 }
    );
  }
}
