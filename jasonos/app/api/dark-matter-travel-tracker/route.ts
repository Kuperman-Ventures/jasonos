import { NextResponse } from "next/server";
import { getTravelTracker, publicPayload } from "@/lib/dark-matter-travel-tracker/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = publicPayload(await getTravelTracker());
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load Dark Matter Travel Tracker",
      },
      { status: 500 }
    );
  }
}
