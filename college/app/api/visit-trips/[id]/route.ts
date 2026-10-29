import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/db";
import {
  deleteSavedTrip,
  normalizeAddress,
  normalizeSchoolIdList,
  normalizeTripName,
  updateSavedTrip,
  type SavedTripUpdate,
} from "@/lib/saved-trips";
import {
  DEFAULT_VISIT_END_ADDRESS,
  DEFAULT_VISIT_START_ADDRESS,
} from "@/lib/visit-plan-state";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured() && session.member.id !== "local") {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing trip id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    schoolIds?: unknown;
    schoolNames?: unknown;
    startAddress?: unknown;
    endAddress?: unknown;
  };

  const patch: SavedTripUpdate = {};
  if ("name" in body) {
    const name = normalizeTripName(body.name);
    if (!name) {
      return NextResponse.json({ error: "Trip name is required" }, { status: 400 });
    }
    patch.name = name;
  }
  if ("schoolIds" in body) {
    const schoolIds = normalizeSchoolIdList(body.schoolIds);
    if (!schoolIds.length) {
      return NextResponse.json({ error: "Add at least one school" }, { status: 400 });
    }
    patch.schoolIds = schoolIds;
    patch.schoolNames = Array.isArray(body.schoolNames)
      ? body.schoolNames.map((value) => (typeof value === "string" ? value.trim() : ""))
      : [];
  }
  if ("startAddress" in body) {
    patch.startAddress = normalizeAddress(body.startAddress, DEFAULT_VISIT_START_ADDRESS);
  }
  if ("endAddress" in body) {
    patch.endAddress = normalizeAddress(body.endAddress, DEFAULT_VISIT_END_ADDRESS);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    if (!supabaseConfigured()) {
      return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
    }
    const item = await updateSavedTrip(id.trim(), patch);
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update trip";
    const status = message === "Trip not found" || /0 rows|PGRST116/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing trip id" }, { status: 400 });
  }

  try {
    await deleteSavedTrip(id.trim());
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete trip";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
