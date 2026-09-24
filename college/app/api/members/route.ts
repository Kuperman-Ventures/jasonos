import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { listVisibleMemberProfiles } from "@/lib/member-avatars";

export async function GET() {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  try {
    const members = await listVisibleMemberProfiles();
    return NextResponse.json({ members });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load members";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
