import { NextResponse } from "next/server";
import { getCollegeSession, isSuperAdmin } from "@/lib/auth";

export async function GET() {
  const session = await getCollegeSession();
  if (!session) {
    return NextResponse.json({ signedIn: false }, { status: 401 });
  }
  return NextResponse.json({
    signedIn: true,
    member: {
      id: session.member.id,
      displayName: session.member.displayName,
      role: session.member.role,
      email: session.email,
      isSuperAdmin: isSuperAdmin(session),
    },
  });
}
