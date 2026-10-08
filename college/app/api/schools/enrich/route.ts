import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { listSchools, supabaseConfigured } from "@/lib/db";
import { enrichSchoolRecord } from "@/lib/school-enrich";
import { schoolNeedsCommonAppFill } from "@/lib/common-app-grid";
import { schoolNeedsScorecardFill } from "@/lib/college-scorecard";

export const maxDuration = 300;

/**
 * POST /api/schools/enrich
 * Body:
 *   { schoolId: string } — apply catalogs + research for one school
 *   { backfill: true } — enrich every live school that still looks thin
 */
export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    schoolId?: string;
    backfill?: boolean;
    webLookup?: boolean;
  };
  const webLookup = body.webLookup !== false;

  if (body.backfill) {
    const schools = await listSchools();
    const targets = schools.filter((school) => {
      if (school.archived) return false;
      return (
        schoolNeedsCommonAppFill(school) ||
        schoolNeedsScorecardFill(school) ||
        !school.submissions ||
        !school.submissionsCheckedDate?.trim() ||
        !school.programOptions?.some((p) => p.source === "catalog") ||
        !(school.researchCompleted?.length)
      );
    });
    const results: Array<{ id: string; name: string; applied: string[] }> = [];
    for (const school of targets) {
      const enriched = await enrichSchoolRecord(school.id, { webLookup });
      results.push({
        id: enriched.school.id,
        name: enriched.school.name,
        applied: enriched.applied,
      });
    }
    return NextResponse.json({ backfill: true, attempted: targets.length, results });
  }

  const schoolId = body.schoolId?.trim() ?? "";
  if (!schoolId) {
    return NextResponse.json({ error: "schoolId is required" }, { status: 400 });
  }

  const enriched = await enrichSchoolRecord(schoolId, { webLookup });
  return NextResponse.json({
    school: enriched.school,
    applied: enriched.applied,
  });
}
