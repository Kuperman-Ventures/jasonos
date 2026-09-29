import { NextResponse } from "next/server";
import { requireCollegeSession } from "@/lib/auth";
import { getMemberPrefs, upsertMemberPrefs } from "@/lib/db";
import { mergeListPrefs } from "@/lib/list-phases";

function prefsFromRow(raw: Awaited<ReturnType<typeof getMemberPrefs>>) {
  return mergeListPrefs({
    columnsByPhase: raw.collegesColumns,
    showArchived: raw.showArchived,
    collegesSort: raw.collegesSort,
  });
}

export async function GET() {
  const session = await requireCollegeSession();
  if (session instanceof NextResponse) return session;
  try {
    const raw = await getMemberPrefs(session.member.id);
    return NextResponse.json({ prefs: prefsFromRow(raw), persisted: true });
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
      sortKey?: string;
      sortDir?: 1 | -1;
    };
    const merged = mergeListPrefs({
      columnsByPhase: body.columnsByPhase,
      showArchived: body.showArchived,
      sortKey: body.sortKey,
      sortDir: body.sortDir,
    });
    const saved = await upsertMemberPrefs(session.member.id, {
      collegesColumns: merged.columnsByPhase as Record<string, string[]>,
      showArchived: merged.showArchived,
      collegesSort: { key: merged.sortKey, dir: merged.sortDir },
    });
    return NextResponse.json({ prefs: prefsFromRow(saved), persisted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save prefs" },
      { status: 500 },
    );
  }
}
