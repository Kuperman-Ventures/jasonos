import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { searchScorecardSchools } from "@/lib/scorecard";

export const maxDuration = 30;

async function search(q: string) {
  const results = await searchScorecardSchools(q, 10);
  return NextResponse.json({ results });
}

export async function GET(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    return await search(q);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scorecard search failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  const body = (await request.json().catch(() => ({}))) as { q?: string };
  try {
    return await search(body.q ?? "");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scorecard search failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
