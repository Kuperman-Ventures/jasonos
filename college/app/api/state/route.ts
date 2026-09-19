import { NextResponse } from "next/server";
import { seedScores } from "@/lib/content";
import { collegeDb, supabaseConfigured } from "@/lib/db";
import { clampScore } from "@/lib/scores";
import type { Scores } from "@/lib/types";

// Auth: not in v1. This route is the household's shared state and the
// service-role key stays on the server. Before this URL is public, gate it
// to Kyle, Jason, and his wife. Do not create those logins until JasonOS
// row-level rules stop treating every logged-in Supabase user as the owner.

type StateRow = {
  checklist: Record<string, boolean> | null;
  scores: Scores | null;
  notes: string | null;
};

function emptyState() {
  return { persisted: false, checklist: {}, scores: seedScores, notes: "" };
}

export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json(emptyState());
  try {
    const db = collegeDb();
    const { data, error } = await db
      .from("app_state")
      .select("checklist, scores, notes")
      .eq("id", "kyle-college")
      .maybeSingle();
    if (error) throw error;
    const row = data as StateRow | null;
    return NextResponse.json({
      persisted: true,
      checklist: row?.checklist ?? {},
      scores: { ...seedScores, ...(row?.scores ?? {}) },
      notes: row?.notes ?? "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read state";
    return NextResponse.json({ ...emptyState(), error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  // Auth would be checked here before the household is anyone with the URL.
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const body = (await request.json()) as {
    checklist?: Record<string, boolean>;
    scores?: Scores;
    notes?: string;
  };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.checklist && typeof body.checklist === "object") patch.checklist = body.checklist;
  if (body.scores && typeof body.scores === "object") {
    const scores: Scores = {};
    for (const [firmId, criteria] of Object.entries(body.scores)) {
      scores[firmId] = {};
      for (const [criterionId, value] of Object.entries(criteria ?? {})) {
        scores[firmId][criterionId] = clampScore(Number(value));
      }
    }
    patch.scores = scores;
  }
  if (typeof body.notes === "string") patch.notes = body.notes;
  try {
    const db = collegeDb();
    const { error } = await db.from("app_state").update(patch).eq("id", "kyle-college");
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
