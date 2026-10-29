/**
 * Professor Roadmap data access. Service-role, MCP-safe (no Next.js imports),
 * so the project page, server actions, and JasonOS MCP share it.
 */
import { hasSupabaseConfig, jasonosDb } from "@/lib/mcp/db";
import type {
  DecisionOption,
  DecisionStatus,
  NextStepStatus,
  NextStepWrite,
  PersonUpsert,
  PostingUpsert,
  ProfessorDecision,
  ProfessorNextStep,
  ProfessorQuestion,
  ProfessorRoadmap,
  ProfessorSchool,
  ProfessorSchoolPerson,
  ProfessorSchoolPosting,
  QuestionStatus,
  QuestionWrite,
  ResearchSource,
  RoleKind,
  SchoolWrite,
} from "./types";
import {
  DECISION_STATUSES,
  NEXT_STEP_STATUSES,
  QUESTION_STATUSES,
  ROLE_KINDS,
} from "./types";

function fail(error: { message: string }): never {
  throw new Error(error.message);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asSources(value: unknown): ResearchSource[] {
  if (!Array.isArray(value)) return [];
  const out: ResearchSource[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as { title?: unknown; url?: unknown };
    const url = asString(row.url).trim();
    if (!url) continue;
    out.push({
      title: typeof row.title === "string" ? row.title : null,
      url,
    });
  }
  return out;
}

function asOptions(value: unknown): DecisionOption[] {
  if (!Array.isArray(value)) return [];
  const out: DecisionOption[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as { name?: unknown; pros?: unknown; cons?: unknown };
    const name = asString(row.name).trim();
    if (!name) continue;
    out.push({
      name,
      pros: asString(row.pros),
      cons: asString(row.cons),
    });
  }
  return out;
}

function asUuidArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && id.length > 0);
}

function asQuestionStatus(value: unknown): QuestionStatus {
  const s = asString(value, "open");
  return (QUESTION_STATUSES as readonly string[]).includes(s)
    ? (s as QuestionStatus)
    : "open";
}

function asDecisionStatus(value: unknown): DecisionStatus {
  const s = asString(value, "open");
  return (DECISION_STATUSES as readonly string[]).includes(s)
    ? (s as DecisionStatus)
    : "open";
}

function asNextStepStatus(value: unknown): NextStepStatus {
  const s = asString(value, "open");
  return (NEXT_STEP_STATUSES as readonly string[]).includes(s)
    ? (s as NextStepStatus)
    : "open";
}

function asRoleKind(value: unknown): RoleKind {
  const s = asString(value, "faculty");
  return (ROLE_KINDS as readonly string[]).includes(s) ? (s as RoleKind) : "other";
}

function rowToPerson(row: Record<string, unknown>): ProfessorSchoolPerson {
  return {
    id: asString(row.id),
    schoolId: asString(row.school_id),
    name: asString(row.name),
    title: asString(row.title),
    roleKind: asRoleKind(row.role_kind),
    profileUrl: asString(row.profile_url),
    contactId: asNullableString(row.contact_id),
    createdAt: asString(row.created_at),
  };
}

function rowToPosting(row: Record<string, unknown>): ProfessorSchoolPosting {
  return {
    id: asString(row.id),
    schoolId: asString(row.school_id),
    title: asString(row.title),
    url: asString(row.url),
    department: asString(row.department),
    degreeRequired: asString(row.degree_required),
    seenAt: asString(row.seen_at),
  };
}

function rowToSchool(
  row: Record<string, unknown>,
  people: ProfessorSchoolPerson[],
  postings: ProfessorSchoolPosting[]
): ProfessorSchool {
  return {
    id: asString(row.id),
    slug: asString(row.slug),
    name: asString(row.name),
    businessSchool: asString(row.business_school),
    department: asString(row.department),
    website: asString(row.website),
    facultyUrl: asString(row.faculty_url),
    jobsUrl: asString(row.jobs_url),
    isPrimary: asBool(row.is_primary),
    briefMd: asString(row.brief_md),
    briefSources: asSources(row.brief_sources),
    briefRefreshedAt: asNullableString(row.brief_refreshed_at),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    people,
    postings,
  };
}

function rowToQuestion(row: Record<string, unknown>): ProfessorQuestion {
  return {
    id: asString(row.id),
    schoolId: asNullableString(row.school_id),
    sortOrder: asNumber(row.sort_order),
    question: asString(row.question),
    whyItMatters: asString(row.why_it_matters),
    status: asQuestionStatus(row.status),
    findingMd: asString(row.finding_md),
    findingSources: asSources(row.finding_sources),
    researchedAt: asNullableString(row.researched_at),
    confirmedBy: asString(row.confirmed_by),
    confirmedAt: asNullableString(row.confirmed_at),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function rowToDecision(row: Record<string, unknown>): ProfessorDecision {
  return {
    id: asString(row.id),
    sortOrder: asNumber(row.sort_order),
    title: asString(row.title),
    whyItMatters: asString(row.why_it_matters),
    options: asOptions(row.options),
    dependsOnQuestionIds: asUuidArray(row.depends_on_question_ids),
    proposedOption: asString(row.proposed_option),
    proposedRationaleMd: asString(row.proposed_rationale_md),
    proposedAt: asNullableString(row.proposed_at),
    decidedOption: asString(row.decided_option),
    decidedNote: asString(row.decided_note),
    decidedAt: asNullableString(row.decided_at),
    status: asDecisionStatus(row.status),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function rowToNextStep(row: Record<string, unknown>): ProfessorNextStep {
  return {
    id: asString(row.id),
    schoolId: asNullableString(row.school_id),
    questionId: asNullableString(row.question_id),
    decisionId: asNullableString(row.decision_id),
    sortOrder: asNumber(row.sort_order),
    text: asString(row.text),
    rationale: asString(row.rationale),
    status: asNextStepStatus(row.status),
    todoId: asNullableString(row.todo_id),
    generated: asBool(row.generated),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    completedAt: asNullableString(row.completed_at),
  };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function getProfessorRoadmap(): Promise<ProfessorRoadmap> {
  if (!hasSupabaseConfig()) {
    return { schools: [], questions: [], decisions: [], nextSteps: [] };
  }

  const db = jasonosDb();
  const [
    { data: schoolRows, error: schoolError },
    { data: peopleRows, error: peopleError },
    { data: postingRows, error: postingError },
    { data: questionRows, error: questionError },
    { data: decisionRows, error: decisionError },
    { data: stepRows, error: stepError },
  ] = await Promise.all([
    db
      .from("professor_schools")
      .select(
        "id,slug,name,business_school,department,website,faculty_url,jobs_url,is_primary,brief_md,brief_sources,brief_refreshed_at,created_at,updated_at"
      )
      .order("is_primary", { ascending: false })
      .order("name", { ascending: true }),
    db
      .from("professor_school_people")
      .select("id,school_id,name,title,role_kind,profile_url,contact_id,created_at")
      .order("name", { ascending: true }),
    db
      .from("professor_school_postings")
      .select("id,school_id,title,url,department,degree_required,seen_at")
      .order("seen_at", { ascending: false }),
    db
      .from("professor_questions")
      .select(
        "id,school_id,sort_order,question,why_it_matters,status,finding_md,finding_sources,researched_at,confirmed_by,confirmed_at,created_at,updated_at"
      )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    db
      .from("professor_decisions")
      .select(
        "id,sort_order,title,why_it_matters,options,depends_on_question_ids,proposed_option,proposed_rationale_md,proposed_at,decided_option,decided_note,decided_at,status,created_at,updated_at"
      )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    db
      .from("professor_next_steps")
      .select(
        "id,school_id,question_id,decision_id,sort_order,text,rationale,status,todo_id,generated,created_at,updated_at,completed_at"
      )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (schoolError) fail(schoolError);
  if (peopleError) fail(peopleError);
  if (postingError) fail(postingError);
  if (questionError) fail(questionError);
  if (decisionError) fail(decisionError);
  if (stepError) fail(stepError);

  const peopleBySchool = new Map<string, ProfessorSchoolPerson[]>();
  for (const row of peopleRows ?? []) {
    const person = rowToPerson(row as Record<string, unknown>);
    const list = peopleBySchool.get(person.schoolId) ?? [];
    list.push(person);
    peopleBySchool.set(person.schoolId, list);
  }

  const postingsBySchool = new Map<string, ProfessorSchoolPosting[]>();
  for (const row of postingRows ?? []) {
    const posting = rowToPosting(row as Record<string, unknown>);
    const list = postingsBySchool.get(posting.schoolId) ?? [];
    list.push(posting);
    postingsBySchool.set(posting.schoolId, list);
  }

  const schools = (schoolRows ?? []).map((row) => {
    const rec = row as Record<string, unknown>;
    const id = asString(rec.id);
    return rowToSchool(
      rec,
      peopleBySchool.get(id) ?? [],
      postingsBySchool.get(id) ?? []
    );
  });

  return {
    schools,
    questions: (questionRows ?? []).map((row) =>
      rowToQuestion(row as Record<string, unknown>)
    ),
    decisions: (decisionRows ?? []).map((row) =>
      rowToDecision(row as Record<string, unknown>)
    ),
    nextSteps: (stepRows ?? []).map((row) =>
      rowToNextStep(row as Record<string, unknown>)
    ),
  };
}

export async function addSchool(input: SchoolWrite): Promise<ProfessorSchool> {
  const db = jasonosDb();
  const slug = (input.slug || slugify(input.name)).trim();
  if (!slug) throw new Error("Slug is required.");
  if (!input.name.trim()) throw new Error("Name is required.");

  const { data, error } = await db
    .from("professor_schools")
    .insert({
      slug,
      name: input.name.trim(),
      business_school: input.businessSchool?.trim() ?? "",
      department: input.department?.trim() ?? "",
      website: input.website?.trim() ?? "",
      faculty_url: input.facultyUrl?.trim() ?? "",
      jobs_url: input.jobsUrl?.trim() ?? "",
      is_primary: input.isPrimary ?? false,
    })
    .select(
      "id,slug,name,business_school,department,website,faculty_url,jobs_url,is_primary,brief_md,brief_sources,brief_refreshed_at,created_at,updated_at"
    )
    .single();
  if (error) fail(error);
  return rowToSchool(data as Record<string, unknown>, [], []);
}

export async function updateSchool(
  id: string,
  patch: Partial<SchoolWrite> & {
    briefMd?: string;
    briefSources?: ResearchSource[];
    briefRefreshedAt?: string | null;
  }
): Promise<ProfessorSchool> {
  const db = jasonosDb();
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.businessSchool !== undefined)
    update.business_school = patch.businessSchool.trim();
  if (patch.department !== undefined) update.department = patch.department.trim();
  if (patch.website !== undefined) update.website = patch.website.trim();
  if (patch.facultyUrl !== undefined) update.faculty_url = patch.facultyUrl.trim();
  if (patch.jobsUrl !== undefined) update.jobs_url = patch.jobsUrl.trim();
  if (patch.isPrimary !== undefined) update.is_primary = patch.isPrimary;
  if (patch.briefMd !== undefined) update.brief_md = patch.briefMd;
  if (patch.briefSources !== undefined) update.brief_sources = patch.briefSources;
  if (patch.briefRefreshedAt !== undefined)
    update.brief_refreshed_at = patch.briefRefreshedAt;

  const { data, error } = await db
    .from("professor_schools")
    .update(update)
    .eq("id", id)
    .select(
      "id,slug,name,business_school,department,website,faculty_url,jobs_url,is_primary,brief_md,brief_sources,brief_refreshed_at,created_at,updated_at"
    )
    .single();
  if (error) fail(error);

  const roadmap = await getProfessorRoadmap();
  const school = roadmap.schools.find((s) => s.id === id);
  return school ?? rowToSchool(data as Record<string, unknown>, [], []);
}

export async function removeSchool(id: string): Promise<void> {
  const db = jasonosDb();
  const { error } = await db.from("professor_schools").delete().eq("id", id);
  if (error) fail(error);
}

export async function addQuestion(
  input: QuestionWrite
): Promise<ProfessorQuestion> {
  const db = jasonosDb();
  const question = input.question.trim();
  if (!question) throw new Error("Question is required.");

  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const { data: maxRows, error: maxError } = await db
      .from("professor_questions")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);
    if (maxError) fail(maxError);
    sortOrder = asNumber(maxRows?.[0]?.sort_order, 0) + 1;
  }

  const { data, error } = await db
    .from("professor_questions")
    .insert({
      school_id: input.schoolId ?? null,
      sort_order: sortOrder,
      question,
      why_it_matters: input.whyItMatters?.trim() ?? "",
    })
    .select(
      "id,school_id,sort_order,question,why_it_matters,status,finding_md,finding_sources,researched_at,confirmed_by,confirmed_at,created_at,updated_at"
    )
    .single();
  if (error) fail(error);
  return rowToQuestion(data as Record<string, unknown>);
}

export async function updateQuestion(
  id: string,
  patch: Partial<QuestionWrite> & {
    status?: QuestionStatus;
    findingMd?: string;
    findingSources?: ResearchSource[];
    researchedAt?: string | null;
    confirmedBy?: string;
    confirmedAt?: string | null;
  }
): Promise<ProfessorQuestion> {
  const db = jasonosDb();
  const update: Record<string, unknown> = {};
  if (patch.schoolId !== undefined) update.school_id = patch.schoolId;
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
  if (patch.question !== undefined) update.question = patch.question.trim();
  if (patch.whyItMatters !== undefined)
    update.why_it_matters = patch.whyItMatters.trim();
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.findingMd !== undefined) update.finding_md = patch.findingMd;
  if (patch.findingSources !== undefined)
    update.finding_sources = patch.findingSources;
  if (patch.researchedAt !== undefined) update.researched_at = patch.researchedAt;
  if (patch.confirmedBy !== undefined) update.confirmed_by = patch.confirmedBy;
  if (patch.confirmedAt !== undefined) update.confirmed_at = patch.confirmedAt;

  const { data, error } = await db
    .from("professor_questions")
    .update(update)
    .eq("id", id)
    .select(
      "id,school_id,sort_order,question,why_it_matters,status,finding_md,finding_sources,researched_at,confirmed_by,confirmed_at,created_at,updated_at"
    )
    .single();
  if (error) fail(error);
  return rowToQuestion(data as Record<string, unknown>);
}

export async function removeQuestion(id: string): Promise<void> {
  const db = jasonosDb();
  const { error } = await db.from("professor_questions").delete().eq("id", id);
  if (error) fail(error);
}

export async function setQuestionStatus(
  id: string,
  status: QuestionStatus
): Promise<ProfessorQuestion> {
  return updateQuestion(id, { status });
}

export async function saveQuestionFinding(
  id: string,
  findingMd: string,
  sources: ResearchSource[]
): Promise<ProfessorQuestion> {
  return updateQuestion(id, {
    findingMd,
    findingSources: sources,
    status: "researched",
    researchedAt: new Date().toISOString(),
  });
}

export async function confirmQuestion(
  id: string,
  confirmedBy: string
): Promise<ProfessorQuestion> {
  const by = confirmedBy.trim();
  if (!by) throw new Error("confirmed_by is required.");
  return updateQuestion(id, {
    status: "confirmed",
    confirmedBy: by,
    confirmedAt: new Date().toISOString(),
  });
}

export async function saveSchoolBrief(
  id: string,
  briefMd: string,
  sources: ResearchSource[],
  people: PersonUpsert[],
  postings: PostingUpsert[]
): Promise<ProfessorSchool> {
  const db = jasonosDb();
  const now = new Date().toISOString();

  const { error: schoolError } = await db
    .from("professor_schools")
    .update({
      brief_md: briefMd,
      brief_sources: sources,
      brief_refreshed_at: now,
    })
    .eq("id", id);
  if (schoolError) fail(schoolError);

  for (const person of people) {
    const name = person.name.trim();
    if (!name) continue;
    const { error } = await db.from("professor_school_people").upsert(
      {
        school_id: id,
        name,
        title: person.title?.trim() ?? "",
        role_kind: person.roleKind ?? "faculty",
        profile_url: person.profileUrl?.trim() ?? "",
      },
      { onConflict: "school_id,name" }
    );
    if (error) fail(error);
  }

  for (const posting of postings) {
    const url = posting.url.trim();
    const title = posting.title.trim();
    if (!url || !title) continue;
    const { error } = await db.from("professor_school_postings").upsert(
      {
        school_id: id,
        title,
        url,
        department: posting.department?.trim() ?? "",
        degree_required: posting.degreeRequired?.trim() ?? "",
        seen_at: now,
      },
      { onConflict: "school_id,url" }
    );
    if (error) fail(error);
  }

  const roadmap = await getProfessorRoadmap();
  const school = roadmap.schools.find((s) => s.id === id);
  if (!school) throw new Error("School not found after brief save.");
  return school;
}

export async function setPersonContactId(
  personId: string,
  contactId: string
): Promise<ProfessorSchoolPerson> {
  const db = jasonosDb();
  const { data, error } = await db
    .from("professor_school_people")
    .update({ contact_id: contactId })
    .eq("id", personId)
    .select("id,school_id,name,title,role_kind,profile_url,contact_id,created_at")
    .single();
  if (error) fail(error);
  return rowToPerson(data as Record<string, unknown>);
}

export async function getPersonById(
  personId: string
): Promise<ProfessorSchoolPerson | null> {
  const db = jasonosDb();
  const { data, error } = await db
    .from("professor_school_people")
    .select("id,school_id,name,title,role_kind,profile_url,contact_id,created_at")
    .eq("id", personId)
    .maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  return rowToPerson(data as Record<string, unknown>);
}

export async function addNextStep(
  input: NextStepWrite
): Promise<ProfessorNextStep> {
  const db = jasonosDb();
  const text = input.text.trim();
  if (!text) throw new Error("Next step text is required.");

  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const { data: maxRows, error: maxError } = await db
      .from("professor_next_steps")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);
    if (maxError) fail(maxError);
    sortOrder = asNumber(maxRows?.[0]?.sort_order, 0) + 1;
  }

  const { data, error } = await db
    .from("professor_next_steps")
    .insert({
      school_id: input.schoolId ?? null,
      question_id: input.questionId ?? null,
      decision_id: input.decisionId ?? null,
      sort_order: sortOrder,
      text,
      rationale: input.rationale?.trim() ?? "",
      generated: input.generated ?? false,
    })
    .select(
      "id,school_id,question_id,decision_id,sort_order,text,rationale,status,todo_id,generated,created_at,updated_at,completed_at"
    )
    .single();
  if (error) fail(error);
  return rowToNextStep(data as Record<string, unknown>);
}

export async function setNextStepStatus(
  id: string,
  status: NextStepStatus
): Promise<ProfessorNextStep> {
  const db = jasonosDb();
  const update: Record<string, unknown> = { status };
  if (status === "done" || status === "skipped") {
    update.completed_at = new Date().toISOString();
  } else {
    update.completed_at = null;
  }

  const { data, error } = await db
    .from("professor_next_steps")
    .update(update)
    .eq("id", id)
    .select(
      "id,school_id,question_id,decision_id,sort_order,text,rationale,status,todo_id,generated,created_at,updated_at,completed_at"
    )
    .single();
  if (error) fail(error);
  return rowToNextStep(data as Record<string, unknown>);
}

export async function setNextStepTodoId(
  id: string,
  todoId: string
): Promise<ProfessorNextStep> {
  const db = jasonosDb();
  const { data, error } = await db
    .from("professor_next_steps")
    .update({ todo_id: todoId })
    .eq("id", id)
    .select(
      "id,school_id,question_id,decision_id,sort_order,text,rationale,status,todo_id,generated,created_at,updated_at,completed_at"
    )
    .single();
  if (error) fail(error);
  return rowToNextStep(data as Record<string, unknown>);
}

export async function getNextStepById(
  id: string
): Promise<ProfessorNextStep | null> {
  const db = jasonosDb();
  const { data, error } = await db
    .from("professor_next_steps")
    .select(
      "id,school_id,question_id,decision_id,sort_order,text,rationale,status,todo_id,generated,created_at,updated_at,completed_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  return rowToNextStep(data as Record<string, unknown>);
}

export async function replaceGeneratedNextSteps(
  steps: NextStepWrite[]
): Promise<ProfessorNextStep[]> {
  const db = jasonosDb();
  const { error: deleteError } = await db
    .from("professor_next_steps")
    .delete()
    .eq("generated", true)
    .eq("status", "open");
  if (deleteError) fail(deleteError);

  const inserted: ProfessorNextStep[] = [];
  let order = 1;
  for (const step of steps) {
    const row = await addNextStep({
      ...step,
      sortOrder: step.sortOrder ?? order,
      generated: true,
    });
    inserted.push(row);
    order += 1;
  }
  return inserted;
}

export async function proposeDecision(
  id: string,
  option: string,
  rationaleMd: string
): Promise<ProfessorDecision> {
  const db = jasonosDb();
  const { data, error } = await db
    .from("professor_decisions")
    .update({
      proposed_option: option.trim(),
      proposed_rationale_md: rationaleMd.trim(),
      proposed_at: new Date().toISOString(),
      status: "proposed",
    })
    .eq("id", id)
    .select(
      "id,sort_order,title,why_it_matters,options,depends_on_question_ids,proposed_option,proposed_rationale_md,proposed_at,decided_option,decided_note,decided_at,status,created_at,updated_at"
    )
    .single();
  if (error) fail(error);
  return rowToDecision(data as Record<string, unknown>);
}

export async function decideDecision(
  id: string,
  option: string,
  note: string
): Promise<ProfessorDecision> {
  const db = jasonosDb();
  const { data, error } = await db
    .from("professor_decisions")
    .update({
      decided_option: option.trim(),
      decided_note: note.trim(),
      decided_at: new Date().toISOString(),
      status: "decided",
    })
    .eq("id", id)
    .select(
      "id,sort_order,title,why_it_matters,options,depends_on_question_ids,proposed_option,proposed_rationale_md,proposed_at,decided_option,decided_note,decided_at,status,created_at,updated_at"
    )
    .single();
  if (error) fail(error);
  return rowToDecision(data as Record<string, unknown>);
}

export async function reopenDecision(id: string): Promise<ProfessorDecision> {
  const db = jasonosDb();
  const { data, error } = await db
    .from("professor_decisions")
    .update({
      status: "open",
      decided_option: "",
      decided_note: "",
      decided_at: null,
      proposed_option: "",
      proposed_rationale_md: "",
      proposed_at: null,
    })
    .eq("id", id)
    .select(
      "id,sort_order,title,why_it_matters,options,depends_on_question_ids,proposed_option,proposed_rationale_md,proposed_at,decided_option,decided_note,decided_at,status,created_at,updated_at"
    )
    .single();
  if (error) fail(error);
  return rowToDecision(data as Record<string, unknown>);
}

export async function getQuestionById(
  id: string
): Promise<ProfessorQuestion | null> {
  const db = jasonosDb();
  const { data, error } = await db
    .from("professor_questions")
    .select(
      "id,school_id,sort_order,question,why_it_matters,status,finding_md,finding_sources,researched_at,confirmed_by,confirmed_at,created_at,updated_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  return rowToQuestion(data as Record<string, unknown>);
}

export async function getDecisionById(
  id: string
): Promise<ProfessorDecision | null> {
  const db = jasonosDb();
  const { data, error } = await db
    .from("professor_decisions")
    .select(
      "id,sort_order,title,why_it_matters,options,depends_on_question_ids,proposed_option,proposed_rationale_md,proposed_at,decided_option,decided_note,decided_at,status,created_at,updated_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  return rowToDecision(data as Record<string, unknown>);
}

export async function getSchoolById(
  id: string
): Promise<ProfessorSchool | null> {
  const roadmap = await getProfessorRoadmap();
  return roadmap.schools.find((s) => s.id === id) ?? null;
}
