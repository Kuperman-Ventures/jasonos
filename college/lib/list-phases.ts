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
    window: "Sep 2026 – Dec 2026",
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
    window: "Jan 2027 – Jul 2027",
    target: 12,
    rangeLabel: "10–15",
    startsOn: "2027-01-01",
    endsOn: "2027-07-26",
    defaultColumns: ["school", "selectivity", "interest", "track", "action"],
  },
  {
    id: "applications",
    label: "Applications",
    window: "Jul 2027 onward",
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

/**
 * Which list tab a live (non-archived) school appears on.
 * Exploration keeps schools after they move to Consideration.
 * Moving Consideration → Applications removes them from Consideration
 * (and they leave Exploration too — only the current Applications list).
 */
export function schoolOnListPhase(
  school: { listPhase: ListPhaseId },
  phaseId: ListPhaseId,
): boolean {
  if (phaseId === "exploration") {
    return school.listPhase === "exploration" || school.listPhase === "consideration";
  }
  return school.listPhase === phaseId;
}

export function isForwardListPhaseMove(from: ListPhaseId, to: ListPhaseId): boolean {
  return LIST_PHASES.findIndex((phase) => phase.id === to) > LIST_PHASES.findIndex((phase) => phase.id === from);
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

/** Target share of the list for each set selectivity tier. */
export const IDEAL_SELECTIVITY_MIX: {
  id: "extremely_selective" | "very_selective" | "competitive" | "less_competitive";
  label: string;
  idealPercent: number;
}[] = [
  { id: "extremely_selective", label: "Extremely selective", idealPercent: 10 },
  { id: "very_selective", label: "Very selective", idealPercent: 20 },
  { id: "competitive", label: "Competitive", idealPercent: 45 },
  { id: "less_competitive", label: "Less competitive", idealPercent: 25 },
];

export type SelectivityPieSlice = {
  id: string;
  label: string;
  count: number;
  /** Actual share of schools with a set tier (sums to 100 when any are set). */
  actualPercent: number;
  idealPercent: number;
  /** Start angle in degrees (0 = right, clockwise-friendly for SVG helpers). */
  startAngle: number;
  /** Ideal wedge size in degrees. */
  idealSweep: number;
  /** Colored fill size inside the ideal wedge (capped at idealSweep). */
  fillSweep: number;
  /** True when actual share exceeds the ideal share. */
  overIdeal: boolean;
};

/**
 * Build pie slices: wedge sizes follow the ideal mix; colored fill shows how
 * much of that ideal slot the live list has filled.
 */
export function selectivityPieSlices(
  schools: { selectivityTier: string }[],
): { slices: SelectivityPieSlice[]; setCount: number; unsetCount: number } {
  const setSchools = schools.filter((school) =>
    IDEAL_SELECTIVITY_MIX.some((tier) => tier.id === school.selectivityTier),
  );
  const unsetCount = schools.length - setSchools.length;
  const setCount = setSchools.length;
  const total = setCount || 1;

  let cursor = -90; // start at top
  const slices = IDEAL_SELECTIVITY_MIX.map((tier) => {
    const count = setSchools.filter((school) => school.selectivityTier === tier.id).length;
    const actualPercent = setCount ? Math.round((count / total) * 1000) / 10 : 0;
    const idealSweep = (tier.idealPercent / 100) * 360;
    const fillRatio = tier.idealPercent > 0 ? actualPercent / tier.idealPercent : 0;
    const fillSweep = Math.min(1, Math.max(0, fillRatio)) * idealSweep;
    const startAngle = cursor;
    cursor += idealSweep;
    return {
      id: tier.id,
      label: tier.label,
      count,
      actualPercent,
      idealPercent: tier.idealPercent,
      startAngle,
      idealSweep,
      fillSweep,
      overIdeal: actualPercent > tier.idealPercent + 0.05,
    };
  });

  return { slices, setCount, unsetCount };
}

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
