import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Returns the Maps JS API key to authenticated college members only.
 * Prefer HTTP-referrer restrictions on this key in Google Cloud.
 */
export async function GET() {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  const key =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    "";
  if (!key) {
    return NextResponse.json(
      {
        error: "missing_key",
        message: "GOOGLE_MAPS_API_KEY is not set on the server.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { key },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
