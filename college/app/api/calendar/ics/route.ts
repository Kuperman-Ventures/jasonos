import { NextResponse } from "next/server";
import {
  loadCalendarEventsForFeed,
  resolveCalendarFeedToken,
  tokensMatch,
} from "@/lib/calendar-feed";
import { buildIcsCalendar } from "@/lib/ical";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const expected = await resolveCalendarFeedToken();
    if (!expected || !tokensMatch(token, expected)) {
      return NextResponse.json({ error: "Invalid or missing calendar token." }, { status: 401 });
    }

    const events = await loadCalendarEventsForFeed();
    const ics = buildIcsCalendar(events, { calendarName: "Kyle College Search" });
    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="kyle-college.ics"',
        "Cache-Control": "no-cache, max-age=300",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not build calendar feed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
