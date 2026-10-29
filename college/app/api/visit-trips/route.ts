import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/db";
import {
  createSavedTrip,
  listSavedTrips,
  normalizeAddress,
  normalizeSchoolIdList,
  normalizeTripName,
} from "@/lib/saved-trips";
import {
  DEFAULT_VISIT_END_ADDRESS,
  DEFAULT_VISIT_START_ADDRESS,
} from "@/lib/visit-plan-state";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  try {
    const items = await listSavedTrips();
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load trips";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured() && session.member.id !== "local") {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    schoolIds?: unknown;
    schoolNames?: unknown;
    startAddress?: unknown;
    endAddress?: unknown;
  };

  const name = normalizeTripName(body.name);
  if (!name) {
    return NextResponse.json({ error: "Trip name is required" }, { status: 400 });
  }
  const schoolIds = normalizeSchoolIdList(body.schoolIds);
  if (!schoolIds.length) {
    return NextResponse.json({ error: "Add at least one school" }, { status: 400 });
  }
  const schoolNames = Array.isArray(body.schoolNames)
    ? body.schoolNames.map((value) => (typeof value === "string" ? value.trim() : ""))
    : [];

  try {
    const item = await createSavedTrip({
      name,
      schoolIds,
      schoolNames,
      startAddress: normalizeAddress(body.startAddress, DEFAULT_VISIT_START_ADDRESS),
      endAddress: normalizeAddress(body.endAddress, DEFAULT_VISIT_END_ADDRESS),
      createdById: session.member.id,
      createdByName: session.member.displayName,
    });
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save trip";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
