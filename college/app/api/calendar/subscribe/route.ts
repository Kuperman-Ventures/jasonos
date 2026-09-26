import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { resolveCalendarFeedToken } from "@/lib/calendar-feed";
import { webcalUrlFromHttps } from "@/lib/ical";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  try {
    const token = await resolveCalendarFeedToken();
    if (!token) {
      return NextResponse.json({ error: "Calendar feed is not available." }, { status: 503 });
    }
    const origin = new URL(request.url).origin;
    const httpsUrl = `${origin}/api/calendar/ics?token=${encodeURIComponent(token)}`;
    return NextResponse.json({
      httpsUrl,
      webcalUrl: webcalUrlFromHttps(httpsUrl),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create subscribe link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
