import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import {
  listActivity,
  recordActivity,
  type ActivityEntityType,
} from "@/lib/activity-log";

export const runtime = "nodejs";

const ENTITY_TYPES = new Set<ActivityEntityType>([
  "todo",
  "note",
  "calendar",
  "ingest",
  "school",
  "checklist",
  "system",
]);

export async function GET(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  try {
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit") ?? "100");
    const limit = Number.isFinite(rawLimit) ? rawLimit : 100;
    const entries = await listActivity(limit);
    return NextResponse.json({ entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load activity log";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  try {
    const body = (await request.json()) as {
      action?: string;
      entityType?: string;
      entityId?: string | null;
      summary?: string;
      detail?: Record<string, unknown>;
    };
    const action = typeof body.action === "string" ? body.action.trim() : "";
    const summary = typeof body.summary === "string" ? body.summary.trim() : "";
    const entityType =
      typeof body.entityType === "string" && ENTITY_TYPES.has(body.entityType as ActivityEntityType)
        ? (body.entityType as ActivityEntityType)
        : null;
    if (!action || !summary || !entityType) {
      return NextResponse.json(
        { error: "action, entityType, and summary are required" },
        { status: 400 },
      );
    }
    await recordActivity({
      actorId: session.member.id,
      actorName: session.member.displayName,
      action,
      entityType,
      entityId: typeof body.entityId === "string" ? body.entityId : null,
      summary,
      detail: body.detail && typeof body.detail === "object" ? body.detail : {},
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not record activity";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
