import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { deleteSchool, getSchool, supabaseConfigured, updateSchool } from "@/lib/db";
import {
  canAdvanceListPhase,
  isForwardListPhaseMove,
  isListPhaseId,
} from "@/lib/list-phases";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;

  if (typeof body.listPhase === "string" && isListPhaseId(body.listPhase)) {
    try {
      const current = await getSchool(id);
      if (isForwardListPhaseMove(current.listPhase, body.listPhase) && !canAdvanceListPhase(session.member.id)) {
        return NextResponse.json(
          { error: "Only Kyle can move schools into Consideration or Applications." },
          { status: 403 },
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load school";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  try {
    const school = await updateSchool(id, body);
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update school";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  try {
    await deleteSchool(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete school";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
