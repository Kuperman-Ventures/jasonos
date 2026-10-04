/** Nested checklist steps — the assignable to-dos under parent runway items. */

import stepsFile from "@/content/checklist-steps.json";
import { phases } from "@/lib/content";
import {
  FAMILY_MEETING_KIND,
  familyMeetingFullyDone,
  isFamilyMeetingKind,
  isTodoKind,
  nextFamilyMeetingDate,
  normalizeDoneBy,
  type TodoKind,
} from "@/lib/family-meeting";
import { INBOX_PARENT_ID, type PersistedProjectStep } from "@/lib/ingest";
import { OWNERS, formatDate, isOwner, ownerLabel, type Owner, type Phase } from "@/lib/types";

export type { TodoKind } from "@/lib/family-meeting";
export { FAMILY_MEETING_KIND } from "@/lib/family-meeting";

export type ChecklistStepSeed = {
  id: string;
  label: string;
  owner: Owner;
  dueDate: string | null;
  startDate: string | null;
  endDate: string | null;
};

export type ChecklistStepGroupSeed = {
  parentId: string;
  steps: ChecklistStepSeed[];
};

export type ProjectTodo = {
  id: string;
  label: string;
  /** Free-text note under the wording. Empty when nobody has written one. */
  description: string;
  /** null = unclaimed — sitting in the shared pool until someone claims or is assigned. */
  owner: Owner | null;
  /** Who put this on the owner's list; null when seed/system, unclaimed, or self-claimed. */
  assignedBy: Owner | null;
  dueDate: string | null;
  startDate: string | null;
  endDate: string | null;
  done: boolean;
  parentId: string;
  parentText: string;
  phase: string;
  phaseWindow: string;
  /** Household project grouping — orthogonal to runway parentId. */
  projectId: string | null;
  /** School this to-do was sent from (Project Management Notes). */
  schoolId: string | null;
  /** Household category. Family-meeting rows appear on every person's list. */
  kind: TodoKind;
  /** Who has marked a family-meeting item discussed. Empty for normal to-dos. */
  doneBy: Owner[];
};

/** Household overrides for seed and ingested to-dos. Missing keys keep the original. */
export type TodoEdit = {
  label?: string;
  description?: string;
  dueDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  /** Set to an owner, or null to move into Unclaimed. */
  owner?: Owner | null;
  assignedBy?: Owner | null;
  /** Soft-delete seed (and any) to-dos so they leave every list. */
  deleted?: boolean;
  /** Household project id, or null for "No project". */
  projectId?: string | null;
  /** Set to family_meeting to put it on every list and the next family agenda. */
  kind?: TodoKind;
  /** Per-person acks for family-meeting items. */
  doneBy?: Owner[];
};

export type TodoEditMap = Record<string, TodoEdit>;

export type TodoSubtask = {
  id: string;
  label: string;
  dueDate: string | null;
  /** Inclusive start (YYYY-MM-DD). When set with projectId, this row can drive Timeline stages. */
  startDate: string | null;
  endDate: string | null;
  /** Household project this stage belongs to (roadmap track id or TodoProject id). */
  projectId: string | null;
  phase: string | null;
  isMilestone: boolean;
  /** When set, overrides date-derived status → done. */
  completedAt: string | null;
  done: boolean;
};

export type TodoSubtaskMap = Record<string, TodoSubtask[]>;

type ParentLookup = {
  parentText: string;
  phase: string;
  phaseWindow: string;
};

function parentIndex(phaseList: Phase[] = phases): Map<string, ParentLookup> {
  const map = new Map<string, ParentLookup>();
  map.set(INBOX_PARENT_ID, {
    parentText: "Ingested — not filed under a runway item yet",
    phase: "Inbox",
    phaseWindow: "As needed",
  });
  for (const phase of phaseList) {
    for (const item of phase.items) {
      map.set(item.id, {
        parentText: item.text,
        phase: phase.phase,
        phaseWindow: phase.window,
      });
    }
  }
  return map;
}

export function memberOwnerId(memberId: string): Owner {
  if (isOwner(memberId)) return memberId;
  return "jason";
}

/** Only the person whose list it is can mark a to-do done. Unclaimed items must be claimed first. */
export function canMarkTodoDone(
  viewer: Owner,
  todoOwner: Owner | null,
  kind: TodoKind = "normal",
): boolean {
  if (kind === FAMILY_MEETING_KIND) return true;
  return todoOwner != null && viewer === todoOwner;
}

export function isFamilyMeetingTodo(todo: { kind?: TodoKind | string | null }): boolean {
  return isFamilyMeetingKind(todo.kind);
}

/** Family-meeting items count as done on a person's list only after that person acks. */
export function todoDoneForOwner(
  todo: Pick<ProjectTodo, "kind" | "done" | "doneBy">,
  owner: Owner,
): boolean {
  if (todo.kind === FAMILY_MEETING_KIND) return todo.doneBy.includes(owner);
  return todo.done;
}

/** Badge text when someone else put the item on this list. */
export function assignedByBadge(todo: Pick<ProjectTodo, "owner" | "assignedBy">): string | null {
  if (!todo.owner || !todo.assignedBy || todo.assignedBy === todo.owner) return null;
  return `From ${ownerLabel(todo.assignedBy)}`;
}

function resolveTodoKind(
  stepKind: unknown,
  edit: TodoEdit | undefined,
): TodoKind {
  if (edit?.kind && isTodoKind(edit.kind)) return edit.kind;
  if (isTodoKind(stepKind)) return stepKind;
  return "normal";
}

/** Owner lookup for seed + dynamic to-dos (used for check-off ACL). Family-meeting ids are omitted. */
export function todoOwnerIndex(
  dynamicSteps: PersistedProjectStep[] = [],
  edits: TodoEditMap = {},
): Map<string, Owner> {
  const familyIds = familyMeetingIdSet(dynamicSteps, edits);
  const map = new Map<string, Owner>();
  const groups = stepsFile as ChecklistStepGroupSeed[];
  for (const group of groups) {
    for (const step of group.steps) {
      if (familyIds.has(step.id)) continue;
      if (isOwner(step.owner)) map.set(step.id, step.owner);
    }
  }
  for (const step of dynamicSteps) {
    if (familyIds.has(step.id)) continue;
    map.set(step.id, step.owner);
  }
  for (const [id, edit] of Object.entries(edits)) {
    if (familyIds.has(id)) {
      map.delete(id);
      continue;
    }
    if (!("owner" in edit)) continue;
    if (edit.owner == null) map.delete(id);
    else if (isOwner(edit.owner)) map.set(id, edit.owner);
  }
  return map;
}

/** Ids whose current kind is family meeting (step or edit). */
export function familyMeetingIdSet(
  dynamicSteps: PersistedProjectStep[] = [],
  edits: TodoEditMap = {},
): Set<string> {
  const ids = new Set<string>();
  for (const step of dynamicSteps) {
    if (resolveTodoKind(step.kind, edits[step.id]) === FAMILY_MEETING_KIND) ids.add(step.id);
  }
  for (const [id, edit] of Object.entries(edits)) {
    if (edit.kind === FAMILY_MEETING_KIND) ids.add(id);
    if (edit.kind === "normal") ids.delete(id);
  }
  return ids;
}

/**
 * Strip illegal check-off flips from a checklist patch.
 * Shared runway/timeline ids (not in the todo owner map) stay editable by anyone.
 */
export function sanitizeChecklistForViewer(
  current: Record<string, boolean>,
  next: Record<string, boolean>,
  viewer: Owner,
  owners: Map<string, Owner>,
  familyIds: Set<string> = new Set(),
): { checklist: Record<string, boolean>; blocked: string[] } {
  const checklist = { ...next };
  const blocked: string[] = [];
  const ids = new Set([...Object.keys(current), ...Object.keys(next)]);
  for (const id of ids) {
    const before = Boolean(current[id]);
    const after = Boolean(next[id]);
    if (before === after) continue;
    if (familyIds.has(id)) {
      blocked.push(id);
      if (before) checklist[id] = true;
      else delete checklist[id];
      continue;
    }
    const owner = owners.get(id);
    if (owner && !canMarkTodoDone(viewer, owner)) {
      blocked.push(id);
      if (before) checklist[id] = true;
      else delete checklist[id];
    }
  }
  return { checklist, blocked };
}

/**
 * Anyone can retitle/assign, but only the viewer may flip their own family-meeting ack.
 */
export function sanitizeTodoEditsForViewer(
  current: TodoEditMap,
  next: TodoEditMap,
  viewer: Owner,
): TodoEditMap {
  const out: TodoEditMap = { ...next };
  const ids = new Set([...Object.keys(current), ...Object.keys(next)]);
  for (const id of ids) {
    const before = current[id];
    const after = next[id];
    if (!after) continue;
    const prevDone = new Set(normalizeDoneBy(before?.doneBy));
    const nextDone = new Set(normalizeDoneBy(after.doneBy ?? before?.doneBy));
    const merged = OWNERS.map((owner) => owner.id).filter((ownerId) => {
      if (ownerId === viewer) return nextDone.has(ownerId);
      return prevDone.has(ownerId);
    });
    if (after.doneBy !== undefined || before?.doneBy !== undefined) {
      out[id] = { ...after, doneBy: merged };
    }
  }
  return normalizeTodoEdits(out);
}

export function formatTodoWhen(todo: Pick<ProjectTodo, "dueDate" | "startDate" | "endDate">): string {
  const due = todoPrimaryDate(todo);
  if (todo.startDate && due) {
    return `${formatDate(todo.startDate)} – ${formatDate(due)}`;
  }
  if (due) return formatDate(due);
  return "No date";
}

function dateSortValue(todo: ProjectTodo): number {
  const key = todoPrimaryDate(todo);
  return key ? Date.parse(key) : Number.POSITIVE_INFINITY;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function cleanDate(value: unknown): string | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value === "string" && ISO_DATE.test(value)) return value;
  return undefined;
}

export function normalizeTodoEdits(raw: unknown): TodoEditMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: TodoEditMap = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!id || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const edit: TodoEdit = {};
    if (typeof row.label === "string" && row.label.trim()) edit.label = row.label.trim();
    if (typeof row.description === "string") edit.description = row.description.trim();
    const dueDate = cleanDate(row.dueDate);
    const startDate = cleanDate(row.startDate);
    const endDate = cleanDate(row.endDate);
    if (dueDate !== undefined) edit.dueDate = dueDate;
    if (startDate !== undefined) edit.startDate = startDate;
    if (endDate !== undefined) edit.endDate = endDate;
    if ("owner" in row) {
      if (row.owner === null || row.owner === "") edit.owner = null;
      else if (typeof row.owner === "string" && isOwner(row.owner)) edit.owner = row.owner;
    }
    if ("assignedBy" in row) {
      if (row.assignedBy === null || row.assignedBy === "") edit.assignedBy = null;
      else if (typeof row.assignedBy === "string" && isOwner(row.assignedBy)) {
        edit.assignedBy = row.assignedBy;
      }
    }
    if (row.deleted === true) edit.deleted = true;
    if ("projectId" in row) {
      if (row.projectId === null || row.projectId === "") edit.projectId = null;
      else if (typeof row.projectId === "string" && row.projectId.trim()) {
        edit.projectId = row.projectId.trim();
      }
    }
    if (isTodoKind(row.kind)) edit.kind = row.kind;
    if ("doneBy" in row) edit.doneBy = normalizeDoneBy(row.doneBy);
    if (Object.keys(edit).length) out[id] = edit;
  }
  return out;
}

function withEdit(
  step: {
    id: string;
    label: string;
    owner: Owner;
    assignedBy: Owner | null;
    dueDate: string | null;
    startDate: string | null;
    endDate: string | null;
    parentId: string;
    kind?: TodoKind;
    doneBy?: Owner[];
  },
  edits: TodoEditMap,
) {
  const edit = edits[step.id];
  const kind = resolveTodoKind(step.kind, edit);
  const doneBy = normalizeDoneBy(edit?.doneBy ?? step.doneBy);
  if (!edit) {
    return {
      ...step,
      description: "",
      owner: step.owner as Owner | null,
      projectId: null as string | null,
      kind,
      doneBy,
    };
  }
  return {
    ...step,
    label: edit.label?.trim() || step.label,
    description: edit.description ?? "",
    owner: "owner" in edit ? (edit.owner ?? null) : step.owner,
    assignedBy: "assignedBy" in edit ? (edit.assignedBy ?? null) : step.assignedBy,
    dueDate: "dueDate" in edit ? (edit.dueDate ?? null) : step.dueDate,
    startDate: "startDate" in edit ? (edit.startDate ?? null) : step.startDate,
    endDate: "endDate" in edit ? (edit.endDate ?? null) : step.endDate,
    projectId: "projectId" in edit ? (edit.projectId ?? null) : null,
    kind,
    doneBy,
  };
}

function pushTodo(
  todos: ProjectTodo[],
  seen: Set<string>,
  step: {
    id: string;
    label: string;
    owner: Owner;
    assignedBy: Owner | null;
    dueDate: string | null;
    startDate: string | null;
    endDate: string | null;
    parentId: string;
    schoolId?: string | null;
    kind?: TodoKind;
    doneBy?: Owner[];
  },
  checklist: Record<string, boolean>,
  parents: Map<string, ParentLookup>,
  edits: TodoEditMap,
  now: Date,
) {
  if (seen.has(step.id)) return;
  if (edits[step.id]?.deleted) return;
  const parent = parents.get(step.parentId) ?? parents.get(INBOX_PARENT_ID);
  if (!parent) return;
  const edited = withEdit(step, edits);
  const isFamily = edited.kind === FAMILY_MEETING_KIND;
  const doneBy = isFamily ? edited.doneBy : [];
  const fullyDone = isFamily ? familyMeetingFullyDone(doneBy) : Boolean(checklist[step.id]);
  const meetingDate = isFamily ? (fullyDone ? edited.dueDate : nextFamilyMeetingDate(now)) : null;
  seen.add(step.id);
  todos.push({
    id: edited.id,
    label: edited.label,
    description: edited.description,
    owner: isFamily ? null : edited.owner,
    assignedBy: edited.assignedBy,
    dueDate: isFamily ? meetingDate : edited.dueDate,
    startDate: isFamily ? null : edited.startDate,
    endDate: isFamily ? meetingDate : edited.endDate,
    done: fullyDone,
    parentId: edited.parentId,
    parentText: parent.parentText,
    phase: parent.phase,
    phaseWindow: parent.phaseWindow,
    projectId: edited.projectId,
    schoolId: step.schoolId ?? null,
    kind: edited.kind,
    doneBy,
  });
}

export function listProjectTodos(
  checklist: Record<string, boolean>,
  phaseList: Phase[] = phases,
  dynamicSteps: PersistedProjectStep[] = [],
  edits: TodoEditMap = {},
  now: Date = new Date(),
): ProjectTodo[] {
  const parents = parentIndex(phaseList);
  const groups = stepsFile as ChecklistStepGroupSeed[];
  const todos: ProjectTodo[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    for (const step of group.steps) {
      if (!isOwner(step.owner)) continue;
      pushTodo(
        todos,
        seen,
        {
          id: step.id,
          label: step.label,
          owner: step.owner,
          assignedBy: null,
          dueDate: step.dueDate,
          startDate: step.startDate,
          endDate: step.endDate,
          parentId: group.parentId,
        },
        checklist,
        parents,
        edits,
        now,
      );
    }
  }

  for (const step of dynamicSteps) {
    pushTodo(
      todos,
      seen,
      {
        id: step.id,
        label: step.label,
        owner: step.owner,
        assignedBy: step.assignedBy,
        dueDate: step.dueDate,
        startDate: step.startDate,
        endDate: step.endDate,
        parentId: step.parentId,
        schoolId: step.schoolId ?? null,
        kind: step.kind,
        doneBy: step.doneBy,
      },
      checklist,
      parents,
      edits,
      now,
    );
  }

  return todos.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return dateSortValue(a) - dateSortValue(b) || a.label.localeCompare(b.label);
  });
}

export type OwnerTodoBucket = {
  owner: Owner;
  label: string;
  open: ProjectTodo[];
  done: ProjectTodo[];
};

export type UnclaimedTodoBucket = {
  open: ProjectTodo[];
  done: ProjectTodo[];
};

/** Build the assignment patch when claiming or assigning a to-do. */
export function assignmentPatch(
  viewer: Owner,
  nextOwner: Owner | null,
): Pick<TodoEdit, "owner" | "assignedBy"> {
  if (nextOwner == null) return { owner: null, assignedBy: null };
  if (nextOwner === viewer) return { owner: nextOwner, assignedBy: null };
  return { owner: nextOwner, assignedBy: viewer };
}

/** Convert a to-do to or from the family-meeting category. */
export function familyMeetingKindPatch(
  viewer: Owner,
  kind: TodoKind,
  now: Date = new Date(),
): TodoEdit {
  if (kind === FAMILY_MEETING_KIND) {
    const meeting = nextFamilyMeetingDate(now);
    return {
      kind: FAMILY_MEETING_KIND,
      owner: null,
      assignedBy: viewer,
      dueDate: meeting,
      endDate: meeting,
    };
  }
  return {
    kind: "normal",
    doneBy: [],
    ...assignmentPatch(viewer, viewer),
  };
}

/** Remove a dynamic step and clear related maps; soft-delete seed rows via edits. */
export function removeProjectTodoState(
  id: string,
  projectSteps: PersistedProjectStep[],
  edits: TodoEditMap,
  subtasks: TodoSubtaskMap,
  checklist: Record<string, boolean>,
): {
  projectSteps: PersistedProjectStep[];
  todoEdits: TodoEditMap;
  todoSubtasks: TodoSubtaskMap;
  checklist: Record<string, boolean>;
} {
  const nextSteps = projectSteps.filter((step) => step.id !== id);
  const nextEdits = { ...edits, [id]: { ...edits[id], deleted: true } };
  const nextSubtasks = { ...subtasks };
  delete nextSubtasks[id];
  const nextChecklist = { ...checklist };
  delete nextChecklist[id];
  return {
    projectSteps: nextSteps,
    todoEdits: normalizeTodoEdits(nextEdits),
    todoSubtasks: nextSubtasks,
    checklist: nextChecklist,
  };
}

export function groupTodosByOwner(
  todos: ProjectTodo[],
  focusOwner: Owner,
): { mine: OwnerTodoBucket; others: OwnerTodoBucket[]; unclaimed: UnclaimedTodoBucket } {
  const byOwner = new Map<Owner, ProjectTodo[]>();
  for (const owner of OWNERS) byOwner.set(owner.id, []);
  const unclaimedRows: ProjectTodo[] = [];
  for (const todo of todos) {
    if (todo.kind === FAMILY_MEETING_KIND) {
      for (const owner of OWNERS) {
        const list = byOwner.get(owner.id) ?? [];
        list.push(todo);
        byOwner.set(owner.id, list);
      }
      continue;
    }
    if (!todo.owner) {
      unclaimedRows.push(todo);
      continue;
    }
    const list = byOwner.get(todo.owner) ?? [];
    list.push(todo);
    byOwner.set(todo.owner, list);
  }

  function bucket(owner: Owner): OwnerTodoBucket {
    const all = byOwner.get(owner) ?? [];
    return {
      owner,
      label: ownerLabel(owner),
      open: all.filter((todo) => !todoDoneForOwner(todo, owner)),
      done: all.filter((todo) => todoDoneForOwner(todo, owner)),
    };
  }

  return {
    mine: bucket(focusOwner),
    others: OWNERS.filter((owner) => owner.id !== focusOwner).map((owner) => bucket(owner.id)),
    unclaimed: {
      open: unclaimedRows.filter((todo) => !todo.done),
      done: unclaimedRows.filter((todo) => todo.done),
    },
  };
}

export type TodoProjectGroup = {
  projectId: string | null;
  name: string;
  colorIndex: number | null;
  open: ProjectTodo[];
  done: ProjectTodo[];
};

/** Projects in creation order, then No project last. */
export function groupTodosByProject(
  todos: ProjectTodo[],
  projects: { id: string; name: string; colorIndex: number; createdAt: string }[],
): TodoProjectGroup[] {
  const ordered = [...projects].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name),
  );
  const known = new Set(ordered.map((p) => p.id));
  const groups: TodoProjectGroup[] = ordered.map((project) => {
    const rows = todos.filter((todo) => todo.projectId === project.id);
    return {
      projectId: project.id,
      name: project.name,
      colorIndex: project.colorIndex,
      open: rows.filter((todo) => !todo.done),
      done: rows.filter((todo) => todo.done),
    };
  });
  const none = todos.filter((todo) => !todo.projectId || !known.has(todo.projectId));
  groups.push({
    projectId: null,
    name: "No project",
    colorIndex: null,
    open: none.filter((todo) => !todo.done),
    done: none.filter((todo) => todo.done),
  });
  return groups;
}

/** Clear projectId from edits when a project is deleted. Never deletes to-dos. */
export function clearProjectIdFromEdits(projectId: string, edits: TodoEditMap): TodoEditMap {
  const next: TodoEditMap = { ...edits };
  for (const [id, edit] of Object.entries(edits)) {
    if (edit.projectId === projectId) {
      next[id] = { ...edit, projectId: null };
    }
  }
  return next;
}

export function normalizeTodoSubtasks(raw: unknown): TodoSubtaskMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: TodoSubtaskMap = {};
  for (const [parentId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!parentId || !Array.isArray(value)) continue;
    const rows: TodoSubtask[] = [];
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (typeof row.id !== "string" || typeof row.label !== "string") continue;
      const label = row.label.trim();
      if (!label) continue;
      rows.push({
        id: row.id,
        label,
        dueDate: typeof row.dueDate === "string" && ISO_DATE.test(row.dueDate) ? row.dueDate : null,
        startDate:
          typeof row.startDate === "string" && ISO_DATE.test(row.startDate) ? row.startDate : null,
        endDate: typeof row.endDate === "string" && ISO_DATE.test(row.endDate) ? row.endDate : null,
        projectId:
          typeof row.projectId === "string" && row.projectId.trim() ? row.projectId.trim() : null,
        phase: typeof row.phase === "string" && row.phase.trim() ? row.phase.trim() : null,
        isMilestone: Boolean(row.isMilestone),
        completedAt:
          typeof row.completedAt === "string" && ISO_DATE.test(row.completedAt)
            ? row.completedAt
            : null,
        done: Boolean(row.done),
      });
    }
    if (rows.length) out[parentId] = rows;
  }
  return out;
}

/** Non-owners may add subtasks but cannot flip done. */
export function sanitizeSubtasksForViewer(
  current: TodoSubtaskMap,
  next: TodoSubtaskMap,
  viewer: Owner,
  owners: Map<string, Owner>,
): TodoSubtaskMap {
  const parentIds = new Set([...Object.keys(current), ...Object.keys(next)]);
  const out: TodoSubtaskMap = {};
  for (const parentId of parentIds) {
    const owner = owners.get(parentId);
    const before = current[parentId] ?? [];
    const after = next[parentId] ?? [];
    if (!owner || canMarkTodoDone(viewer, owner)) {
      if (after.length) out[parentId] = after;
      continue;
    }
    const beforeDone = new Map(before.map((row) => [row.id, row.done]));
    const merged = after.map((row) => ({
      ...row,
      done: beforeDone.has(row.id) ? Boolean(beforeDone.get(row.id)) : false,
    }));
    if (merged.length) out[parentId] = merged;
  }
  return out;
}

/** List/sort date: end date is the due date by default; never fall back to start. */
export function todoPrimaryDate(todo: Pick<ProjectTodo, "dueDate" | "startDate" | "endDate">): string | null {
  return todo.endDate ?? todo.dueDate ?? null;
}

export function shortDueLabel(iso: string | null): string {
  if (!iso || !ISO_DATE.test(iso)) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return "—";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Local calendar day for an ISO date (yyyy-mm-dd), ignoring time zone of the ISO string. */
function localDayFromIso(iso: string): Date | null {
  if (!ISO_DATE.test(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function startOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Overdue = primary due date before today in local TZ.
 * Due today is not overdue. Undated is never overdue.
 */
export function isTodoOverdue(
  todo: Pick<ProjectTodo, "dueDate" | "startDate" | "endDate" | "done">,
  now: Date = new Date(),
): boolean {
  if (todo.done) return false;
  const iso = todoPrimaryDate(todo);
  if (!iso) return false;
  const due = localDayFromIso(iso);
  if (!due) return false;
  return due.getTime() < startOfLocalDay(now).getTime();
}

/** dated = has a date; soon = due within 7 days incl. today; over = past due (wins over soon). */
export function dueTone(
  iso: string | null,
  now: Date = new Date(),
): "dated" | "soon" | "over" | "undated" {
  if (!iso) return "undated";
  const due = localDayFromIso(iso);
  if (!due) return "undated";
  const start = startOfLocalDay(now);
  const days = Math.round((due.getTime() - start.getTime()) / 86_400_000);
  if (days < 0) return "over";
  if (days <= 7) return "soon";
  return "dated";
}

export type PersonMeterRow = {
  owner: Owner;
  label: string;
  total: number;
  overdue: number;
};

/**
 * One meter row per family member, me-first (Person view order). Includes zeros.
 * Counts open to-dos only; overdue uses local calendar before today.
 */
export function personMeterRows(
  todos: ProjectTodo[],
  focusOwner: Owner,
  now: Date = new Date(),
): PersonMeterRow[] {
  const order: Owner[] = [focusOwner, ...OWNERS.filter((owner) => owner.id !== focusOwner).map((o) => o.id)];
  return order.map((owner) => {
    const open = todos.filter((todo) => {
      if (todo.kind === FAMILY_MEETING_KIND) return !todo.doneBy.includes(owner);
      return !todo.done && todo.owner === owner;
    });
    return {
      owner,
      label: ownerLabel(owner),
      total: open.length,
      overdue: open.filter((todo) => isTodoOverdue(todo, now)).length,
    };
  });
}

/** Max open total across meter rows (at least 1 so bar math stays finite). */
export function personMeterMax(rows: PersonMeterRow[]): number {
  return Math.max(1, ...rows.map((row) => row.total));
}

export function openListStats(todos: ProjectTodo[]): { open: number; dated: number; label: string } {
  const openTodos = todos.filter((todo) => !todo.done);
  const dated = openTodos.filter((todo) => todoPrimaryDate(todo)).length;
  return {
    open: openTodos.length,
    dated,
    label: `${openTodos.length} open · ${dated} dated`,
  };
}

/**
 * Put a timeline stage on someone's to-do list (or reassign / clear it).
 * Uses the stage id as the to-do id so checklist completion stays in sync.
 * Pass `owner: null` to remove the stage from every list.
 */
export function upsertStageAssignment(
  stage: {
    id: string;
    name: string;
    start: string;
    end: string;
    projectId: string;
  },
  owner: Owner | null,
  assignedBy: Owner,
  projectSteps: PersistedProjectStep[],
  edits: TodoEditMap,
): { projectSteps: PersistedProjectStep[]; todoEdits: TodoEditMap } {
  const existing = projectSteps.find((step) => step.id === stage.id);
  const prior = edits[stage.id] ?? {};

  if (owner == null) {
    if (!existing && !edits[stage.id]) {
      return { projectSteps, todoEdits: edits };
    }
    const nextSteps = projectSteps.filter((row) => row.id !== stage.id);
    const nextEdits = normalizeTodoEdits({
      ...edits,
      [stage.id]: {
        ...prior,
        deleted: true,
        owner: null,
        assignedBy: null,
      },
    });
    return { projectSteps: nextSteps, todoEdits: nextEdits };
  }

  const assignMeta = assignmentPatch(assignedBy, owner);
  const step: PersistedProjectStep = {
    id: stage.id,
    label: stage.name,
    owner,
    assignedBy: assignMeta.assignedBy ?? null,
    parentId: INBOX_PARENT_ID,
    dueDate: stage.end,
    startDate: stage.start,
    endDate: stage.end,
    sourceId: null,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  const nextSteps = existing
    ? projectSteps.map((row) => (row.id === stage.id ? step : row))
    : [...projectSteps, step];
  const nextEdits = normalizeTodoEdits({
    ...edits,
    [stage.id]: {
      ...prior,
      deleted: false,
      owner,
      assignedBy: assignMeta.assignedBy ?? null,
      dueDate: stage.end,
      startDate: stage.start,
      endDate: stage.end,
      projectId: stage.projectId,
      label: stage.name,
    },
  });
  return { projectSteps: nextSteps, todoEdits: nextEdits };
}

/** Owner currently assigned to a stage to-do, if any. */
export function stageOwnerFromTodos(
  stageId: string,
  checklist: Record<string, boolean>,
  projectSteps: PersistedProjectStep[],
  edits: TodoEditMap,
): Owner | null {
  const todo = listProjectTodos(checklist, phases, projectSteps, edits).find(
    (row) => row.id === stageId,
  );
  return todo?.owner ?? null;
}

/** Map of stage/todo id → current owner for timeline assign UI. */
export function stageOwnerMap(
  checklist: Record<string, boolean>,
  projectSteps: PersistedProjectStep[],
  edits: TodoEditMap,
): Record<string, Owner> {
  const out: Record<string, Owner> = {};
  for (const todo of listProjectTodos(checklist, phases, projectSteps, edits)) {
    if (todo.owner) out[todo.id] = todo.owner;
  }
  return out;
}

