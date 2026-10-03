import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { suggestActivityIcon } from "@/lib/activity-icon-ai";
import { pickActivityIcon } from "@/lib/activity-icons";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    category?: unknown;
    organization?: unknown;
  };
  const name = typeof body.name === "string" ? body.name : "";
  const category = typeof body.category === "string" ? body.category : undefined;
  const organization = typeof body.organization === "string" ? body.organization : undefined;
  if (!name.trim()) {
    return NextResponse.json({ error: "Activity name is required" }, { status: 400 });
  }

  try {
    const icon = await suggestActivityIcon({ name, category, organization });
    return NextResponse.json({ icon });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Icon lookup failed";
    return NextResponse.json(
      { icon: pickActivityIcon({ name, category, organization }), error: message },
      { status: 200 },
    );
  }
}
