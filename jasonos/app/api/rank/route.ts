import { NextRequest, NextResponse } from "next/server";
import { todayInNewYork } from "@/lib/scoring/calendar";
import { loadRank } from "@/lib/scoring/loadRank";

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("date");
  const date = requested && requested.length > 0 ? requested : todayInNewYork();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Date must be YYYY-MM-DD" }, { status: 400 });
  }

  const payload = await loadRank(date);
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "s-maxage=900" },
  });
}
