/** Build the admin nudge catalog from live timeline stages and open to-dos. */

import { adminSiteUrl } from "@/lib/admin";
import { memberInitials } from "@/lib/member-avatars";
import { listProjectTodos } from "@/lib/project-todos";
import {
  formatStageRange,
  resolveProjectStages,
  timelineProjectById,
  TIMELINE_PROJECTS,
  type TimelineStage,
} from "@/lib/timeline-stages";
import type { Owner } from "@/lib/types";
import { isOwner } from "@/lib/types";
import type { PersistedProjectStep } from "@/lib/ingest";
import type { TodoEditMap } from "@/lib/project-todos";
import {
  daysUntilDue,
  defaultPersonOn,
  dueLabel,
  dueTone,
  fallbackBlurb,
  firstName,
  includeOnNudgeTimeline,
  isCurrentWeekMilestone,
  isoInZone,
  NUDGE_NOTE_DEFAULT,
  personSortKey,
  shortMonthDay,
  stageFlagForRange,
  type NudgeCatalog,
  type NudgePerson,
  type NudgeStageItem,
  type NudgeTodoItem,
} from "@/lib/nudge";

export type NudgeMemberInput = {
  id: string;
  displayName: string;
  email: string | null;
  role: string;
  avatarUrl: string | null;
  uiVisible: boolean;
};

function stageSub(stage: TimelineStage): string {
  const range = formatStageRange(stage.start, stage.end);
  const project = timelineProjectById(stage.projectId)?.name ?? stage.projectId;
  return stage.isMilestone ? `Milestone · ${range} · ${project}` : `${range} · ${project}`;
}

export function nudgeStagesFromTimeline(
  stages: TimelineStage[],
  blurbs: Record<string, string>,
  now = new Date(),
): NudgeStageItem[] {
  return stages
    .filter((stage) =>
      includeOnNudgeTimeline(
        { start: stage.start, end: stage.end, isMilestone: stage.isMilestone, done: Boolean(stage.done || stage.completedAt) },
        now,
      ),
    )
    .map((stage) => {
      const flag = stageFlagForRange(stage, now);
      const stored = blurbs[stage.id]?.trim() ?? "";
      return {
        id: stage.id,
        title: stage.name,
        sub: stageSub(stage),
        flag: flag.label,
        hot: flag.hot,
        defaultOn: isCurrentWeekMilestone(stage, now),
        blurb: stored,
      };
    });
}

export function collectTimelineStages(
  checklist: Record<string, boolean>,
  dynamicSteps: PersistedProjectStep[],
  edits: TodoEditMap,
  now = new Date(),
): TimelineStage[] {
  const todos = listProjectTodos(checklist, undefined, dynamicSteps, edits, now);
  const byId = new Map(todos.map((todo) => [todo.id, todo]));
  const completions: Record<string, boolean> = {};
  for (const todo of todos) {
    if (todo.done) completions[todo.id] = true;
  }
  const stages: TimelineStage[] = [];
  for (const project of TIMELINE_PROJECTS) {
    stages.push(...resolveProjectStages(project.id, todos, completions));
  }
  return stages.map((stage) => {
    const todo = byId.get(stage.id);
    return todo?.label ? { ...stage, name: todo.label } : stage;
  });
}

export function openNudgeTodos(
  checklist: Record<string, boolean>,
  dynamicSteps: PersistedProjectStep[],
  edits: TodoEditMap,
  people: NudgePerson[],
  blurbs: Record<string, string>,
  now = new Date(),
): NudgeTodoItem[] {
  const todos = listProjectTodos(checklist, undefined, dynamicSteps, edits, now);
  const owners = new Set(people.map((person) => person.id));
  const rows: NudgeTodoItem[] = [];
  for (const todo of todos) {
    if (todo.kind === "family_meeting") {
      for (const person of people) {
        if (!isOwner(person.id)) continue;
        if (todo.doneBy.includes(person.id as Owner)) continue;
        rows.push(todoRow(todo.id, person.id, todo.label, todo.dueDate, blurbs, now));
      }
      continue;
    }
    if (todo.done) continue;
    if (!todo.owner || !owners.has(todo.owner)) continue;
    rows.push(todoRow(todo.id, todo.owner, todo.label, todo.dueDate, blurbs, now));
  }
  return rows;
}

function todoRow(
  id: string,
  ownerId: string,
  title: string,
  dueDate: string | null,
  blurbs: Record<string, string>,
  now: Date,
): NudgeTodoItem {
  const days = daysUntilDue(dueDate, now);
  return {
    id,
    ownerId,
    title,
    dateLabel: dueDate ? shortMonthDay(dueDate) : "—",
    dueLabel: dueLabel(days),
    daysUntil: days,
    tone: dueTone(days),
    defaultOn: days != null && days <= 7,
    blurb: blurbs[id]?.trim() || "",
  };
}

export function toNudgePeople(members: NudgeMemberInput[]): NudgePerson[] {
  return members
    .filter((member) => member.uiVisible && member.role !== "guest")
    .map((member) => ({
      id: member.id,
      name: member.displayName,
      firstName: firstName(member.displayName),
      initials: memberInitials(member.displayName),
      email: member.email,
      role: member.role,
      avatarUrl: member.avatarUrl,
      defaultOn: defaultPersonOn(member.role),
    }))
    .sort((a, b) => personSortKey(a.role, a.name).localeCompare(personSortKey(b.role, b.name)));
}

export function buildNudgeCatalog(input: {
  members: NudgeMemberInput[];
  checklist: Record<string, boolean>;
  projectSteps: PersistedProjectStep[];
  todoEdits: TodoEditMap;
  blurbs: Record<string, string>;
  now?: Date;
  siteUrl?: string;
}): NudgeCatalog {
  const now = input.now ?? new Date();
  const people = toNudgePeople(input.members);
  const stages = collectTimelineStages(input.checklist, input.projectSteps, input.todoEdits, now);
  return {
    people,
    stages: nudgeStagesFromTimeline(stages, input.blurbs, now),
    todos: openNudgeTodos(input.checklist, input.projectSteps, input.todoEdits, people, input.blurbs, now),
    noteDefault: input.blurbs.opening?.trim() || NUDGE_NOTE_DEFAULT,
    trackerBase: input.siteUrl ?? adminSiteUrl(),
  };
}

export function blurbOrFallback(stored: string, title: string): string {
  return stored.trim() || fallbackBlurb(title);
}

export function catalogTodayLabel(now = new Date()): string {
  return isoInZone(now);
}

export async function loadLiveNudgeCatalog(now = new Date()): Promise<NudgeCatalog> {
  const { collegeDb, supabaseConfigured } = await import("@/lib/db");
  const { resolveMemberAvatarUrl } = await import("@/lib/member-avatars");
  const { normalizePersistedSteps } = await import("@/lib/ingest");
  const { normalizeTodoEdits } = await import("@/lib/project-todos");
  const { loadNudgeBlurbs } = await import("@/lib/nudge-store");

  if (!supabaseConfigured()) {
    return buildNudgeCatalog({
      members: [
        { id: "kyle", displayName: "Kyle", email: "kyle@example.com", role: "student", avatarUrl: null, uiVisible: true },
        { id: "kat", displayName: "Kat", email: "kat@example.com", role: "parent", avatarUrl: null, uiVisible: true },
        { id: "jason", displayName: "Jason", email: "jason@example.com", role: "super_admin", avatarUrl: null, uiVisible: true },
      ],
      checklist: {},
      projectSteps: [],
      todoEdits: {},
      blurbs: {},
      now,
    });
  }

  const db = collegeDb();
  const [{ data: state, error: stateError }, { data: members, error: memberError }, blurbs] = await Promise.all([
    db.from("app_state").select("checklist, project_steps, todo_edits").eq("id", "kyle-college").maybeSingle(),
    db.from("members").select("id, email, display_name, role, ui_visible, avatar_path, oauth_avatar_url").order("display_name"),
    loadNudgeBlurbs(),
  ]);
  if (stateError) throw stateError;
  if (memberError) throw memberError;
  const row = (state ?? {}) as { checklist?: Record<string, boolean> | null; project_steps?: unknown; todo_edits?: unknown };
  return buildNudgeCatalog({
    members: (members ?? []).map((member) => ({
      id: member.id as string,
      displayName: (member.display_name as string) || (member.id as string),
      email: (member.email as string | null) ?? null,
      role: (member.role as string) || "guest",
      avatarUrl: resolveMemberAvatarUrl(
        (member.avatar_path as string | null) ?? null,
        (member.oauth_avatar_url as string | null) ?? null,
      ),
      uiVisible: Boolean(member.ui_visible),
    })),
    checklist: row.checklist && typeof row.checklist === "object" ? row.checklist : {},
    projectSteps: normalizePersistedSteps(row.project_steps),
    todoEdits: normalizeTodoEdits(row.todo_edits),
    blurbs,
    now,
  });
}
