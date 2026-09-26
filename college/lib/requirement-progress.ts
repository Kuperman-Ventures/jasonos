/** Persist per-user, per-school requirement checklist status. */

import { isOwner, type Owner } from "@/lib/types";
import type { RequirementKey } from "@/lib/school-requirements";
import type { PersistedProjectStep } from "@/lib/ingest";
import type { TodoEditMap } from "@/lib/project-todos";

export type RequirementStatus = 0 | 1 | 2;

export type RequirementProgressEntry = {
  userId: Owner;
  schoolId: string;
  key: RequirementKey;
  status: RequirementStatus;
  todoId: string | null;
};

/** Map key: `${userId}::${schoolId}::${requirementKey}` */
export type RequirementProgressMap = Record<string, RequirementProgressEntry>;

const KEYS = new Set<string>([
  "application",
  "essay",
  "supplements",
  "tests",
  "teacherRecs",
  "counselorRec",
  "interview",
]);

function isRequirementKey(value: string): value is RequirementKey {
  return KEYS.has(value);
}

export function progressKey(userId: Owner, schoolId: string, key: RequirementKey): string {
  return `${userId}::${schoolId}::${key}`;
}

export function normalizeRequirementProgress(raw: unknown): RequirementProgressMap {
  const out: RequirementProgressMap = {};
  if (!raw || typeof raw !== "object") return out;

  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const item = row as Record<string, unknown>;
      const userId = typeof item.userId === "string" && isOwner(item.userId) ? item.userId : null;
      const schoolId = typeof item.schoolId === "string" ? item.schoolId : "";
      const key = typeof item.key === "string" && isRequirementKey(item.key) ? item.key : null;
      if (!userId || !schoolId || !key) continue;
      const statusRaw = Number(item.status);
      const status: RequirementStatus =
        statusRaw === 1 || statusRaw === 2 ? (statusRaw as RequirementStatus) : 0;
      const todoId =
        typeof item.todoId === "string" && item.todoId ? item.todoId : null;
      out[progressKey(userId, schoolId, key)] = {
        userId,
        schoolId,
        key,
        status,
        todoId,
      };
    }
    return out;
  }

  for (const [id, row] of Object.entries(raw as Record<string, unknown>)) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    let userId =
      typeof item.userId === "string" && isOwner(item.userId) ? item.userId : null;
    let schoolId = typeof item.schoolId === "string" ? item.schoolId : "";
    let key =
      typeof item.key === "string" && isRequirementKey(item.key) ? item.key : null;
    if ((!userId || !schoolId || !key) && id.includes("::")) {
      const [u, s, k] = id.split("::");
      if (!userId && typeof u === "string" && isOwner(u)) userId = u;
      if (!schoolId && typeof s === "string") schoolId = s;
      if (!key && typeof k === "string" && isRequirementKey(k)) key = k;
    }
    if (!userId || !schoolId || !key) continue;
    const statusRaw = Number(item.status);
    const status: RequirementStatus =
      statusRaw === 1 || statusRaw === 2 ? (statusRaw as RequirementStatus) : 0;
    out[progressKey(userId, schoolId, key)] = {
      userId,
      schoolId,
      key,
      status,
      todoId: typeof item.todoId === "string" && item.todoId ? item.todoId : null,
    };
  }
  return out;
}

export function getRequirementProgress(
  map: RequirementProgressMap,
  userId: Owner,
  schoolId: string,
  key: RequirementKey,
): RequirementProgressEntry {
  return (
    map[progressKey(userId, schoolId, key)] ?? {
      userId,
      schoolId,
      key,
      status: 0,
      todoId: null,
    }
  );
}

export function setRequirementStatus(
  map: RequirementProgressMap,
  userId: Owner,
  schoolId: string,
  key: RequirementKey,
  status: RequirementStatus,
): RequirementProgressMap {
  const id = progressKey(userId, schoolId, key);
  const prev = map[id];
  return {
    ...map,
    [id]: {
      userId,
      schoolId,
      key,
      status,
      todoId: prev?.todoId ?? null,
    },
  };
}

export function cycleRequirementStatus(status: RequirementStatus): RequirementStatus {
  return ((status + 1) % 3) as RequirementStatus;
}

export function setRequirementTodoId(
  map: RequirementProgressMap,
  userId: Owner,
  schoolId: string,
  key: RequirementKey,
  todoId: string | null,
): RequirementProgressMap {
  const id = progressKey(userId, schoolId, key);
  const prev = map[id];
  return {
    ...map,
    [id]: {
      userId,
      schoolId,
      key,
      status: prev?.status ?? 0,
      todoId,
    },
  };
}

/** True when an open to-do for this school + requirement still exists. */
export function requirementHasTodo(
  key: RequirementKey,
  schoolId: string,
  projectSteps: PersistedProjectStep[],
  todoEdits: TodoEditMap = {},
): boolean {
  return projectSteps.some((step) => {
    if (step.schoolId !== schoolId) return false;
    if (step.sourceRequirement !== key) return false;
    if (todoEdits[step.id]?.deleted) return false;
    return true;
  });
}

export function findRequirementTodoId(
  key: RequirementKey,
  schoolId: string,
  projectSteps: PersistedProjectStep[],
  todoEdits: TodoEditMap = {},
): string | null {
  const step = projectSteps.find((row) => {
    if (row.schoolId !== schoolId) return false;
    if (row.sourceRequirement !== key) return false;
    if (todoEdits[row.id]?.deleted) return false;
    return true;
  });
  return step?.id ?? null;
}
