import { createClient } from "@supabase/supabase-js";
import { seedSchools } from "./content";
import type { FoundFacts } from "./school-research";
import { formatSources } from "./school-research";
import { knownWebsite } from "./school-websites";
import type {
  AdmissionTrack,
  ApplicationStatus,
  Choice,
  ContactPatch,
  Deadline,
  DeadlinePatch,
  InterestLevel,
  Owner,
  Plan,
  School,
  SchoolContact,
  SchoolSeed,
  SelectivityTier,
  Step,
  ListPhaseId,
  VisitStatus,
  SchoolControl,
  ResidencyDataStatus,
  KyleResidency,
} from "./types";
import {
  fromSeed,
  isAdmissionTrack,
  isApplicationStatus,
  isChoice,
  isInterestLevel,
  isListPhaseId,
  isOwner,
  isPlan,
  isSelectivityTier,
  isVisitStatus,
  normalizeTrackedPrograms,
} from "./types";
import { normalizeSchoolProjectNotes } from "./school-project-notes";
import schoolsFile from "@/content/schools.json";
import { driveFieldsForSchool } from "./drive-matrix";
import { visitAddressForSchool } from "./school-photos";

type SchoolRow = {
  id: string;
  name: string;
  unit_id?: number | null;
  location: string;
  campus_setting?: string | null;
  metro_area?: string | null;
  metro_population?: number | null;
  undergrad_enrollment?: number | null;
  control?: string | null;
  residency_data_status?: string | null;
  kyle_residency?: string | null;
  in_state_admit_rate?: number | null;
  out_of_state_admit_rate?: number | null;
  overall_admit_rate?: number | null;
  rate_that_applies_to_kyle?: number | null;
  admit_data_year?: string | null;
  enrolled_out_of_state_pct?: number | null;
  out_of_state_definition?: string | null;
  out_of_state_policy?: string | null;
  engineering_residency_note?: string | null;
  residency_source_url?: string | null;
  residency_notes?: string | null;
  mechanical_engineering: string;
  materials: string;
  materials_offering: string;
  materials_program?: string | null;
  materials_source_url?: string | null;
  aerospace_engineering?: string | null;
  aerospace_program?: string | null;
  aerospace_notes?: string | null;
  aerospace_source_url?: string | null;
  admissions_context: string;
  sat_context: string;
  selectivity: string;
  notes: string;
  list_order: number;
  choice: string;
  plan: string;
  visited: boolean;
  visit_date: string | null;
  visit_notes: string;
  visit_status?: string | null;
  deadline: string | null;
  deadline_label: string;
  selectivity_tier: string;
  interest_level: string;
  application_status: string;
  admission_track: string;
  test_policy: string;
  family_test_policy?: string | null;
  test_policy_fall2028_status?: string | null;
  test_policy_term?: string | null;
  test_policy_detail?: string | null;
  test_policy_change?: string | null;
  test_policy_source_url?: string | null;
  test_policy_checked_date?: string | null;
  tracked_programs?: unknown;
  middle_50: string;
  application_platform: string;
  required_essays: string;
  teacher_recs: string;
  cost_of_attendance: string;
  net_price_estimate: string;
  merit_aid_notes: string;
  research_sources?: string | null;
  website?: string | null;
  scorecard_fetched_date?: string | null;
  drive_address?: string | null;
  research_completed?: string[] | null;
  list_phase?: string | null;
  phases_participated?: string[] | null;
  archived?: boolean | null;
  archived_at?: string | null;
  project_notes?: unknown;
  school_steps?: StepRow[] | null;
  deadlines?: DeadlineRow[] | null;
  contacts?: ContactRow[] | null;
};

type StepRow = {
  id: string;
  label: string;
  owner: string;
  done: boolean;
  sort_order: number;
};

type DeadlineRow = {
  id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
  sort_order: number;
};

type ContactRow = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
};

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function collegeDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return createClient(url, key, {
    db: { schema: "college" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function mapStep(row: StepRow): Step {
  return {
    id: row.id,
    label: row.label,
    owner: isOwner(row.owner) ? row.owner : "kyle",
    done: row.done,
    sortOrder: row.sort_order,
  };
}

function mapDeadline(row: DeadlineRow): Deadline {
  return {
    id: row.id,
    title: row.title,
    dueDate: row.due_date,
    completed: row.completed,
    sortOrder: row.sort_order,
  };
}

function mapContact(row: ContactRow): SchoolContact {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone,
  };
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function asControl(value: string | null | undefined): SchoolControl {
  return value === "Public" || value === "Private" ? value : "";
}

function asResidencyStatus(value: string | null | undefined): ResidencyDataStatus {
  return value === "Official" ||
    value === "Estimated" ||
    value === "Proxy" ||
    value === "Not applicable"
    ? value
    : "";
}

function asKyleResidency(value: string | null | undefined): KyleResidency {
  return value === "In-state" || value === "Out-of-state" || value === "Not applicable" ? value : "";
}

export function mapSchool(row: SchoolRow): School {
  const steps = (row.school_steps ?? []).map(mapStep).sort((a, b) => a.sortOrder - b.sortOrder);
  const deadlines = (row.deadlines ?? []).map(mapDeadline).sort((a, b) => a.sortOrder - b.sortOrder || (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const contacts = (row.contacts ?? []).map(mapContact).sort((a, b) => a.name.localeCompare(b.name));
  return {
    id: row.id,
    name: row.name,
    unitId:
      typeof row.unit_id === "number" && Number.isFinite(row.unit_id) ? Math.round(row.unit_id) : null,
    location: row.location,
    campusSetting: row.campus_setting ?? "",
    metroArea: row.metro_area ?? null,
    metroPopulation:
      typeof row.metro_population === "number" && Number.isFinite(row.metro_population)
        ? row.metro_population
        : null,
    undergradEnrollment:
      typeof row.undergrad_enrollment === "number" && Number.isFinite(row.undergrad_enrollment)
        ? row.undergrad_enrollment
        : null,
    control: asControl(row.control),
    residencyDataStatus: asResidencyStatus(row.residency_data_status),
    kyleResidency: asKyleResidency(row.kyle_residency),
    inStateAdmitRate: asFiniteNumber(row.in_state_admit_rate),
    outOfStateAdmitRate: asFiniteNumber(row.out_of_state_admit_rate),
    overallAdmitRate: asFiniteNumber(row.overall_admit_rate),
    rateThatAppliesToKyle: asFiniteNumber(row.rate_that_applies_to_kyle),
    admitDataYear: row.admit_data_year ?? "",
    enrolledOutOfStatePct: asFiniteNumber(row.enrolled_out_of_state_pct),
    outOfStateDefinition: row.out_of_state_definition ?? "",
    outOfStatePolicy: row.out_of_state_policy ?? "",
    engineeringResidencyNote: row.engineering_residency_note ?? "",
    residencySourceUrl: row.residency_source_url ?? "",
    residencyNotes: row.residency_notes ?? "",
    mechanicalEngineering: row.mechanical_engineering,
    materials: row.materials,
    materialsOffering: row.materials_offering,
    materialsProgram: row.materials_program ?? "",
    materialsSourceUrl: row.materials_source_url ?? "",
    aerospaceEngineering: row.aerospace_engineering ?? "",
    aerospaceProgram: row.aerospace_program ?? "",
    aerospaceNotes: row.aerospace_notes ?? "",
    aerospaceSourceUrl: row.aerospace_source_url ?? "",
    admissionsContext: row.admissions_context,
    satContext: row.sat_context,
    selectivity: row.selectivity,
    notes: row.notes,
    listOrder: row.list_order,
    choice: isChoice(row.choice) ? row.choice : "unsure",
    plan: isPlan(row.plan) ? row.plan : "",
    visited: row.visited,
    visitStatus: isVisitStatus(row.visit_status ?? "")
      ? (row.visit_status as VisitStatus)
      : row.visited
        ? "visited"
        : "",
    visitDate: row.visit_date,
    visitNotes: row.visit_notes,
    visitAddress: visitAddressForSchool(row.name),
    ...driveFieldsForSchool(row.id),
    deadline: row.deadline,
    deadlineLabel: row.deadline_label,
    selectivityTier: isSelectivityTier(row.selectivity_tier) ? row.selectivity_tier : "",
    interestLevel: isInterestLevel(row.interest_level) ? row.interest_level : "",
    applicationStatus: isApplicationStatus(row.application_status) ? row.application_status : "",
    admissionTrack: isAdmissionTrack(row.admission_track) ? row.admission_track : "",
    testPolicy: row.test_policy ?? "",
    familyTestPolicy: row.family_test_policy ?? "",
    testPolicyFall2028Status: row.test_policy_fall2028_status ?? "",
    testPolicyTerm: row.test_policy_term ?? "",
    testPolicyDetail: row.test_policy_detail ?? "",
    testPolicyChange: row.test_policy_change ?? null,
    testPolicySourceUrl: row.test_policy_source_url ?? "",
    testPolicyCheckedDate: row.test_policy_checked_date ?? "",
    trackedPrograms: normalizeTrackedPrograms(
      row.tracked_programs,
      row.mechanical_engineering ?? "",
      row.materials ?? "",
      row.aerospace_engineering ?? "",
    ),
    middle50: row.middle_50 ?? "",
    applicationPlatform: row.application_platform ?? "",
    requiredEssays: row.required_essays ?? "",
    teacherRecs: row.teacher_recs ?? "",
    costOfAttendance: row.cost_of_attendance ?? "",
    netPriceEstimate: row.net_price_estimate ?? "",
    meritAidNotes: row.merit_aid_notes ?? "",
    researchSources: row.research_sources ?? "",
    website: row.website || knownWebsite(row.id),
    scorecardFetchedDate: row.scorecard_fetched_date ?? "",
    driveAddress: row.drive_address ?? "",
    researchCompleted: Array.isArray(row.research_completed)
      ? row.research_completed.filter((value): value is string => typeof value === "string")
      : [],
    listPhase: isListPhaseId(row.list_phase ?? "") ? (row.list_phase as ListPhaseId) : "exploration",
    phasesParticipated: (row.phases_participated ?? ["exploration"]).filter(isListPhaseId),
    archived: Boolean(row.archived),
    archivedAt: row.archived_at ?? null,
    steps,
    deadlines,
    contacts,
    projectNotes: normalizeSchoolProjectNotes(row.project_notes),
  };
}

const SCHOOL_COLUMNS =
  "id, name, unit_id, location, campus_setting, metro_area, metro_population, undergrad_enrollment, control, residency_data_status, kyle_residency, in_state_admit_rate, out_of_state_admit_rate, overall_admit_rate, rate_that_applies_to_kyle, admit_data_year, enrolled_out_of_state_pct, out_of_state_definition, out_of_state_policy, engineering_residency_note, residency_source_url, residency_notes, mechanical_engineering, materials, materials_offering, materials_program, materials_source_url, aerospace_engineering, aerospace_program, aerospace_notes, aerospace_source_url, admissions_context, sat_context, selectivity, notes, list_order, choice, plan, visited, visit_date, visit_notes, visit_status, deadline, deadline_label, selectivity_tier, interest_level, application_status, admission_track, test_policy, family_test_policy, test_policy_fall2028_status, test_policy_term, test_policy_detail, test_policy_change, test_policy_source_url, test_policy_checked_date, tracked_programs, middle_50, application_platform, required_essays, teacher_recs, cost_of_attendance, net_price_estimate, merit_aid_notes, research_sources, website, scorecard_fetched_date, drive_address, research_completed, list_phase, phases_participated, archived, archived_at, project_notes, school_steps(id, label, owner, done, sort_order), deadlines(id, title, due_date, completed, sort_order), contacts(id, name, role, email, phone)";

export async function listSchools(): Promise<School[]> {
  if (!supabaseConfigured()) return seedSchools();
  try {
    const { loadDriveExtras } = await import("@/lib/driveMatrix");
    await loadDriveExtras();
  } catch (error) {
    console.error("Drive extras load failed", error);
  }
  const db = collegeDb();
  const { data, error } = await db
    .from("schools")
    .select(SCHOOL_COLUMNS)
    .order("list_order", { ascending: true });
  if (error) throw error;
  if (!data || data.length === 0) return seedSchools();
  return (data as SchoolRow[]).map(mapSchool);
}

export function slugify(name: string): string {
  const paren = name.match(/\(([^)]+)\)\s*$/);
  const raw = (paren?.[1] ?? name).toLowerCase().replace(/&/g, " and ");
  return raw
    .replace(/–/g, " ")
    .replace(/—/g, " ")
    .replace(/-/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createSchool(name: string): Promise<School> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("School name is required");
  if (!supabaseConfigured()) {
    return fromSeed({
      id: slugify(trimmed) || "school",
      name: trimmed,
      location: "",
      campusSetting: "",
      metroArea: null,
      metroPopulation: null,
      mechanicalEngineering: "",
      materials: "",
      materialsOffering: "",
      admissionsContext: "",
      satContext: "",
      selectivity: "",
      notes: "",
      listOrder: 999,
    });
  }
  const db = collegeDb();
  const { data: existing } = await db.from("schools").select("id, list_order");
  const ids = new Set((existing ?? []).map((row) => row.id as string));
  let id = slugify(trimmed) || "school";
  let n = 2;
  while (ids.has(id)) {
    id = `${slugify(trimmed) || "school"}-${n}`;
    n += 1;
  }
  const listOrder =
    Math.max(0, ...(existing ?? []).map((row) => Number(row.list_order) || 0)) + 1;
  const { data, error } = await db
    .from("schools")
    .insert({
      id,
      name: trimmed,
      list_order: listOrder,
      list_phase: "exploration",
      phases_participated: ["exploration"],
      archived: false,
    })
    .select(SCHOOL_COLUMNS)
    .single();
  if (error) throw error;
  return mapSchool(data as SchoolRow);
}

const PATCH_COLUMNS: Record<string, string> = {
  name: "name",
  location: "location",
  campusSetting: "campus_setting",
  mechanicalEngineering: "mechanical_engineering",
  materials: "materials",
  materialsOffering: "materials_offering",
  materialsProgram: "materials_program",
  materialsSourceUrl: "materials_source_url",
  aerospaceEngineering: "aerospace_engineering",
  aerospaceProgram: "aerospace_program",
  aerospaceNotes: "aerospace_notes",
  aerospaceSourceUrl: "aerospace_source_url",
  admissionsContext: "admissions_context",
  satContext: "sat_context",
  selectivity: "selectivity",
  notes: "notes",
  visitNotes: "visit_notes",
  deadlineLabel: "deadline_label",
  testPolicy: "test_policy",
  testPolicyFall2028Status: "test_policy_fall2028_status",
  testPolicyTerm: "test_policy_term",
  testPolicyDetail: "test_policy_detail",
  testPolicySourceUrl: "test_policy_source_url",
  testPolicyCheckedDate: "test_policy_checked_date",
  middle50: "middle_50",
  applicationPlatform: "application_platform",
  requiredEssays: "required_essays",
  teacherRecs: "teacher_recs",
  costOfAttendance: "cost_of_attendance",
  netPriceEstimate: "net_price_estimate",
  meritAidNotes: "merit_aid_notes",
  researchSources: "research_sources",
  website: "website",
  scorecardFetchedDate: "scorecard_fetched_date",
  driveAddress: "drive_address",
  admitDataYear: "admit_data_year",
  outOfStateDefinition: "out_of_state_definition",
  outOfStatePolicy: "out_of_state_policy",
  engineeringResidencyNote: "engineering_residency_note",
  residencySourceUrl: "residency_source_url",
  residencyNotes: "residency_notes",
};

function patchNullableNumber(
  row: Record<string, unknown>,
  patch: Record<string, unknown>,
  key: string,
  column: string,
  options?: { min?: number },
): void {
  if (!(key in patch)) return;
  const value = patch[key];
  if (value === null) {
    row[column] = null;
    return;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (options?.min != null && value < options.min) return;
    row[column] = value;
  }
}

export function schoolPatchToRow(patch: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [key, column] of Object.entries(PATCH_COLUMNS)) {
    if (typeof patch[key] === "string") row[column] = patch[key];
  }
  if (typeof patch.choice === "string" && isChoice(patch.choice)) row.choice = patch.choice as Choice;
  if (typeof patch.plan === "string" && isPlan(patch.plan)) row.plan = patch.plan as Plan;
  if (typeof patch.selectivityTier === "string" && isSelectivityTier(patch.selectivityTier)) {
    row.selectivity_tier = patch.selectivityTier as SelectivityTier;
  }
  if (typeof patch.interestLevel === "string" && isInterestLevel(patch.interestLevel)) {
    row.interest_level = patch.interestLevel as InterestLevel;
  }
  if (typeof patch.visitStatus === "string" && isVisitStatus(patch.visitStatus)) {
    row.visit_status = patch.visitStatus as VisitStatus;
    row.visited = patch.visitStatus === "visited";
  }
  if (typeof patch.applicationStatus === "string" && isApplicationStatus(patch.applicationStatus)) {
    row.application_status = patch.applicationStatus as ApplicationStatus;
  }
  if (typeof patch.admissionTrack === "string" && isAdmissionTrack(patch.admissionTrack)) {
    row.admission_track = patch.admissionTrack as AdmissionTrack;
  }
  if (typeof patch.familyTestPolicy === "string") {
    row.family_test_policy = patch.familyTestPolicy;
  }
  if (typeof patch.control === "string") {
    const control = asControl(patch.control);
    if (control) row.control = control;
  }
  if (typeof patch.residencyDataStatus === "string") {
    row.residency_data_status = asResidencyStatus(patch.residencyDataStatus);
  }
  if (typeof patch.kyleResidency === "string") {
    row.kyle_residency = asKyleResidency(patch.kyleResidency);
  }
  if (patch.testPolicyChange === null) {
    row.test_policy_change = null;
  } else if (typeof patch.testPolicyChange === "string") {
    row.test_policy_change = patch.testPolicyChange;
  }
  if (patch.undergradEnrollment === null) {
    row.undergrad_enrollment = null;
  } else if (
    typeof patch.undergradEnrollment === "number" &&
    Number.isFinite(patch.undergradEnrollment) &&
    patch.undergradEnrollment >= 0
  ) {
    row.undergrad_enrollment = Math.round(patch.undergradEnrollment);
  }
  if (patch.metroArea === null) {
    row.metro_area = null;
  } else if (typeof patch.metroArea === "string") {
    row.metro_area = patch.metroArea;
  }
  if (patch.metroPopulation === null) {
    row.metro_population = null;
  } else if (
    typeof patch.metroPopulation === "number" &&
    Number.isFinite(patch.metroPopulation) &&
    patch.metroPopulation >= 0
  ) {
    row.metro_population = Math.round(patch.metroPopulation);
  }
  patchNullableNumber(row, patch, "inStateAdmitRate", "in_state_admit_rate");
  patchNullableNumber(row, patch, "outOfStateAdmitRate", "out_of_state_admit_rate");
  patchNullableNumber(row, patch, "overallAdmitRate", "overall_admit_rate");
  patchNullableNumber(row, patch, "rateThatAppliesToKyle", "rate_that_applies_to_kyle");
  patchNullableNumber(row, patch, "enrolledOutOfStatePct", "enrolled_out_of_state_pct", {
    min: 0,
  });
  if (Array.isArray(patch.trackedPrograms)) {
    row.tracked_programs = patch.trackedPrograms.filter((value): value is string => typeof value === "string");
  }
  if (Array.isArray(patch.researchCompleted)) {
    row.research_completed = patch.researchCompleted.filter(
      (value): value is string => typeof value === "string",
    );
  }
  if (
    typeof patch.unitId === "number" &&
    Number.isFinite(patch.unitId) &&
    patch.unitId > 0
  ) {
    row.unit_id = Math.round(patch.unitId);
  } else if (patch.unitId === null) {
    row.unit_id = null;
  }
  if (typeof patch.listPhase === "string" && isListPhaseId(patch.listPhase)) {
    row.list_phase = patch.listPhase;
  }
  if (Array.isArray(patch.phasesParticipated)) {
    row.phases_participated = patch.phasesParticipated.filter(
      (value): value is ListPhaseId => typeof value === "string" && isListPhaseId(value),
    );
  }
  if (typeof patch.archived === "boolean") {
    row.archived = patch.archived;
    if (patch.archived) row.archived_at = new Date().toISOString();
    else row.archived_at = null;
  }
  if (patch.archivedAt === null || typeof patch.archivedAt === "string") {
    if ("archivedAt" in patch) row.archived_at = patch.archivedAt || null;
  }
  if (typeof patch.visited === "boolean") row.visited = patch.visited;
  if (patch.visitDate === null || typeof patch.visitDate === "string") {
    if ("visitDate" in patch) row.visit_date = patch.visitDate || null;
  }
  if (patch.deadline === null || typeof patch.deadline === "string") {
    if ("deadline" in patch) row.deadline = patch.deadline || null;
  }
  if (Array.isArray(patch.projectNotes)) {
    row.project_notes = normalizeSchoolProjectNotes(patch.projectNotes);
  }
  return row;
}

export async function updateSchool(id: string, patch: Record<string, unknown>): Promise<School> {
  if (!supabaseConfigured()) throw new Error("Supabase is not configured");
  const db = collegeDb();
  const { data, error } = await db
    .from("schools")
    .update(schoolPatchToRow(patch))
    .eq("id", id)
    .select(SCHOOL_COLUMNS)
    .single();
  if (error) throw error;
  return mapSchool(data as SchoolRow);
}

export async function applySchoolFacts(
  id: string,
  facts: FoundFacts,
  options?: { onlyBlank?: boolean },
): Promise<School> {
  const onlyBlank = Boolean(options?.onlyBlank);
  const current = onlyBlank ? await getSchool(id) : null;
  const patch: Record<string, unknown> = {};
  const fields: [keyof FoundFacts, keyof School][] = [
    ["location", "location"],
    ["campusSetting", "campusSetting"],
    ["mechanicalEngineering", "mechanicalEngineering"],
    ["materials", "materials"],
    ["materialsOffering", "materialsOffering"],
    ["admissionsContext", "admissionsContext"],
    ["satContext", "satContext"],
    ["testPolicy", "testPolicy"],
    ["middle50", "middle50"],
    ["applicationPlatform", "applicationPlatform"],
    ["requiredEssays", "requiredEssays"],
    ["teacherRecs", "teacherRecs"],
    ["costOfAttendance", "costOfAttendance"],
    ["netPriceEstimate", "netPriceEstimate"],
    ["meritAidNotes", "meritAidNotes"],
    ["website", "website"],
  ];
  for (const [factKey, schoolKey] of fields) {
    const value = facts[factKey];
    if (typeof value !== "string" || !value) continue;
    if (onlyBlank && current) {
      const existing = current[schoolKey];
      if (typeof existing === "string" && existing.trim()) continue;
    }
    patch[schoolKey] = value;
  }
  if (
    facts.undergradEnrollment != null &&
    Number.isFinite(facts.undergradEnrollment) &&
    (!onlyBlank || current?.undergradEnrollment == null)
  ) {
    patch.undergradEnrollment = facts.undergradEnrollment;
  }
  const sources = formatSources(facts.sources);
  if (sources && (!onlyBlank || !current?.researchSources?.trim())) {
    patch.researchSources = sources;
  }
  let school = Object.keys(patch).length ? await updateSchool(id, patch) : current ?? (await getSchool(id));
  if (facts.deadlines.length) {
    const existingTitles = new Set(
      (school.deadlines ?? []).map((deadline) => deadline.title.trim().toLowerCase()).filter(Boolean),
    );
    for (const deadline of facts.deadlines) {
      const title = deadline.title.trim();
      if (!title) continue;
      if (onlyBlank && existingTitles.has(title.toLowerCase())) continue;
      school = await addDeadline(id, title, deadline.dueDate);
      existingTitles.add(title.toLowerCase());
    }
  }
  return school;
}

export async function deleteSchool(id: string): Promise<void> {
  if (!supabaseConfigured()) throw new Error("Supabase is not configured");
  const db = collegeDb();
  const { error } = await db.from("schools").delete().eq("id", id);
  if (error) throw error;
}

export async function addStep(schoolId: string, label: string, owner: Owner): Promise<School> {
  if (!supabaseConfigured()) throw new Error("Supabase is not configured");
  const db = collegeDb();
  const { data: current } = await db
    .from("school_steps")
    .select("sort_order")
    .eq("school_id", schoolId);
  const sortOrder = Math.max(-1, ...(current ?? []).map((row) => Number(row.sort_order) || 0)) + 1;
  const { error } = await db.from("school_steps").insert({
    school_id: schoolId,
    label: label.trim(),
    owner,
    sort_order: sortOrder,
  });
  if (error) throw error;
  return getSchool(schoolId);
}

export async function updateStep(
  schoolId: string,
  stepId: string,
  patch: { done?: boolean; owner?: Owner; label?: string },
): Promise<School> {
  if (!supabaseConfigured()) throw new Error("Supabase is not configured");
  const db = collegeDb();
  const row: Record<string, unknown> = {};
  if (typeof patch.done === "boolean") row.done = patch.done;
  if (patch.owner && isOwner(patch.owner)) row.owner = patch.owner;
  if (typeof patch.label === "string" && patch.label.trim()) row.label = patch.label.trim();
  const { error } = await db.from("school_steps").update(row).eq("id", stepId).eq("school_id", schoolId);
  if (error) throw error;
  return getSchool(schoolId);
}

export async function deleteStep(schoolId: string, stepId: string): Promise<School> {
  if (!supabaseConfigured()) throw new Error("Supabase is not configured");
  const db = collegeDb();
  const { error } = await db.from("school_steps").delete().eq("id", stepId).eq("school_id", schoolId);
  if (error) throw error;
  return getSchool(schoolId);
}

export async function addDeadline(schoolId: string, title: string, dueDate: string | null): Promise<School> {
  if (!supabaseConfigured()) throw new Error("Supabase is not configured");
  const db = collegeDb();
  const { data: current } = await db.from("deadlines").select("sort_order").eq("school_id", schoolId);
  const sortOrder = Math.max(-1, ...(current ?? []).map((row) => Number(row.sort_order) || 0)) + 1;
  const { error } = await db.from("deadlines").insert({
    school_id: schoolId,
    title: title.trim(),
    due_date: dueDate || null,
    sort_order: sortOrder,
  });
  if (error) throw error;
  return getSchool(schoolId);
}

export async function updateDeadline(schoolId: string, deadlineId: string, patch: DeadlinePatch): Promise<School> {
  if (!supabaseConfigured()) throw new Error("Supabase is not configured");
  const db = collegeDb();
  const row: Record<string, unknown> = {};
  if (typeof patch.title === "string" && patch.title.trim()) row.title = patch.title.trim();
  if (typeof patch.completed === "boolean") row.completed = patch.completed;
  if (patch.dueDate === null || typeof patch.dueDate === "string") {
    if ("dueDate" in patch) row.due_date = patch.dueDate || null;
  }
  const { error } = await db.from("deadlines").update(row).eq("id", deadlineId).eq("school_id", schoolId);
  if (error) throw error;
  return getSchool(schoolId);
}

export async function deleteDeadline(schoolId: string, deadlineId: string): Promise<School> {
  if (!supabaseConfigured()) throw new Error("Supabase is not configured");
  const db = collegeDb();
  const { error } = await db.from("deadlines").delete().eq("id", deadlineId).eq("school_id", schoolId);
  if (error) throw error;
  return getSchool(schoolId);
}

export async function addContact(schoolId: string, contact: ContactPatch): Promise<School> {
  if (!supabaseConfigured()) throw new Error("Supabase is not configured");
  const name = contact.name?.trim() ?? "";
  if (!name) throw new Error("Contact name is required");
  const db = collegeDb();
  const { error } = await db.from("contacts").insert({
    school_id: schoolId,
    name,
    role: contact.role?.trim() ?? "",
    email: contact.email?.trim() ?? "",
    phone: contact.phone?.trim() ?? "",
  });
  if (error) throw error;
  return getSchool(schoolId);
}

export async function updateContact(schoolId: string, contactId: string, patch: ContactPatch): Promise<School> {
  if (!supabaseConfigured()) throw new Error("Supabase is not configured");
  const db = collegeDb();
  const row: Record<string, unknown> = {};
  if (typeof patch.name === "string") row.name = patch.name.trim();
  if (typeof patch.role === "string") row.role = patch.role.trim();
  if (typeof patch.email === "string") row.email = patch.email.trim();
  if (typeof patch.phone === "string") row.phone = patch.phone.trim();
  const { error } = await db.from("contacts").update(row).eq("id", contactId).eq("school_id", schoolId);
  if (error) throw error;
  return getSchool(schoolId);
}

export async function deleteContact(schoolId: string, contactId: string): Promise<School> {
  if (!supabaseConfigured()) throw new Error("Supabase is not configured");
  const db = collegeDb();
  const { error } = await db.from("contacts").delete().eq("id", contactId).eq("school_id", schoolId);
  if (error) throw error;
  return getSchool(schoolId);
}

export async function getSchool(id: string): Promise<School> {
  const db = collegeDb();
  const { data, error } = await db.from("schools").select(SCHOOL_COLUMNS).eq("id", id).single();
  if (error) throw error;
  return mapSchool(data as SchoolRow);
}

export function seedById(id: string): School | undefined {
  const seed = (schoolsFile.schools as SchoolSeed[]).find((school) => school.id === id);
  return seed ? fromSeed(seed) : undefined;
}

export type MemberPrefsRow = {
  collegesColumns: Record<string, string[]>;
  showArchived: boolean;
  collegesSort: { key: string; dir: 1 | -1 };
};

function parseCollegesSort(raw: unknown): { key: string; dir: 1 | -1 } {
  if (!raw || typeof raw !== "object") return { key: "list", dir: 1 };
  const input = raw as { key?: unknown; dir?: unknown };
  const key = typeof input.key === "string" && input.key.trim() ? input.key.trim() : "list";
  const dir = input.dir === -1 || input.dir === "-1" ? (-1 as const) : (1 as const);
  return { key, dir };
}

export async function getMemberPrefs(memberId: string): Promise<MemberPrefsRow> {
  if (!supabaseConfigured() || memberId === "local") {
    return { collegesColumns: {}, showArchived: false, collegesSort: { key: "list", dir: 1 } };
  }
  const db = collegeDb();
  const { data, error } = await db
    .from("member_prefs")
    .select("colleges_columns, show_archived, colleges_sort")
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) throw error;
  const columns =
    data?.colleges_columns && typeof data.colleges_columns === "object"
      ? (data.colleges_columns as Record<string, string[]>)
      : {};
  return {
    collegesColumns: columns,
    showArchived: Boolean(data?.show_archived),
    collegesSort: parseCollegesSort(data?.colleges_sort),
  };
}

export async function upsertMemberPrefs(
  memberId: string,
  patch: {
    collegesColumns?: Record<string, string[]>;
    showArchived?: boolean;
    collegesSort?: { key: string; dir: 1 | -1 };
  },
): Promise<MemberPrefsRow> {
  if (!supabaseConfigured() || memberId === "local") {
    return {
      collegesColumns: patch.collegesColumns ?? {},
      showArchived: Boolean(patch.showArchived),
      collegesSort: patch.collegesSort ?? { key: "list", dir: 1 },
    };
  }
  const current = await getMemberPrefs(memberId);
  const next = {
    member_id: memberId,
    colleges_columns: patch.collegesColumns ?? current.collegesColumns,
    show_archived: patch.showArchived ?? current.showArchived,
    colleges_sort: patch.collegesSort ?? current.collegesSort,
    updated_at: new Date().toISOString(),
  };
  const db = collegeDb();
  const { data, error } = await db
    .from("member_prefs")
    .upsert(next, { onConflict: "member_id" })
    .select("colleges_columns, show_archived, colleges_sort")
    .single();
  if (error) throw error;
  return {
    collegesColumns:
      data.colleges_columns && typeof data.colleges_columns === "object"
        ? (data.colleges_columns as Record<string, string[]>)
        : {},
    showArchived: Boolean(data.show_archived),
    collegesSort: parseCollegesSort(data.colleges_sort),
  };
}
