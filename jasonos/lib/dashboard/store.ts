import { jasonosDb, hasSupabaseConfig } from "@/lib/mcp/db";
import { applySectionUpdate, nyDate, PROJECT_SLUG, readableDocument, zodIssues } from "./edit";
import { DashboardDocument, Section } from "./schema";
import type { DashboardDocument as Dashboard } from "./schema";

const TRACKS = ["venture", "advisors", "job_search", "personal"] as const;

export type ProjectPage = {
  slug: string;
  title: string;
  track: string;
  status: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

function fail(reason: string, extra?: Record<string, unknown>) {
  return { ok: false as const, reason, ...extra };
}

export async function getProjectPage(slug: string): Promise<ProjectPage | null> {
  if (!hasSupabaseConfig()) return null;
  const { data, error } = await jasonosDb()
    .from("project_pages")
    .select("slug, title, track, status, description, created_at, updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProjectPage | null) ?? null;
}

export async function listProjectPages(): Promise<ProjectPage[]> {
  if (!hasSupabaseConfig()) return [];
  const { data, error } = await jasonosDb()
    .from("project_pages")
    .select("slug, title, track, status, description, created_at, updated_at")
    .order("title", { ascending: true });
  if (error) {
    console.error("[project-pages]", error.message);
    return [];
  }
  return (data ?? []) as ProjectPage[];
}

export async function createProject(input: {
  slug: string;
  title: string;
  track: string;
  status?: string;
  description?: string;
}) {
  const slug = input.slug.trim();
  const title = input.title.trim();
  const track = input.track.trim();
  const status = (input.status ?? "active").trim() || "active";
  const description = input.description?.trim() || null;

  if (!PROJECT_SLUG.test(slug) || slug.length > 80) return fail("invalid slug");
  if (!title || title.length > 200) return fail("invalid title");
  if (!(TRACKS as readonly string[]).includes(track)) return fail("invalid track");
  if (status.length > 40) return fail("invalid status");
  if (description && description.length > 500) return fail("invalid description");

  const sb = jasonosDb();
  const { data: existing, error: existingError } = await sb
    .from("project_pages")
    .select("slug, title, track, status, description, created_at, updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return fail("slug exists", { record: existing });

  const { data, error } = await sb
    .from("project_pages")
    .insert({ slug, title, track, status, description })
    .select("slug, title, track, status, description, created_at, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return { ok: true as const, record: data };
}

export async function getProjectDashboard(project_slug: string) {
  const slug = project_slug.trim();
  const { data, error } = await jasonosDb()
    .from("project_dashboards")
    .select("document, updated_on, updated_by, updated_at")
    .eq("project_slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return fail("no dashboard");
  return {
    ok: true as const,
    document: data.document,
    updated_on: data.updated_on,
    updated_by: data.updated_by,
    updated_at: data.updated_at,
  };
}

function updatedOnDate(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

async function saveDashboard(
  project_slug: string,
  document: Dashboard,
  updated_by: string
) {
  const sb = jasonosDb();
  const { data, error } = await sb
    .from("project_dashboards")
    .upsert(
      {
        project_slug,
        document,
        updated_on: updatedOnDate(document.updatedOn),
        updated_by,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_slug" }
    )
    .select("document, updated_on, updated_by, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return {
    ok: true as const,
    document: data.document,
    updated_on: data.updated_on,
    updated_by: data.updated_by,
    updated_at: data.updated_at,
  };
}

export async function setProjectDashboard(input: {
  project_slug: string;
  document: unknown;
  updated_by?: string;
}) {
  const slug = input.project_slug.trim();
  const parsed = DashboardDocument.safeParse(input.document);
  if (!parsed.success) return fail("invalid document", { errors: zodIssues(parsed.error) });

  const project = await getProjectPage(slug);
  if (!project) return fail("no project");

  const updated_by = (input.updated_by ?? "claude").trim() || "claude";
  return saveDashboard(slug, parsed.data, updated_by);
}

export async function updateProjectDashboardSection(input: {
  project_slug: string;
  section: unknown;
  position?: number;
  updated_by?: string;
}) {
  const slug = input.project_slug.trim();
  const section = Section.safeParse(input.section);
  if (!section.success) return fail("invalid section", { errors: zodIssues(section.error) });

  const current = await getProjectDashboard(slug);
  if (!current.ok) return current;
  const document = DashboardDocument.safeParse(current.document);
  if (!document.success) return fail("invalid document", { errors: zodIssues(document.error) });

  const next = applySectionUpdate(document.data, section.data, input.position, nyDate());
  const checked = DashboardDocument.safeParse(next);
  if (!checked.success) return fail("invalid document", { errors: zodIssues(checked.error) });

  const updated_by = (input.updated_by ?? "claude").trim() || "claude";
  return saveDashboard(slug, checked.data, updated_by);
}

/** Page render. Unknown section types are dropped with a warning. */
export async function readProjectDashboard(slug: string): Promise<Dashboard | null> {
  if (!hasSupabaseConfig()) return null;
  const row = await getProjectDashboard(slug);
  if (!row.ok) return null;
  return readableDocument(row.document);
}
