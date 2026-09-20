/** College-list funnel phases (separate from the checklist timeline). */

export type ListPhaseId = "exploration" | "consideration" | "applications";

export type ListColumnId =
  | "school"
  | "location"
  | "status"
  | "track"
  | "selectivity"
  | "interest"
  | "action";

export type ListPhase = {
  id: ListPhaseId;
  label: string;
  window: string;
  /** Soft target used for the overall gauge (can read over 100%). */
  target: number;
  /** Human range for the readout. */
  rangeLabel: string;
  /** Inclusive start YYYY-MM-DD. */
  startsOn: string;
  /** Inclusive end YYYY-MM-DD, or null if open-ended. */
  endsOn: string | null;
  defaultColumns: ListColumnId[];
};

export const LIST_COLUMNS: { id: ListColumnId; label: string; required?: boolean }[] = [
  { id: "school", label: "School", required: true },
  { id: "location", label: "Location" },
  { id: "status", label: "Status" },
  { id: "track", label: "Track & deadline" },
  { id: "selectivity", label: "Selectivity" },
  { id: "interest", label: "Interest" },
  { id: "action", label: "Next action" },
];

export const LIST_PHASES: ListPhase[] = [
  {
    id: "exploration",
    label: "Exploration",
    window: "Now – Dec 2026",
    target: 30,
    rangeLabel: "27–33",
    startsOn: "2026-09-01",
    endsOn: "2026-12-31",
    // Status is the same for everyone here — researching — so leave it off.
    defaultColumns: ["school", "location", "selectivity", "interest", "action"],
  },
  {
    id: "consideration",
    label: "Consideration",
    window: "Jan – Jul 2027",
    target: 12,
    rangeLabel: "10–15",
    startsOn: "2027-01-01",
    endsOn: "2027-07-26",
    defaultColumns: ["school", "selectivity", "interest", "track", "action"],
  },
  {
    id: "applications",
    label: "Applications",
    window: "Jul 2027 →",
    target: 10,
    rangeLabel: "8–12",
    startsOn: "2027-07-27",
    endsOn: null,
    defaultColumns: ["school", "status", "track", "selectivity", "interest", "action"],
  },
];

export function listPhaseById(id: ListPhaseId): ListPhase {
  return LIST_PHASES.find((phase) => phase.id === id) ?? LIST_PHASES[0];
}

export function isListPhaseId(value: string): value is ListPhaseId {
  return LIST_PHASES.some((phase) => phase.id === value);
}

export function isListColumnId(value: string): value is ListColumnId {
  return LIST_COLUMNS.some((column) => column.id === value);
}

/** Calendar phase for “where the list is now.” */
export function currentListPhaseId(now = new Date()): ListPhaseId {
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  for (const phase of LIST_PHASES) {
    if (day < phase.startsOn) continue;
    if (phase.endsOn && day > phase.endsOn) continue;
    return phase.id;
  }
  return "applications";
}

export function nextListPhaseId(id: ListPhaseId): ListPhaseId | null {
  const index = LIST_PHASES.findIndex((phase) => phase.id === id);
  return LIST_PHASES[index + 1]?.id ?? null;
}

export function previousListPhaseId(id: ListPhaseId): ListPhaseId | null {
  const index = LIST_PHASES.findIndex((phase) => phase.id === id);
  return index > 0 ? LIST_PHASES[index - 1]?.id ?? null : null;
}

/** Move a school to any funnel phase (forward or back). Keeps participation history. */
export function moveSchoolPhasePatch(
  school: {
    listPhase: ListPhaseId;
    phasesParticipated: ListPhaseId[];
  },
  target: ListPhaseId,
): { listPhase: ListPhaseId; phasesParticipated: ListPhaseId[]; archived: false } | null {
  if (target === school.listPhase) return null;
  const participated = school.phasesParticipated.includes(target)
    ? school.phasesParticipated
    : [...school.phasesParticipated, target];
  return { listPhase: target, phasesParticipated: participated, archived: false };
}

export function advanceSchoolPatch(school: {
  listPhase: ListPhaseId;
  phasesParticipated: ListPhaseId[];
}): { listPhase: ListPhaseId; phasesParticipated: ListPhaseId[]; archived: false } | null {
  const next = nextListPhaseId(school.listPhase);
  if (!next) return null;
  return moveSchoolPhasePatch(school, next);
}

export function retreatSchoolPatch(school: {
  listPhase: ListPhaseId;
  phasesParticipated: ListPhaseId[];
}): { listPhase: ListPhaseId; phasesParticipated: ListPhaseId[]; archived: false } | null {
  const previous = previousListPhaseId(school.listPhase);
  if (!previous) return null;
  return moveSchoolPhasePatch(school, previous);
}

export function archiveSchoolPatch(school: {
  listPhase: ListPhaseId;
  phasesParticipated: ListPhaseId[];
}): {
  archived: true;
  phasesParticipated: ListPhaseId[];
} {
  const participated = school.phasesParticipated.includes(school.listPhase)
    ? school.phasesParticipated
    : [...school.phasesParticipated, school.listPhase];
  return { archived: true, phasesParticipated: participated };
}

export type PhaseGauge = {
  phase: ListPhase;
  count: number;
  /** count / target * 100 — intentionally can exceed 100. */
  percent: number;
};

export function phaseCountGauge(count: number, phase: ListPhase): PhaseGauge {
  return {
    phase,
    count,
    percent: phase.target ? Math.round((count / phase.target) * 1000) / 10 : 0,
  };
}

export type SelectivityGauge = {
  id: string;
  label: string;
  count: number;
  percent: number;
};

/** Selectivity mix for the schools currently shown in a phase. */
export function selectivityGauges(
  schools: { selectivityTier: string }[],
  tiers: { id: string; label: string }[],
): SelectivityGauge[] {
  const total = schools.length || 1;
  return tiers.map((tier) => {
    const count = schools.filter((school) => school.selectivityTier === tier.id).length;
    return {
      id: tier.id || "unset",
      label: tier.label,
      count,
      percent: Math.round((count / total) * 1000) / 10,
    };
  });
}

export function normalizeColumns(columns: string[] | undefined, phase: ListPhase): ListColumnId[] {
  const allowed = new Set(LIST_COLUMNS.map((column) => column.id));
  const cleaned = (columns ?? [])
    .filter((id): id is ListColumnId => allowed.has(id as ListColumnId))
    .filter((id, index, all) => all.indexOf(id) === index);
  if (!cleaned.includes("school")) cleaned.unshift("school");
  return cleaned.length > 1 ? cleaned : [...phase.defaultColumns];
}

export type MemberListPrefs = {
  columnsByPhase: Partial<Record<ListPhaseId, ListColumnId[]>>;
  showArchived: boolean;
};

export function defaultListPrefs(): MemberListPrefs {
  return {
    columnsByPhase: Object.fromEntries(
      LIST_PHASES.map((phase) => [phase.id, [...phase.defaultColumns]]),
    ) as MemberListPrefs["columnsByPhase"],
    showArchived: false,
  };
}

export function mergeListPrefs(raw: unknown): MemberListPrefs {
  const base = defaultListPrefs();
  if (!raw || typeof raw !== "object") return base;
  const input = raw as {
    columnsByPhase?: Partial<Record<string, string[]>>;
    showArchived?: boolean;
  };
  const columnsByPhase = { ...base.columnsByPhase };
  for (const phase of LIST_PHASES) {
    const next = input.columnsByPhase?.[phase.id];
    if (Array.isArray(next)) columnsByPhase[phase.id] = normalizeColumns(next, phase);
  }
  return {
    columnsByPhase,
    showArchived: Boolean(input.showArchived),
  };
}
