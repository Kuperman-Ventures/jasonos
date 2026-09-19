import { createClient } from "@supabase/supabase-js";
import { seedSchools } from "./content";
import type { Choice, Owner, Plan, School, SchoolSeed, Step } from "./types";
import { fromSeed, isChoice, isOwner, isPlan } from "./types";
import schoolsFile from "@/content/schools.json";

type SchoolRow = {
  id: string;
  name: string;
  location: string;
  campus_size: string;
  mechanical_engineering: string;
  materials: string;
  materials_offering: string;
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
  deadline: string | null;
  deadline_label: string;
  school_steps?: StepRow[] | null;
};

type StepRow = {
  id: string;
  label: string;
  owner: string;
  done: boolean;
  sort_order: number;
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

export function mapSchool(row: SchoolRow): School {
  const steps = (row.school_steps ?? []).map(mapStep).sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    campusSize: row.campus_size,
    mechanicalEngineering: row.mechanical_engineering,
    materials: row.materials,
    materialsOffering: row.materials_offering,
    admissionsContext: row.admissions_context,
    satContext: row.sat_context,
    selectivity: row.selectivity,
    notes: row.notes,
    listOrder: row.list_order,
    choice: isChoice(row.choice) ? row.choice : "unsure",
    plan: isPlan(row.plan) ? row.plan : "",
    visited: row.visited,
    visitDate: row.visit_date,
    visitNotes: row.visit_notes,
    deadline: row.deadline,
    deadlineLabel: row.deadline_label,
    steps,
  };
}

const SCHOOL_COLUMNS =
  "id, name, location, campus_size, mechanical_engineering, materials, materials_offering, admissions_context, sat_context, selectivity, notes, list_order, choice, plan, visited, visit_date, visit_notes, deadline, deadline_label, school_steps(id, label, owner, done, sort_order)";

export async function listSchools(): Promise<School[]> {
  if (!supabaseConfigured()) return seedSchools();
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
    const seed = fromSeed({
      id: slugify(trimmed) || "school",
      name: trimmed,
      location: "",
      campusSize: "",
      mechanicalEngineering: "",
      materials: "",
      materialsOffering: "",
      admissionsContext: "",
      satContext: "",
      selectivity: "",
      notes: "",
      listOrder: 999,
    });
    return seed;
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
    .insert({ id, name: trimmed, list_order: listOrder })
    .select(SCHOOL_COLUMNS)
    .single();
  if (error) throw error;
  return mapSchool(data as SchoolRow);
}

const PATCH_COLUMNS: Record<string, string> = {
  name: "name",
  location: "location",
  campusSize: "campus_size",
  mechanicalEngineering: "mechanical_engineering",
  materials: "materials",
  materialsOffering: "materials_offering",
  admissionsContext: "admissions_context",
  satContext: "sat_context",
  selectivity: "selectivity",
  notes: "notes",
  visitNotes: "visit_notes",
  deadlineLabel: "deadline_label",
};

export function schoolPatchToRow(patch: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [key, column] of Object.entries(PATCH_COLUMNS)) {
    if (typeof patch[key] === "string") row[column] = patch[key];
  }
  if (typeof patch.choice === "string" && isChoice(patch.choice)) row.choice = patch.choice as Choice;
  if (typeof patch.plan === "string" && isPlan(patch.plan)) row.plan = patch.plan as Plan;
  if (typeof patch.visited === "boolean") row.visited = patch.visited;
  if (patch.visitDate === null || typeof patch.visitDate === "string") {
    if ("visitDate" in patch) row.visit_date = patch.visitDate || null;
  }
  if (patch.deadline === null || typeof patch.deadline === "string") {
    if ("deadline" in patch) row.deadline = patch.deadline || null;
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

async function getSchool(id: string): Promise<School> {
  const db = collegeDb();
  const { data, error } = await db.from("schools").select(SCHOOL_COLUMNS).eq("id", id).single();
  if (error) throw error;
  return mapSchool(data as SchoolRow);
}

export function seedById(id: string): School | undefined {
  const seed = (schoolsFile.schools as SchoolSeed[]).find((school) => school.id === id);
  return seed ? fromSeed(seed) : undefined;
}
