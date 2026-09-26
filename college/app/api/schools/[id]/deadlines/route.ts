import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import {
  addDeadline,
  deleteDeadline,
  getSchool,
  supabaseConfigured,
  updateDeadline,
} from "@/lib/db";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  const body = (await request.json()) as { title?: string; dueDate?: string | null };
  const title = body.title?.trim() ?? "";
  if (!title) {
    return NextResponse.json({ error: "Deadline title is required" }, { status: 400 });
  }
  try {
    const school = await addDeadline(id, title, body.dueDate ?? null);
    await recordActivity({
      actorId: session.member.id,
      actorName: session.member.displayName,
      action: "create",
      entityType: "school",
      entityId: school.id,
      summary: `Added deadline “${title}” on “${school.name}”`,
    });
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add deadline";
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
    deadlineId?: string;
    title?: string;
    dueDate?: string | null;
    completed?: boolean;
  };
  if (!body.deadlineId) {
    return NextResponse.json({ error: "deadlineId is required" }, { status: 400 });
  }
  try {
    const before = await getSchool(id);
    const prior = before.deadlines.find((deadline) => deadline.id === body.deadlineId);
    const school = await updateDeadline(id, body.deadlineId, {
      title: body.title,
      dueDate: body.dueDate,
      completed: body.completed,
    });
    const title = prior?.title ?? body.title ?? "deadline";
    const summary =
      typeof body.completed === "boolean"
        ? `${body.completed ? "Checked off" : "Reopened"} deadline “${title}” on “${school.name}”`
        : `Updated deadline “${title}” on “${school.name}”`;
    await recordActivity({
      actorId: session.member.id,
      actorName: session.member.displayName,
      action: "update",
      entityType: "school",
      entityId: school.id,
      summary,
    });
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update deadline";
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
  const deadlineId = new URL(request.url).searchParams.get("deadlineId");
  if (!deadlineId) {
    return NextResponse.json({ error: "deadlineId is required" }, { status: 400 });
  }
  try {
    const before = await getSchool(id);
    const prior = before.deadlines.find((deadline) => deadline.id === deadlineId);
    const school = await deleteDeadline(id, deadlineId);
    await recordActivity({
      actorId: session.member.id,
      actorName: session.member.displayName,
      action: "delete",
      entityType: "school",
      entityId: school.id,
      summary: `Removed deadline “${prior?.title ?? "deadline"}” on “${school.name}”`,
    });
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete deadline";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
