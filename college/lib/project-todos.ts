/** Nested checklist steps — the assignable to-dos under parent runway items. */

import stepsFile from "@/content/checklist-steps.json";
import { phases } from "@/lib/content";
import { INBOX_PARENT_ID, type PersistedProjectStep } from "@/lib/ingest";
import { OWNERS, formatDate, isOwner, ownerLabel, type Owner, type Phase } from "@/lib/types";

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
};

export type TodoEditMap = Record<string, TodoEdit>;

export type TodoSubtask = {
  id: string;
  label: string;
  dueDate: string | null;
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
export function canMarkTodoDone(viewer: Owner, todoOwner: Owner | null): boolean {
  return todoOwner != null && viewer === todoOwner;
}

/** Badge text when someone else put the item on this list. */
export function assignedByBadge(todo: Pick<ProjectTodo, "owner" | "assignedBy">): string | null {
  if (!todo.owner || !todo.assignedBy || todo.assignedBy === todo.owner) return null;
  return `From ${ownerLabel(todo.assignedBy)}`;
}

/** Owner lookup for seed + dynamic to-dos (used for check-off ACL). */
export function todoOwnerIndex(
  dynamicSteps: PersistedProjectStep[] = [],
  edits: TodoEditMap = {},
): Map<string, Owner> {
  const map = new Map<string, Owner>();
  const groups = stepsFile as ChecklistStepGroupSeed[];
  for (const group of groups) {
    for (const step of group.steps) {
      if (isOwner(step.owner)) map.set(step.id, step.owner);
    }
  }
  for (const step of dynamicSteps) {
    map.set(step.id, step.owner);
  }
  for (const [id, edit] of Object.entries(edits)) {
    if (!("owner" in edit)) continue;
    if (edit.owner == null) map.delete(id);
    else if (isOwner(edit.owner)) map.set(id, edit.owner);
  }
  return map;
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
): { checklist: Record<string, boolean>; blocked: string[] } {
  const checklist = { ...next };
  const blocked: string[] = [];
  const ids = new Set([...Object.keys(current), ...Object.keys(next)]);
  for (const id of ids) {
    const before = Boolean(current[id]);
    const after = Boolean(next[id]);
    if (before === after) continue;
    const owner = owners.get(id);
    if (owner && !canMarkTodoDone(viewer, owner)) {
      blocked.push(id);
      if (before) checklist[id] = true;
      else delete checklist[id];
    }
  }
  return { checklist, blocked };
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
  },
  edits: TodoEditMap,
) {
  const edit = edits[step.id];
  if (!edit) return { ...step, description: "", owner: step.owner as Owner | null };
  return {
    ...step,
    label: edit.label?.trim() || step.label,
    description: edit.description ?? "",
    owner: "owner" in edit ? (edit.owner ?? null) : step.owner,
    assignedBy: "assignedBy" in edit ? (edit.assignedBy ?? null) : step.assignedBy,
    dueDate: "dueDate" in edit ? (edit.dueDate ?? null) : step.dueDate,
    startDate: "startDate" in edit ? (edit.startDate ?? null) : step.startDate,
    endDate: "endDate" in edit ? (edit.endDate ?? null) : step.endDate,
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
  },
  checklist: Record<string, boolean>,
  parents: Map<string, ParentLookup>,
  edits: TodoEditMap,
) {
  if (seen.has(step.id)) return;
  if (edits[step.id]?.deleted) return;
  const parent = parents.get(step.parentId) ?? parents.get(INBOX_PARENT_ID);
  if (!parent) return;
  const edited = withEdit(step, edits);
  seen.add(step.id);
  todos.push({
    id: edited.id,
    label: edited.label,
    description: edited.description,
    owner: edited.owner,
    assignedBy: edited.assignedBy,
    dueDate: edited.dueDate,
    startDate: edited.startDate,
    endDate: edited.endDate,
    done: Boolean(checklist[step.id]),
    parentId: edited.parentId,
    parentText: parent.parentText,
    phase: parent.phase,
    phaseWindow: parent.phaseWindow,
  });
}

export function listProjectTodos(
  checklist: Record<string, boolean>,
  phaseList: Phase[] = phases,
  dynamicSteps: PersistedProjectStep[] = [],
  edits: TodoEditMap = {},
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
      },
      checklist,
      parents,
      edits,
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
      open: all.filter((todo) => !todo.done),
      done: all.filter((todo) => todo.done),
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

/** dated = has a date; soon = due within the next 7 days (including today). */
export function dueTone(
  iso: string | null,
  now: Date = new Date(),
): "dated" | "soon" | "undated" {
  if (!iso || !ISO_DATE.test(iso)) return "undated";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return "undated";
  const due = new Date(year, month - 1, day);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due.getTime() - start.getTime()) / 86_400_000);
  if (days >= 0 && days <= 7) return "soon";
  return "dated";
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
