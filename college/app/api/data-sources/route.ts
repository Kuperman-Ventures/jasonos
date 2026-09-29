import { NextResponse } from "next/server";
import { isSession, isSuperAdmin, requireCollegeSession } from "@/lib/auth";
import { loadDataSourcesPayload } from "@/lib/data-sources-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  try {
    return NextResponse.json(await loadDataSourcesPayload(isSuperAdmin(session)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load data sources";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
