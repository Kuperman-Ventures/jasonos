import { NextResponse } from "next/server";
import { isSession, isSuperAdmin, requireCollegeSession } from "@/lib/auth";
import { saveLinkOverride } from "@/lib/data-source-settings";
import { loadDataSourcesPayload } from "@/lib/data-sources-server";
import { listSchools } from "@/lib/db";
import { isOverrideSourceId, validateOverrideUrl } from "@/lib/link-overrides";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Only the admin can edit link overrides." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!isOverrideSourceId(id)) {
    return NextResponse.json({ error: `${id} does not take per-school URL overrides.` }, { status: 400 });
  }

  let body: { schoolId?: unknown; url?: unknown };
  try {
    body = (await request.json()) as { schoolId?: unknown; url?: unknown };
  } catch {
    return NextResponse.json({ error: "Send JSON: { schoolId, url }" }, { status: 400 });
  }
  const schoolId = typeof body.schoolId === "string" ? body.schoolId.trim() : "";
  if (!schoolId) return NextResponse.json({ error: "Pick a school." }, { status: 400 });
  const checked = validateOverrideUrl(body.url);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

  try {
    const schools = await listSchools();
    if (!schools.some((s) => s.id === schoolId)) {
      return NextResponse.json({ error: "Unknown school." }, { status: 400 });
    }
    await saveLinkOverride(id, schoolId, checked.url);
    return NextResponse.json(await loadDataSourcesPayload(true));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the override";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
