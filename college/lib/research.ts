/**
 * Research groups for the add-school paste-update flow.
 * Groups are marked done via school.researchCompleted, not by filled fields.
 */

import { CAMPUS_SETTINGS } from "./campus-size";
import { normalizeSubmissions, SUBMISSIONS_RESEARCH_SHAPE } from "./school-submissions";
import {
  TEST_POLICY_FALL2028_STATUSES,
  TEST_POLICY_OPTIONS,
  type School,
} from "./types";

export const RESEARCH_GROUP_NAMES = [
  "Setting",
  "Programs",
  "Admissions by residency",
  "Application requirements",
  "Aid",
  "Submissions",
] as const;

export type ResearchGroupName = (typeof RESEARCH_GROUP_NAMES)[number];

export type ResearchFieldSpec = {
  field: string;
  type: string;
  allowed?: readonly string[];
};

export type ResearchGroup = {
  name: ResearchGroupName;
  fields: ResearchFieldSpec[];
};

const YES_PARTIAL_NO = ["Yes", "Partial", "No"] as const;
const RESIDENCY_STATUSES = ["Official", "Estimated", "Proxy", "Not applicable"] as const;

export const RESEARCH_GROUPS: ResearchGroup[] = [
  {
    name: "Setting",
    fields: [
      {
        field: "campusSetting",
        type: "enum",
        allowed: CAMPUS_SETTINGS,
      },
    ],
  },
  {
    name: "Programs",
    fields: [
      { field: "mechanicalEngineering", type: "enum", allowed: YES_PARTIAL_NO },
      { field: "materials", type: "enum", allowed: YES_PARTIAL_NO },
      { field: "materialsOffering", type: "string" },
      { field: "materialsProgram", type: "string" },
      { field: "materialsSourceUrl", type: "url" },
      { field: "aerospaceEngineering", type: "enum", allowed: YES_PARTIAL_NO },
      { field: "aerospaceProgram", type: "string" },
      { field: "aerospaceNotes", type: "string" },
      { field: "aerospaceSourceUrl", type: "url" },
    ],
  },
  {
    name: "Admissions by residency",
    fields: [
      { field: "residencyDataStatus", type: "enum", allowed: RESIDENCY_STATUSES },
      { field: "inStateAdmitRate", type: "number|null" },
      { field: "outOfStateAdmitRate", type: "number|null" },
      { field: "overallAdmitRate", type: "number|null" },
      { field: "admitDataYear", type: "string" },
      { field: "enrolledOutOfStatePct", type: "number|null" },
      { field: "outOfStateDefinition", type: "string" },
      { field: "outOfStatePolicy", type: "string" },
      { field: "engineeringResidencyNote", type: "string" },
      { field: "residencySourceUrl", type: "url" },
      { field: "residencyNotes", type: "string" },
    ],
  },
  {
    name: "Application requirements",
    fields: [
      { field: "testPolicy", type: "enum", allowed: TEST_POLICY_OPTIONS },
      {
        field: "testPolicyFall2028Status",
        type: "enum",
        allowed: TEST_POLICY_FALL2028_STATUSES,
      },
      { field: "testPolicyTerm", type: "string" },
      { field: "testPolicyDetail", type: "string" },
      { field: "testPolicyChange", type: "string|null" },
      { field: "testPolicySourceUrl", type: "url" },
      { field: "testPolicyCheckedDate", type: "date" },
      { field: "applicationPlatform", type: "string" },
      { field: "requiredEssays", type: "string" },
    ],
  },
  {
    name: "Aid",
    fields: [{ field: "meritAidNotes", type: "string" }],
  },
  {
    name: "Submissions",
    fields: [
      { field: "submissions", type: "submissions" },
      { field: "submissionsCheckedDate", type: "date" },
    ],
  },
];

const FIELD_TO_GROUP = new Map<string, ResearchGroupName>();
const FIELD_SPEC = new Map<string, ResearchFieldSpec>();
for (const group of RESEARCH_GROUPS) {
  for (const spec of group.fields) {
    FIELD_TO_GROUP.set(spec.field, group.name);
    FIELD_SPEC.set(spec.field, spec);
  }
}

export function isResearchGroupName(value: string): value is ResearchGroupName {
  return (RESEARCH_GROUP_NAMES as readonly string[]).includes(value);
}

export function researchGroupForField(field: string): ResearchGroupName | null {
  return FIELD_TO_GROUP.get(field) ?? null;
}

export function researchGroupsNeeded(
  school: Pick<School, "researchCompleted">,
): ResearchGroupName[] {
  const done = new Set(school.researchCompleted ?? []);
  return RESEARCH_GROUPS.map((g) => g.name).filter((name) => !done.has(name));
}

function formatFieldLine(spec: ResearchFieldSpec): string {
  if (spec.type === "submissions") {
    return `${spec.field}: JSON object matching normalizeSubmissions ${SUBMISSIONS_RESEARCH_SHAPE}`;
  }
  if (spec.allowed?.length) {
    return `${spec.field}: one of ${spec.allowed.map((v) => JSON.stringify(v)).join(" | ")}`;
  }
  return `${spec.field}: ${spec.type}`;
}

/** Clipboard text for the "Research this school" button. */
export function formatResearchRequest(
  school: Pick<
    School,
    | "name"
    | "unitId"
    | "location"
    | "website"
    | "control"
    | "researchCompleted"
  >,
): string {
  const needed = researchGroupsNeeded(school);
  const fieldLines: string[] = [];
  for (const group of RESEARCH_GROUPS) {
    if (!needed.includes(group.name)) continue;
    fieldLines.push(`${group.name}:`);
    for (const spec of group.fields) {
      fieldLines.push(`  - ${formatFieldLine(spec)}`);
    }
  }

  return [
    "Research request for the Kyle college tracker.",
    `School: ${school.name}`,
    `unitId: ${school.unitId ?? ""}`,
    `Location: ${school.location}`,
    `Website: ${school.website}`,
    `Public or private: ${school.control}`,
    `Groups needed: ${needed.join(", ") || "(none)"}`,
    "Fields and allowed values:",
    fieldLines.join("\n") || "(none)",
    "Return a school-research JSON update.",
  ].join("\n");
}

export type SchoolResearchUpdate = {
  updateType: "school-research";
  unitId: number;
  school?: string;
  preparedDate?: string;
  completedGroups: ResearchGroupName[];
  fields: Record<string, unknown>;
};

export type ResearchFieldDiff = {
  field: string;
  group: ResearchGroupName | null;
  current: unknown;
  next: unknown;
};

export type ResearchPreviewRow = {
  unitId: number;
  schoolId: string;
  schoolName: string;
  field: string;
  current: string;
  next: string;
};

export type ResearchValidationOk = {
  ok: true;
  update: SchoolResearchUpdate;
  diffs: ResearchFieldDiff[];
};

export type ResearchValidationFail = {
  ok: false;
  problems: string[];
};

export type ResearchValidationResult = ResearchValidationOk | ResearchValidationFail;

export type ResearchApplyPatch = {
  schoolId: string;
  unitId: number;
  schoolName: string;
  patch: Partial<School> & Record<string, unknown>;
  rows: ResearchPreviewRow[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validateFieldValue(spec: ResearchFieldSpec, value: unknown): string | null {
  if (spec.allowed) {
    if (typeof value !== "string" || !(spec.allowed as readonly string[]).includes(value)) {
      return `${spec.field} must be one of: ${spec.allowed.join(", ")}`;
    }
    return null;
  }
  if (spec.type === "string") {
    if (typeof value !== "string") return `${spec.field} must be a string`;
    return null;
  }
  if (spec.type === "string|null") {
    if (value !== null && typeof value !== "string") {
      return `${spec.field} must be a string or null`;
    }
    return null;
  }
  if (spec.type === "number|null") {
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) {
      return `${spec.field} must be a number or null`;
    }
    return null;
  }
  if (spec.type === "url") {
    if (typeof value !== "string") return `${spec.field} must be a string URL`;
    return null;
  }
  if (spec.type === "date") {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return `${spec.field} must be YYYY-MM-DD`;
    }
    return null;
  }
  if (spec.type === "submissions") {
    if (normalizeSubmissions(value) == null) {
      return `${spec.field} must match the SchoolSubmissions JSON shape`;
    }
    return null;
  }
  return null;
}

function formatPreviewValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value.trim() ? value : "—";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function schoolFieldValue(school: School, field: string): unknown {
  return (school as Record<string, unknown>)[field];
}

/** Build field diffs for a validated update against the current school record. */
export function researchFieldDiffs(
  update: SchoolResearchUpdate,
  school: School,
): ResearchFieldDiff[] {
  const diffs: ResearchFieldDiff[] = [];
  for (const [field, next] of Object.entries(update.fields)) {
    const current = schoolFieldValue(school, field);
    if (Object.is(current, next)) continue;
    if (
      (current === null || current === undefined || current === "") &&
      (next === null || next === undefined || next === "")
    ) {
      continue;
    }
    diffs.push({
      field,
      group: researchGroupForField(field),
      current,
      next,
    });
  }
  return diffs;
}

/**
 * Validate a school-research JSON update (single object).
 * Does not check that unitId exists on the list — callers do that.
 * When `school` is provided, also returns field diffs for the preview table.
 */
export function validateSchoolResearchUpdate(
  json: unknown,
  school?: School | null,
): ResearchValidationResult {
  const problems: string[] = [];
  if (!isPlainObject(json)) {
    return { ok: false, problems: ["Update must be a JSON object"] };
  }

  if (json.updateType !== "school-research") {
    problems.push('updateType must be "school-research"');
  }

  const unitId = json.unitId;
  if (typeof unitId !== "number" || !Number.isFinite(unitId) || unitId <= 0) {
    problems.push("unitId must be a positive number");
  }

  if (school && typeof unitId === "number" && Number.isFinite(unitId)) {
    if (school.unitId == null) {
      problems.push(`${school.name} has no unitId on file`);
    } else if (school.unitId !== Math.round(unitId)) {
      problems.push(
        `unitId ${Math.round(unitId)} does not match ${school.name} (unitId ${school.unitId})`,
      );
    }
  }

  const completedRaw = json.completedGroups;
  const completedGroups: ResearchGroupName[] = [];
  if (!Array.isArray(completedRaw)) {
    problems.push("completedGroups must be an array");
  } else {
    for (const item of completedRaw) {
      if (typeof item !== "string" || !isResearchGroupName(item)) {
        problems.push(`Unknown completed group: ${String(item)}`);
      } else if (!completedGroups.includes(item)) {
        completedGroups.push(item);
      }
    }
  }

  const fieldsRaw = json.fields;
  const fields: Record<string, unknown> = {};
  if (!isPlainObject(fieldsRaw)) {
    problems.push("fields must be an object");
  } else {
    for (const [key, value] of Object.entries(fieldsRaw)) {
      const spec = FIELD_SPEC.get(key);
      if (!spec) {
        problems.push(`Unknown field: ${key}`);
        continue;
      }
      const err = validateFieldValue(spec, value);
      if (err) problems.push(err);
      else fields[key] = spec.type === "submissions" ? normalizeSubmissions(value) : value;
    }
  }

  if (problems.length) return { ok: false, problems };

  const update: SchoolResearchUpdate = {
    updateType: "school-research",
    unitId: Math.round(unitId as number),
    school: typeof json.school === "string" ? json.school : undefined,
    preparedDate: typeof json.preparedDate === "string" ? json.preparedDate : undefined,
    completedGroups,
    fields,
  };

  return {
    ok: true,
    update,
    diffs: school ? researchFieldDiffs(update, school) : [],
  };
}

/**
 * Parse paste payload (object or array), match unitIds to the list, and
 * build preview rows + patches ready to apply.
 */
export function prepareSchoolResearchUpdates(
  json: unknown,
  schools: School[],
): { ok: true; patches: ResearchApplyPatch[] } | { ok: false; problems: string[] } {
  const items = Array.isArray(json) ? json : [json];
  if (!items.length) return { ok: false, problems: ["Paste at least one school-research update"] };

  const byUnitId = new Map<number, School>();
  for (const school of schools) {
    if (school.unitId != null) byUnitId.set(school.unitId, school);
  }

  const problems: string[] = [];
  const patches: ResearchApplyPatch[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const label = items.length > 1 ? `Update ${i + 1}` : "Update";
    const raw = items[i];
    const unitIdHint =
      isPlainObject(raw) && typeof raw.unitId === "number" ? Math.round(raw.unitId) : null;
    const school = unitIdHint != null ? byUnitId.get(unitIdHint) ?? null : null;
    if (unitIdHint != null && !school) {
      problems.push(`${label}: no school on the list with unitId ${unitIdHint}`);
      continue;
    }

    const result = validateSchoolResearchUpdate(raw, school);
    if (!result.ok) {
      for (const problem of result.problems) problems.push(`${label}: ${problem}`);
      continue;
    }
    if (!school) {
      problems.push(`${label}: unitId must match a school on the list`);
      continue;
    }

    const done = new Set(school.researchCompleted ?? []);
    for (const group of result.update.completedGroups) done.add(group);

    const patch: Partial<School> & Record<string, unknown> = {
      ...result.update.fields,
      researchCompleted: [...done],
    };

    const rows: ResearchPreviewRow[] = result.diffs.map((diff) => ({
      unitId: school.unitId!,
      schoolId: school.id,
      schoolName: school.name,
      field: diff.field,
      current: formatPreviewValue(diff.current),
      next: formatPreviewValue(diff.next),
    }));

    if (result.update.completedGroups.length) {
      const before = [...(school.researchCompleted ?? [])].sort().join(", ") || "—";
      const after = [...done].sort().join(", ") || "—";
      if (before !== after) {
        rows.push({
          unitId: school.unitId!,
          schoolId: school.id,
          schoolName: school.name,
          field: "researchCompleted",
          current: before,
          next: after,
        });
      }
    }

    patches.push({
      schoolId: school.id,
      unitId: school.unitId!,
      schoolName: school.name,
      patch,
      rows,
    });
  }

  if (problems.length) return { ok: false, problems };
  if (!patches.length) return { ok: false, problems: ["No field changes to apply"] };
  return { ok: true, patches };
}
