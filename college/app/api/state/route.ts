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
import { normalizeCalendarEvents, type CalendarEvent } from "@/lib/calendar-events";
import { normalizePinNotes, type PinNote } from "@/lib/note-board";
import {
  memberOwnerId,
  normalizeTodoEdits,
  normalizeTodoSubtasks,
  sanitizeChecklistForViewer,
  sanitizeSubtasksForViewer,
  todoOwnerIndex,
  type TodoEditMap,
  type TodoSubtaskMap,
} from "@/lib/project-todos";
import { clampScore } from "@/lib/scores";
import type { Scores } from "@/lib/types";

type StateRow = {
  checklist: Record<string, boolean> | null;
  scores: Scores | null;
  notes: string | null;
  project_steps?: unknown;
  ingest_sources?: unknown;
  todo_subtasks?: unknown;
  todo_edits?: unknown;
  note_items?: unknown;
  calendar_events?: unknown;
};

function localDemoPins(): PinNote[] {
  // Anchored to mid-September 2026 so This week / Last week both show.
  return [
    {
      id: "demo-webinar",
      title: "Ron Feuchs webinar — reaches and bandwidth",
      kind: "recording",
      addedBy: "jason",
      createdAt: "2026-09-20T16:00:00.000Z",
      reviewers: ["jason"],
      reviewedBy: [],
      reviewDue: "2026-09-27",
      body: "Building a balanced list",
      host: null,
      url: null,
      pageCount: null,
      durationLabel: "48 min",
      sourceId: null,
      assetUrl: null,
      assetPath: null,
      mimeType: null,
    },
    {
      id: "demo-uw",
      title: "UW direct-to-engineering pathway",
      kind: "website",
      addedBy: "jason",
      createdAt: "2026-09-18T16:00:00.000Z",
      reviewers: [],
      reviewedBy: [],
      reviewDue: null,
      body: "Direct-to-engineering admission is offered to a limited number of first-year applicants…",
      host: "washington.edu",
      url: "https://www.washington.edu/admissions",
      pageCount: null,
      durationLabel: null,
      sourceId: null,
      assetUrl: null,
      assetPath: null,
      mimeType: null,
    },
    {
      id: "demo-prompts",
      title: "Common App essay prompts, 2026–27",
      kind: "document",
      addedBy: "jason",
      createdAt: "2026-09-15T16:00:00.000Z",
      reviewers: ["jason", "kyle"],
      reviewedBy: [],
      reviewDue: null,
      body: "Essay prompts packet",
      host: null,
      url: null,
      pageCount: 4,
      durationLabel: null,
      sourceId: null,
      assetUrl: null,
      assetPath: null,
      mimeType: null,
    },
    {
      id: "demo-testing",
      title: "Testing plan through May",
      kind: "note",
      addedBy: "kyle",
      createdAt: "2026-09-14T16:00:00.000Z",
      reviewers: [],
      reviewedBy: [],
      reviewDue: null,
      body: "PSAT this fall, March SAT, then May SAT. Math is the priority given the engineering focus…",
      host: null,
      url: null,
      pageCount: null,
      durationLabel: null,
      sourceId: null,
      assetUrl: null,
      assetPath: null,
      mimeType: null,
    },
    {
      id: "demo-this-week",
      title: "Questions for the Sep 28 call",
      kind: "note",
      addedBy: "jason",
      createdAt: "2026-09-22T14:00:00.000Z",
      reviewers: [],
      reviewedBy: [],
      reviewDue: null,
      body: "Merit aid timing, whether the résumé goes to every school, summer program deadlines…",
      host: null,
      url: null,
      pageCount: null,
      durationLabel: null,
      sourceId: null,
      assetUrl: null,
      assetPath: null,
      mimeType: null,
    },
  ];
}

function emptyState() {
  return {
    persisted: false,
    checklist: {},
    scores: seedScores,
    notes: "",
    projectSteps: [] as PersistedProjectStep[],
    ingestSources: [] as PersistedIngestSource[],
    todoSubtasks: {} as TodoSubtaskMap,
    todoEdits: {} as TodoEditMap,
    noteItems: localDemoPins(),
    calendarEvents: [] as CalendarEvent[],
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
      .select(
        "checklist, scores, notes, project_steps, ingest_sources, todo_subtasks, todo_edits, note_items, calendar_events",
      )
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
      todoSubtasks: normalizeTodoSubtasks(row?.todo_subtasks),
      todoEdits: normalizeTodoEdits(row?.todo_edits),
      noteItems: normalizePinNotes(row?.note_items),
      calendarEvents: normalizeCalendarEvents(row?.calendar_events),
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
    todoSubtasks?: TodoSubtaskMap;
    todoEdits?: TodoEditMap;
    noteItems?: PinNote[];
    calendarEvents?: CalendarEvent[];
  };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const db = collegeDb();

  const needsOwnerRead =
    (body.checklist && typeof body.checklist === "object") ||
    (body.todoSubtasks && typeof body.todoSubtasks === "object");

  if (needsOwnerRead) {
    const { data: currentRow, error: readError } = await db
      .from("app_state")
      .select("checklist, project_steps, todo_subtasks, todo_edits")
      .eq("id", "kyle-college")
      .maybeSingle();
    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 400 });
    }
    const row = currentRow as StateRow | null;
    const projectSteps = Array.isArray(body.projectSteps)
      ? normalizePersistedSteps(body.projectSteps)
      : normalizePersistedSteps(row?.project_steps);
    const todoEdits =
      body.todoEdits && typeof body.todoEdits === "object"
        ? normalizeTodoEdits(body.todoEdits)
        : normalizeTodoEdits(row?.todo_edits);
    const viewer = memberOwnerId(session.member.id);
    const owners = todoOwnerIndex(projectSteps, todoEdits);

    if (body.checklist && typeof body.checklist === "object") {
      const currentChecklist =
        row?.checklist && typeof row.checklist === "object" ? row.checklist : {};
      const { checklist, blocked } = sanitizeChecklistForViewer(
        currentChecklist,
        body.checklist,
        viewer,
        owners,
      );
      patch.checklist = checklist;
      if (blocked.length) patch._blocked_todo_checks = blocked.length;
    }

    if (body.todoSubtasks && typeof body.todoSubtasks === "object") {
      patch.todo_subtasks = sanitizeSubtasksForViewer(
        normalizeTodoSubtasks(row?.todo_subtasks),
        normalizeTodoSubtasks(body.todoSubtasks),
        viewer,
        owners,
      );
    }
  }

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
  if (body.todoEdits && typeof body.todoEdits === "object") {
    patch.todo_edits = normalizeTodoEdits(body.todoEdits);
  }
  if (Array.isArray(body.noteItems)) patch.note_items = normalizePinNotes(body.noteItems);
  if (Array.isArray(body.calendarEvents)) {
    patch.calendar_events = normalizeCalendarEvents(body.calendarEvents);
  }

  // Don't persist internal meta on the row.
  const blockedCount =
    typeof patch._blocked_todo_checks === "number" ? patch._blocked_todo_checks : 0;
  delete patch._blocked_todo_checks;

  try {
    const { error } = await db.from("app_state").update(patch).eq("id", "kyle-college");
    if (error) throw error;
    return NextResponse.json({
      ok: true,
      ...(blockedCount ? { blockedTodoChecks: blockedCount } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
