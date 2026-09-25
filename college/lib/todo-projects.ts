/** Household to-do projects — orthogonal grouping (not runway parentId). */

export const TODO_PROJECT_COLORS = [
  "#7a3b69",
  "#5b4a9e",
  "#2f6aa3",
  "#3f7d4f",
  "#8a5a1f",
] as const;

export const TODO_PROJECT_NAME_MAX = 60;
export const TODO_PROJECT_FAMILY_ID = "kyle-college";
export const TODO_GROUP_STORAGE_KEY = "kyle-todo-group-by";

export type TodoGroupBy = "person" | "project";

export type TodoProject = {
  id: string;
  name: string;
  colorIndex: number;
  familyId: string;
  createdAt: string;
};

export function isTodoGroupBy(value: unknown): value is TodoGroupBy {
  return value === "person" || value === "project";
}

export function projectColor(colorIndex: number): string {
  const i = ((colorIndex % TODO_PROJECT_COLORS.length) + TODO_PROJECT_COLORS.length) % TODO_PROJECT_COLORS.length;
  return TODO_PROJECT_COLORS[i]!;
}

export function nextProjectColorIndex(projects: TodoProject[]): number {
  return projects.length % TODO_PROJECT_COLORS.length;
}

export function normalizeProjectName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ").slice(0, TODO_PROJECT_NAME_MAX);
  return name || null;
}

export function normalizeTodoProjects(raw: unknown): TodoProject[] {
  if (!Array.isArray(raw)) return [];
  const out: TodoProject[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const name = typeof row.name === "string" ? normalizeProjectName(row.name) : null;
    if (!id || !name || seen.has(id)) continue;
    const colorIndex =
      typeof row.colorIndex === "number" && Number.isFinite(row.colorIndex)
        ? Math.max(0, Math.floor(row.colorIndex)) % TODO_PROJECT_COLORS.length
        : out.length % TODO_PROJECT_COLORS.length;
    const familyId =
      typeof row.familyId === "string" && row.familyId.trim()
        ? row.familyId.trim()
        : TODO_PROJECT_FAMILY_ID;
    const createdAt =
      typeof row.createdAt === "string" && row.createdAt.trim()
        ? row.createdAt.trim()
        : new Date(0).toISOString();
    seen.add(id);
    out.push({ id, name, colorIndex, familyId, createdAt });
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name));
}

export function createTodoProject(
  nameInput: string,
  projects: TodoProject[],
  colorIndex?: number,
): TodoProject | null {
  const name = normalizeProjectName(nameInput);
  if (!name) return null;
  return {
    id: `tp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    colorIndex:
      typeof colorIndex === "number" && Number.isFinite(colorIndex)
        ? Math.max(0, Math.floor(colorIndex)) % TODO_PROJECT_COLORS.length
        : nextProjectColorIndex(projects),
    familyId: TODO_PROJECT_FAMILY_ID,
    createdAt: new Date().toISOString(),
  };
}

export function openDatedStats(todos: { done: boolean; dueDate?: string | null; endDate?: string | null }[]): {
  open: number;
  dated: number;
  label: string;
} {
  const open = todos.filter((todo) => !todo.done);
  const dated = open.filter((todo) => Boolean(todo.endDate || todo.dueDate)).length;
  return {
    open: open.length,
    dated,
    label: `${open.length} OPEN · ${dated} DATED`,
  };
}
