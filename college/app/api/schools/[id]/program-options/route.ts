import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { getSchool, supabaseConfigured, updateSchool } from "@/lib/db";
import { fetchScorecardEngineeringPrograms } from "@/lib/scorecard";

type Context = { params: Promise<{ id: string }> };

function todayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function POST(_request: Request, context: Context) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const { id } = await context.params;
  let school;
  try {
    school = await getSchool(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load school";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (school.programOptions.some((row) => row.source === "catalog")) {
    return NextResponse.json(
      { error: "This school already has a catalog research list." },
      { status: 409 },
    );
  }

  if (school.unitId == null || !(school.unitId > 0)) {
    return NextResponse.json(
      { error: "This school has no College Scorecard ID." },
      { status: 400 },
    );
  }

  try {
    const programOptions = await fetchScorecardEngineeringPrograms(school.unitId, school.id);
    const updated = await updateSchool(school.id, {
      programOptions,
      programOptionsCheckedDate: todayIsoDate(),
    });
    await recordActivity({
      actorId: session.member.id,
      actorName: session.member.displayName,
      action: "update",
      entityType: "school",
      entityId: updated.id,
      summary: `Looked up engineering programs for ${updated.name}`,
    });
    return NextResponse.json({ school: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not look up engineering programs";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
