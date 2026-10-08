import { NextResponse } from "next/server";
import { isSession, isSuperAdmin, requireCollegeSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import {
  feedbackStatusLabel,
  isFeedbackStatus,
  updateSiteFeedbackStatus,
} from "@/lib/site-feedback";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await context.params;
  const feedbackId = id?.trim() ?? "";
  if (!feedbackId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    status?: unknown;
    adminNote?: unknown;
  };
  if (!isFeedbackStatus(body.status)) {
    return NextResponse.json(
      { error: "status must be new, planned, done, or wont" },
      { status: 400 },
    );
  }

  try {
    const item = await updateSiteFeedbackStatus(feedbackId, {
      status: body.status,
      adminNote: typeof body.adminNote === "string" ? body.adminNote : undefined,
    });
    await recordActivity({
      actorId: session.member.id,
      actorName: session.member.displayName,
      action: "update",
      entityType: "system",
      entityId: item.id,
      summary: `Marked feedback as ${feedbackStatusLabel(item.status)}`,
      detail: { status: item.status },
    });
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update feedback";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
