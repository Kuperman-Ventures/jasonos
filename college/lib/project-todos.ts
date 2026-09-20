/** Nested checklist steps — the assignable to-dos under parent runway items. */

import stepsFile from "@/content/checklist-steps.json";
import { phases } from "@/lib/content";
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
  owner: Owner;
  dueDate: string | null;
  startDate: string | null;
  endDate: string | null;
  done: boolean;
  parentId: string;
  parentText: string;
  phase: string;
  phaseWindow: string;
};

type ParentLookup = {
  parentText: string;
  phase: string;
  phaseWindow: string;
};

function parentIndex(phaseList: Phase[] = phases): Map<string, ParentLookup> {
  const map = new Map<string, ParentLookup>();
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

export function formatTodoWhen(todo: Pick<ProjectTodo, "dueDate" | "startDate" | "endDate">): string {
  if (todo.startDate && todo.endDate) {
    return `${formatDate(todo.startDate)} – ${formatDate(todo.endDate)}`;
  }
  if (todo.dueDate) return formatDate(todo.dueDate);
  if (todo.startDate) return `Starts ${formatDate(todo.startDate)}`;
  if (todo.endDate) return `Ends ${formatDate(todo.endDate)}`;
  return "No date";
}

function dateSortValue(todo: ProjectTodo): number {
  const key = todo.dueDate ?? todo.startDate ?? todo.endDate;
  return key ? Date.parse(key) : Number.POSITIVE_INFINITY;
}

export function listProjectTodos(
  checklist: Record<string, boolean>,
  phaseList: Phase[] = phases,
): ProjectTodo[] {
  const parents = parentIndex(phaseList);
  const groups = stepsFile as ChecklistStepGroupSeed[];
  const todos: ProjectTodo[] = [];

  for (const group of groups) {
    const parent = parents.get(group.parentId);
    if (!parent) continue;
    for (const step of group.steps) {
      if (!isOwner(step.owner)) continue;
      todos.push({
        id: step.id,
        label: step.label,
        owner: step.owner,
        dueDate: step.dueDate,
        startDate: step.startDate,
        endDate: step.endDate,
        done: Boolean(checklist[step.id]),
        parentId: group.parentId,
        parentText: parent.parentText,
        phase: parent.phase,
        phaseWindow: parent.phaseWindow,
      });
    }
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

export function groupTodosByOwner(
  todos: ProjectTodo[],
  focusOwner: Owner,
): { mine: OwnerTodoBucket; others: OwnerTodoBucket[] } {
  const byOwner = new Map<Owner, ProjectTodo[]>();
  for (const owner of OWNERS) byOwner.set(owner.id, []);
  for (const todo of todos) {
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
  };
}
