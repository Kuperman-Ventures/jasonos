/** College-list funnel phases (separate from the checklist timeline). */

export type ListPhaseId = "exploration" | "consideration" | "applications";

export type ListColumnId =
  | "school"
  | "location"
  | "status"
  | "track"
  | "selectivity"
  | "interest"
  | "visit"
  | "action"
  | "mechanical"
  | "materials"
  | "aerospace";

export type ListPhase = {
  id: ListPhaseId;
  label: string;
  window: string;
  /** Season label for the list-dashboard eyebrow (e.g. Junior spring). */
  season: string;
  /** Soft target used for the overall gauge (can read over 100%). */
  target: number;
  /** Inclusive low end of the acceptable range. */
  rangeLo: number;
  /** Inclusive high end of the acceptable range. */
  rangeHi: number;
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
  { id: "visit", label: "Visit" },
  { id: "action", label: "Next action" },
  { id: "mechanical", label: "Mechanical" },
  { id: "materials", label: "Materials" },
  { id: "aerospace", label: "Aerospace" },
];

export const LIST_PHASES: ListPhase[] = [
  {
    id: "exploration",
    label: "Exploration",
    window: "Sep 2026 – Dec 2026",
    season: "Junior fall",
    target: 30,
    rangeLo: 27,
    rangeHi: 33,
    rangeLabel: "27–33",
    startsOn: "2026-09-01",
    endsOn: "2026-12-31",
    // Status is the same for everyone here — researching — so leave it off.
    defaultColumns: ["school", "location", "selectivity", "interest", "visit", "action"],
  },
  {
    id: "consideration",
    label: "Consideration",
    window: "Jan 2027 – Jul 2027",
    season: "Junior spring",
    target: 12,
    rangeLo: 10,
    rangeHi: 15,
    rangeLabel: "10–15",
    startsOn: "2027-01-01",
    endsOn: "2027-07-26",
    defaultColumns: ["school", "selectivity", "interest", "visit", "track", "action"],
  },
  {
    id: "applications",
    label: "Applications",
    window: "Jul 2027 onward",
    season: "Senior fall",
    target: 10,
    rangeLo: 8,
    rangeHi: 12,
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

function parseListDay(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Exclusive end used for calendar-bar length (open Applications runs through Jan 1 2028). */
export function listPhaseExclusiveEnd(phase: ListPhase): Date {
  if (phase.endsOn) {
    const end = parseListDay(phase.endsOn);
    end.setDate(end.getDate() + 1);
    return end;
  }
  return new Date(2028, 0, 1);
}

/** Day count for proportional stepper columns. */
export function listPhaseDaySpan(phase: ListPhase): number {
  const start = parseListDay(phase.startsOn);
  const end = listPhaseExclusiveEnd(phase);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
}

/**
 * How far the calendar has filled this phase’s bar (0–1).
 * Past phases are full; future phases are empty; the current phase is partial.
 */
export function listPhaseBarProgress(phase: ListPhase, now = new Date()): number {
  const currentId = currentListPhaseId(now);
  const currentIndex = LIST_PHASES.findIndex((item) => item.id === currentId);
  const index = LIST_PHASES.findIndex((item) => item.id === phase.id);
  if (index < 0) return 0;
  if (index < currentIndex) return 1;
  if (index > currentIndex) return 0;
  const start = parseListDay(phase.startsOn).getTime();
  const end = listPhaseExclusiveEnd(phase).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (today <= start) return 0;
  if (today >= end) return 1;
  return (today - start) / (end - start);
}

/** Eyebrow for the list dashboard: Phase N of 3 · season. */
export function listPhaseEyebrow(phaseId: ListPhaseId): string {
  const index = LIST_PHASES.findIndex((phase) => phase.id === phaseId);
  const phase = listPhaseById(phaseId);
  return `Phase ${index + 1} of 3 · ${phase.season}`;
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

/** Ideal count for a tier: share × target list size, rounded, minimum 1. */
export function idealTierCount(idealPercent: number, targetListSize: number): number {
  return Math.max(1, Math.round((idealPercent / 100) * targetListSize));
}

export type ListSizeBar = {
  count: number;
  target: number;
  lo: number;
  hi: number;
  scaleMax: number;
  note: string;
  prose: string;
  overRange: boolean;
  underRange: boolean;
};

/** Size bar on a 0–scaleMax scale with an acceptable band and target tick. */
export function listSizeBar(count: number, phase: ListPhase, scaleMax = 50): ListSizeBar {
  const lo = phase.rangeLo;
  const hi = phase.rangeHi;
  const target = phase.target;
  const over = count - hi;
  const under = lo - count;
  const overRange = over > 0;
  const underRange = under > 0;
  const note = overRange ? `+${over} over range` : underRange ? `${under} under range` : "In range";
  let prose = `${count} active against a target of about ${target}.`;
  if (overRange) {
    prose =
      phase.id === "exploration"
        ? `${count} active against a target of about ${target}. Trim ${over} to reach the top of the range before Consideration opens in January.`
        : `${count} active against a target of about ${target}. Trim ${over} to reach the top of the range.`;
  } else if (underRange) {
    prose = `${count} active against a target of about ${target}. Add ${under} more to reach the bottom of the range.`;
  }
  return {
    count,
    target,
    lo,
    hi,
    scaleMax: Math.max(scaleMax, count, hi),
    note,
    prose,
    overRange,
    underRange,
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

export type SelectivityMixStatus = "over" | "met" | "under";

export type SelectivityPieSlice = {
  id: string;
  label: string;
  count: number;
  /** Ideal school count for this tier (share × target list size). */
  idealCount: number;
  idealPercent: number;
  /** Wedge start angle in degrees after the gap (0 = right). */
  startAngle: number;
  /** Wedge end angle in degrees before the next gap. */
  endAngle: number;
  /** have ÷ idealCount, uncapped (over is drawn as an outer band). */
  fillRatio: number;
  status: SelectivityMixStatus;
  statusLabel: string;
};

const PIE_GAP_DEG = 2.4;

/**
 * Build pie slices: wedge angles follow the ideal mix; radial fill shows
 * have ÷ ideal count against the target list size.
 */
export function selectivityPieSlices(
  schools: { selectivityTier: string }[],
  targetListSize: number,
): { slices: SelectivityPieSlice[]; setCount: number; unsetCount: number } {
  const setSchools = schools.filter((school) =>
    IDEAL_SELECTIVITY_MIX.some((tier) => tier.id === school.selectivityTier),
  );
  const unsetCount = schools.length - setSchools.length;
  const setCount = setSchools.length;
  const basis = targetListSize > 0 ? targetListSize : 1;

  let cursor = -90; // start at top
  const slices = IDEAL_SELECTIVITY_MIX.map((tier) => {
    const count = setSchools.filter((school) => school.selectivityTier === tier.id).length;
    const idealCount = idealTierCount(tier.idealPercent, basis);
    const fillRatio = idealCount > 0 ? count / idealCount : 0;
    const sweep = (tier.idealPercent / 100) * 360;
    const startAngle = cursor + PIE_GAP_DEG / 2;
    const endAngle = cursor + sweep - PIE_GAP_DEG / 2;
    cursor += sweep;
    const status: SelectivityMixStatus =
      count > idealCount ? "over" : count === idealCount ? "met" : "under";
    const delta = count - idealCount;
    const statusLabel =
      status === "over" ? `+${delta} over` : status === "met" ? "On ideal" : `${-delta} to go`;
    return {
      id: tier.id,
      label: tier.label,
      count,
      idealCount,
      idealPercent: tier.idealPercent,
      startAngle,
      endAngle,
      fillRatio,
      status,
      statusLabel,
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
