import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { applySchoolFacts, createSchool, listSchools, supabaseConfigured } from "@/lib/db";
import { lookupSchool } from "@/lib/school-lookup";

export const maxDuration = 60;

export async function GET() {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  try {
    const schools = await listSchools();
    return NextResponse.json({ persisted: supabaseConfigured(), schools });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read schools";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const body = (await request.json()) as { name?: string };
  try {
    const school = await createSchool(body.name ?? "");
    let result = school;
    let researchSummary = `Added ${school.name}.`;
    try {
      const lookup = await lookupSchool(school.name);
      result = await applySchoolFacts(school.id, lookup.facts);
      researchSummary = lookup.summary;
    } catch (error) {
      console.error("School lookup failed", error);
      researchSummary = `Added ${school.name}. The lookup failed, so the record is still blank except for the name.`;
    }
    await recordActivity({
      actorId: session.member.id,
      actorName: session.member.displayName,
      action: "create",
      entityType: "school",
      entityId: result.id,
      summary: `Added college “${result.name}”`,
    });
    return NextResponse.json({ school: result, research: { summary: researchSummary } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add school";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
