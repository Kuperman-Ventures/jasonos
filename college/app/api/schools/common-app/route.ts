import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import {
  COMMON_APP_DETAIL_KEYS,
  queryCommonAppGrid,
  schoolNeedsCommonAppFill,
} from "@/lib/common-app-grid";
import { applySchoolFacts, getSchool, listSchools, supabaseConfigured } from "@/lib/db";

export const maxDuration = 120;

/**
 * POST /api/schools/common-app
 * Body:
 *   { name: string } — look up one school in the Common App grid
 *   { schoolId: string } — enrich one existing school (blank fields only)
 *   { backfill: true } — enrich every school that still needs Common App fields
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
    const targets = schools.filter((school) => !school.archived && schoolNeedsCommonAppFill(school));
    const results: Array<{ id: string; name: string; status: string; officialName?: string; filled?: string[] }> =
      [];

    for (const school of targets) {
      const lookup = queryCommonAppGrid(school.name);
      if (lookup.status !== "hit" || !lookup.facts) {
        results.push({ id: school.id, name: school.name, status: lookup.status });
        continue;
      }
      const before = { ...school, deadlines: [...school.deadlines] };
      const filled = await applySchoolFacts(school.id, lookup.facts, { onlyBlank: true });
      const changed = COMMON_APP_DETAIL_KEYS.filter(
        (key) => !before[key]?.trim() && Boolean(filled[key]?.trim()),
      );
      const deadlineAdded = filled.deadlines.length > before.deadlines.length;
      results.push({
        id: school.id,
        name: school.name,
        status: "hit",
        officialName: lookup.officialName ?? undefined,
        filled: deadlineAdded ? [...changed, "deadlines"] : [...changed],
      });
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
    const lookup = queryCommonAppGrid(school.name);
    if (lookup.status !== "hit" || !lookup.facts) {
      return NextResponse.json({
        school,
        status: lookup.status,
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

  const lookup = queryCommonAppGrid(name);
  return NextResponse.json({
    status: lookup.status,
    officialName: lookup.officialName,
    facts: lookup.facts,
    match: lookup.match
      ? {
          name: lookup.match.name,
          platform: lookup.match.platform,
          testPolicy: lookup.match.testPolicy,
        }
      : null,
  });
}
