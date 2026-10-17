import { NextResponse } from "next/server";
import { isSession, isSuperAdmin, requireCollegeSession } from "@/lib/auth";
import { loadLiveNudgeCatalog } from "@/lib/nudge-catalog";
import { executeNudgeSend } from "@/lib/nudge-send";
import type { NudgeScheduleChoice } from "@/lib/nudge";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!isSession(session)) return session;
  try {
    const catalog = await loadLiveNudgeCatalog();
    return NextResponse.json(catalog);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load reminders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!isSession(session)) return session;
  const body = (await request.json()) as {
    recipients?: string[];
    stageIds?: string[];
    todoIds?: string[];
    note?: string;
    choice?: string;
  };
  const choice: NudgeScheduleChoice =
    body.choice === "fri" || body.choice === "weekly" ? body.choice : "now";
  try {
    const catalog = await loadLiveNudgeCatalog();
    const result = await executeNudgeSend({
      createdBy: session.member.id,
      recipients: Array.isArray(body.recipients) ? body.recipients.filter((id) => typeof id === "string") : [],
      stageIds: Array.isArray(body.stageIds) ? body.stageIds.filter((id) => typeof id === "string") : [],
      todoIds: Array.isArray(body.todoIds) ? body.todoIds.filter((id) => typeof id === "string") : [],
      note: typeof body.note === "string" ? body.note : "",
      choice,
      catalog,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
