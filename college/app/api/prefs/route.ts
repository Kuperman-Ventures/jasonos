import { NextResponse } from "next/server";
import { requireCollegeSession } from "@/lib/auth";
import { getMemberPrefs, upsertMemberPrefs } from "@/lib/db";
import { mergeListPrefs } from "@/lib/list-phases";

export async function GET() {
  const session = await requireCollegeSession();
  if (session instanceof NextResponse) return session;
  try {
    const raw = await getMemberPrefs(session.member.id);
    const prefs = mergeListPrefs({
      columnsByPhase: raw.collegesColumns,
      showArchived: raw.showArchived,
    });
    return NextResponse.json({ prefs, persisted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load prefs" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await requireCollegeSession();
  if (session instanceof NextResponse) return session;
  try {
    const body = (await request.json()) as {
      columnsByPhase?: Record<string, string[]>;
      showArchived?: boolean;
    };
    const merged = mergeListPrefs({
      columnsByPhase: body.columnsByPhase,
      showArchived: body.showArchived,
    });
    const saved = await upsertMemberPrefs(session.member.id, {
      collegesColumns: merged.columnsByPhase as Record<string, string[]>,
      showArchived: merged.showArchived,
    });
    const prefs = mergeListPrefs({
      columnsByPhase: saved.collegesColumns,
      showArchived: saved.showArchived,
    });
    return NextResponse.json({ prefs, persisted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save prefs" },
      { status: 500 },
    );
  }
}
