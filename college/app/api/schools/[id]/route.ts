import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { deleteSchool, getSchool, supabaseConfigured, updateSchool } from "@/lib/db";
import { isForwardListPhaseMove, isListPhaseId } from "@/lib/list-phases";
import { canAdvanceListPhase } from "@/lib/permissions";
import { schoolPatchActivityLines } from "@/lib/school-activity";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;

  let before;
  try {
    before = await getSchool(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load school";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (typeof body.listPhase === "string" && isListPhaseId(body.listPhase)) {
    if (
      isForwardListPhaseMove(before.listPhase, body.listPhase) &&
      !canAdvanceListPhase(session.member)
    ) {
      return NextResponse.json(
        { error: "Only the Student can move schools into Consideration or Applications." },
        { status: 403 },
      );
    }
  }

  try {
    const school = await updateSchool(id, body);
    const lines = schoolPatchActivityLines(before, body);
    for (const line of lines) {
      await recordActivity({
        actorId: session.member.id,
        actorName: session.member.displayName,
        action: line.action,
        entityType: "school",
        entityId: school.id,
        summary: line.summary,
        detail: line.detail,
      });
    }
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
    let name = id;
    try {
      const current = await getSchool(id);
      name = current.name;
    } catch {
      /* still delete */
    }
    await deleteSchool(id);
    await recordActivity({
      actorId: session.member.id,
      actorName: session.member.displayName,
      action: "delete",
      entityType: "school",
      entityId: id,
      summary: `Removed college “${name}”`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete school";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
