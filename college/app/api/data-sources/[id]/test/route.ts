import { NextResponse } from "next/server";
import { isSession, isSuperAdmin, requireCollegeSession } from "@/lib/auth";
import { loadLinkOverrides } from "@/lib/data-source-settings";
import { NotTestableError, runSourceTest } from "@/lib/data-source-tests";
import { loadDataSourcesPayload } from "@/lib/data-sources-server";
import { listSchools } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Only the admin can test data sources." }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    const [schools, linkOverrides] = await Promise.all([listSchools(), loadLinkOverrides()]);
    const result = await runSourceTest(id, { schools, linkOverrides, deadline: Date.now() + 50_000 });
    const payload = await loadDataSourcesPayload(true);
    return NextResponse.json({ ...payload, result });
  } catch (error) {
    if (error instanceof NotTestableError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Test failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
