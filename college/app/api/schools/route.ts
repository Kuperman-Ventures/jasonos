import { NextResponse } from "next/server";
import { applySchoolFacts, createSchool, listSchools, supabaseConfigured } from "@/lib/db";
import { lookupSchool } from "@/lib/school-lookup";

export const maxDuration = 60;

export async function GET() {
  try {
    const schools = await listSchools();
    return NextResponse.json({ persisted: supabaseConfigured(), schools });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read schools";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const body = (await request.json()) as { name?: string };
  try {
    const school = await createSchool(body.name ?? "");
    try {
      const lookup = await lookupSchool(school.name);
      const filled = await applySchoolFacts(school.id, lookup.facts);
      return NextResponse.json({ school: filled, research: { summary: lookup.summary } });
    } catch (error) {
      console.error("School lookup failed", error);
      return NextResponse.json({
        school,
        research: { summary: `Added ${school.name}. The lookup failed, so the record is still blank except for the name.` },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add school";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
