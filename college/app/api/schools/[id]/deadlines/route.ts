import { NextResponse } from "next/server";
import { addDeadline, deleteDeadline, supabaseConfigured, updateDeadline } from "@/lib/db";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  const body = (await request.json()) as { title?: string; dueDate?: string | null };
  const title = body.title?.trim() ?? "";
  if (!title) return NextResponse.json({ error: "Deadline title is required" }, { status: 400 });
  try {
    const school = await addDeadline(id, title, body.dueDate ?? null);
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add deadline";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request, context: Context) {
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
  if (!body.deadlineId) return NextResponse.json({ error: "deadlineId is required" }, { status: 400 });
  try {
    const school = await updateDeadline(id, body.deadlineId, {
      title: body.title,
      dueDate: body.dueDate,
      completed: body.completed,
    });
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update deadline";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  const deadlineId = new URL(request.url).searchParams.get("deadlineId");
  if (!deadlineId) return NextResponse.json({ error: "deadlineId is required" }, { status: 400 });
  try {
    const school = await deleteDeadline(id, deadlineId);
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete deadline";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
