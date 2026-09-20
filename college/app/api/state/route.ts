import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { seedScores } from "@/lib/content";
import { collegeDb, supabaseConfigured } from "@/lib/db";
import {
  normalizeIngestSources,
  normalizePersistedSteps,
  type PersistedIngestSource,
  type PersistedProjectStep,
} from "@/lib/ingest";
import { clampScore } from "@/lib/scores";
import type { Scores } from "@/lib/types";

type StateRow = {
  checklist: Record<string, boolean> | null;
  scores: Scores | null;
  notes: string | null;
  project_steps?: unknown;
  ingest_sources?: unknown;
};

function emptyState() {
  return {
    persisted: false,
    checklist: {},
    scores: seedScores,
    notes: "",
    projectSteps: [] as PersistedProjectStep[],
    ingestSources: [] as PersistedIngestSource[],
  };
}

export async function GET() {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) return NextResponse.json(emptyState());
  try {
    const db = collegeDb();
    const { data, error } = await db
      .from("app_state")
      .select("checklist, scores, notes, project_steps, ingest_sources")
      .eq("id", "kyle-college")
      .maybeSingle();
    if (error) throw error;
    const row = data as StateRow | null;
    return NextResponse.json({
      persisted: true,
      checklist: row?.checklist ?? {},
      scores: { ...seedScores, ...(row?.scores ?? {}) },
      notes: row?.notes ?? "",
      projectSteps: normalizePersistedSteps(row?.project_steps),
      ingestSources: normalizeIngestSources(row?.ingest_sources),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read state";
    return NextResponse.json({ ...emptyState(), error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const body = (await request.json()) as {
    checklist?: Record<string, boolean>;
    scores?: Scores;
    notes?: string;
    projectSteps?: PersistedProjectStep[];
    ingestSources?: PersistedIngestSource[];
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
  if (Array.isArray(body.projectSteps)) patch.project_steps = normalizePersistedSteps(body.projectSteps);
  if (Array.isArray(body.ingestSources)) patch.ingest_sources = normalizeIngestSources(body.ingestSources);
  try {
    const db = collegeDb();
    const { error } = await db.from("app_state").update(patch).eq("id", "kyle-college");
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
