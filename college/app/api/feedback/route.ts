import { NextResponse } from "next/server";
import { isSession, isSuperAdmin, requireCollegeSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import {
  clipContext,
  createSiteFeedback,
  isFeedbackKind,
  listAllSiteFeedback,
  listSiteFeedbackForMember,
  normalizeFeedbackBody,
} from "@/lib/site-feedback";
import { supabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  const scope = new URL(request.url).searchParams.get("scope");
  try {
    if (scope === "all") {
      if (!isSuperAdmin(session)) {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
      }
      const items = await listAllSiteFeedback(100);
      return NextResponse.json({ items });
    }
    const items = await listSiteFeedbackForMember(session.member.id, 20);
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load feedback";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured() && session.member.id !== "local") {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    kind?: unknown;
    body?: unknown;
    pageTab?: unknown;
    schoolId?: unknown;
    schoolName?: unknown;
  };

  if (!isFeedbackKind(body.kind)) {
    return NextResponse.json({ error: "kind must be bug, idea, or question" }, { status: 400 });
  }
  const message = normalizeFeedbackBody(body.body);
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  try {
    const item = await createSiteFeedback({
      memberId: session.member.id,
      memberName: session.member.displayName,
      kind: body.kind,
      body: message,
      pageTab: clipContext(body.pageTab, 80),
      schoolId: clipContext(body.schoolId, 80),
      schoolName: clipContext(body.schoolName, 160),
    });
    await recordActivity({
      actorId: session.member.id,
      actorName: session.member.displayName,
      action: "create",
      entityType: "system",
      entityId: item.id,
      summary: `Sent feedback (${item.kind}): ${item.body.slice(0, 80)}`,
      detail: {
        kind: item.kind,
        pageTab: item.pageTab,
        schoolId: item.schoolId,
      },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Could not save feedback";
    return NextResponse.json({ error: messageText }, { status: 400 });
  }
}
