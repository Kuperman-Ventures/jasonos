import { NextResponse } from "next/server";
import { addStep, deleteStep, supabaseConfigured, updateStep } from "@/lib/db";
import { isOwner, type Owner } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
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
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add step";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request, context: Context) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  const body = (await request.json()) as { stepId?: string; done?: boolean; owner?: string; label?: string };
  if (!body.stepId) return NextResponse.json({ error: "stepId is required" }, { status: 400 });
  try {
    const school = await updateStep(id, body.stepId, {
      done: body.done,
      owner: body.owner && isOwner(body.owner) ? body.owner : undefined,
      label: body.label,
    });
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update step";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  const stepId = new URL(request.url).searchParams.get("stepId");
  if (!stepId) return NextResponse.json({ error: "stepId is required" }, { status: 400 });
  try {
    const school = await deleteStep(id, stepId);
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete step";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
