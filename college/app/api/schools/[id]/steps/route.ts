import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { addStep, deleteStep, getSchool, supabaseConfigured, updateStep } from "@/lib/db";
import { isOwner, type Owner } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  const body = (await request.json()) as { label?: string; owner?: string };
  const label = body.label?.trim() ?? "";
  if (!label) return NextResponse.json({ error: "Step label is required" }, { status: 400 });
  const owner: Owner = body.owner && isOwner(body.owner) ? body.owner : "kyle";
  try {
    const school = await addStep(id, label, owner);
    await recordActivity({
      actorId: session.member.id,
      actorName: session.member.displayName,
      action: "create",
      entityType: "school",
      entityId: school.id,
      summary: `Added touchpoint “${label}” on “${school.name}”`,
    });
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add step";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request, context: Context) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  const body = (await request.json()) as {
    stepId?: string;
    done?: boolean;
    owner?: string;
    label?: string;
  };
  if (!body.stepId) return NextResponse.json({ error: "stepId is required" }, { status: 400 });
  try {
    const before = await getSchool(id);
    const prior = before.steps.find((step) => step.id === body.stepId);
    const school = await updateStep(id, body.stepId, {
      done: body.done,
      owner: body.owner && isOwner(body.owner) ? body.owner : undefined,
      label: body.label,
    });
    const label = prior?.label ?? "touchpoint";
    await recordActivity({
      actorId: session.member.id,
      actorName: session.member.displayName,
      action: "update",
      entityType: "school",
      entityId: school.id,
      summary: `Updated touchpoint “${label}” on “${school.name}”`,
    });
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update step";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  const stepId = new URL(request.url).searchParams.get("stepId");
  if (!stepId) return NextResponse.json({ error: "stepId is required" }, { status: 400 });
  try {
    const before = await getSchool(id);
    const prior = before.steps.find((step) => step.id === stepId);
    const school = await deleteStep(id, stepId);
    await recordActivity({
      actorId: session.member.id,
      actorName: session.member.displayName,
      action: "delete",
      entityType: "school",
      entityId: school.id,
      summary: `Removed touchpoint “${prior?.label ?? "touchpoint"}” on “${school.name}”`,
    });
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete step";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
