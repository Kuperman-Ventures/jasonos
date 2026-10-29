import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { deleteSavedTrip } from "@/lib/saved-trips";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing trip id" }, { status: 400 });
  }

  try {
    await deleteSavedTrip(id.trim());
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete trip";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
