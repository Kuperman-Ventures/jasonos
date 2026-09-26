import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { queryCollegeScorecard, schoolNeedsScorecardFill } from "@/lib/college-scorecard";
import { applySchoolFacts, getSchool, listSchools, supabaseConfigured } from "@/lib/db";

export const maxDuration = 300;

/**
 * POST /api/schools/scorecard
 * Body:
 *   { name: string } — look up one school by name and return mapped Scorecard fields
 *   { schoolId: string } — enrich one existing school (blank fields only)
 *   { backfill: true } — enrich every school on the list that still needs Scorecard numbers
 */
export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    schoolId?: string;
    backfill?: boolean;
  };

  if (body.backfill) {
    if (!supabaseConfigured()) {
      return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
    }
    const schools = await listSchools();
    const targets = schools.filter((school) => !school.archived && schoolNeedsScorecardFill(school));
    const results: Array<{ id: string; name: string; status: string; filled?: string[] }> = [];

    for (const school of targets) {
      const lookup = await queryCollegeScorecard(school.name);
      if (lookup.status !== "hit" || !lookup.facts) {
        results.push({ id: school.id, name: school.name, status: lookup.status });
        continue;
      }
      const before = { ...school };
      const filled = await applySchoolFacts(school.id, lookup.facts, { onlyBlank: true });
      const changed = (
        [
          "location",
          "campusSize",
          "admissionsContext",
          "satContext",
          "testPolicy",
          "middle50",
          "costOfAttendance",
          "netPriceEstimate",
          "website",
        ] as const
      ).filter((key) => !before[key]?.trim() && Boolean(filled[key]?.trim()));
      const enrollmentFilled =
        before.undergradEnrollment == null && filled.undergradEnrollment != null;
      results.push({
        id: school.id,
        name: school.name,
        status: "hit",
        filled: enrollmentFilled ? [...changed, "undergradEnrollment"] : [...changed],
      });
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    return NextResponse.json({
      backfill: true,
      attempted: targets.length,
      results,
    });
  }

  if (body.schoolId?.trim()) {
    if (!supabaseConfigured()) {
      return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
    }
    const school = await getSchool(body.schoolId.trim());
    const lookup = await queryCollegeScorecard(school.name);
    if (lookup.status !== "hit" || !lookup.facts) {
      return NextResponse.json({
        school,
        status: lookup.status,
        error: lookup.error,
        facts: null,
      });
    }
    const updated = await applySchoolFacts(school.id, lookup.facts, { onlyBlank: true });
    return NextResponse.json({
      school: updated,
      status: "hit",
      officialName: lookup.officialName,
      facts: lookup.facts,
    });
  }

  const name = body.name?.trim() ?? "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const lookup = await queryCollegeScorecard(name);
  return NextResponse.json({
    status: lookup.status,
    officialName: lookup.officialName,
    facts: lookup.facts,
    error: lookup.error ?? null,
    match: lookup.match
      ? {
          id: lookup.match.id,
          name: lookup.match["school.name"],
          city: lookup.match["school.city"] ?? null,
          state: lookup.match["school.state"] ?? null,
        }
      : null,
  });
}
