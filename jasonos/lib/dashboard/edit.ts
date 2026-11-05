import { DashboardDocument, DashboardHeader, Section, type DashboardDocument as Dashboard, type Section as DashboardSection } from "./schema";

export const PROJECT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function nyDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function zodIssues(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

/** Drop sections this build does not know. The page keeps rendering the rest. */
export function readableDocument(raw: unknown): Dashboard | null {
  const parsed = DashboardDocument.safeParse(raw);
  if (parsed.success) return parsed.data;
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as {
    version?: unknown;
    title?: unknown;
    subtitle?: unknown;
    updatedOn?: unknown;
    header?: unknown;
    sections?: unknown;
  };
  if (doc.version !== 1 || typeof doc.title !== "string" || typeof doc.updatedOn !== "string") {
    return null;
  }
  if (!Array.isArray(doc.sections)) return null;
  const sections: DashboardSection[] = [];
  for (const section of doc.sections) {
    const one = Section.safeParse(section);
    if (one.success) {
      sections.push(one.data);
      continue;
    }
    const id =
      section && typeof section === "object" && "id" in section ? String(section.id) : "?";
    const type =
      section && typeof section === "object" && "type" in section ? String(section.type) : "?";
    console.warn(`[project-dashboard] skipped section ${id} (${type})`);
  }
  if (!sections.length) return null;
  const header = DashboardHeader.safeParse(doc.header);
  return {
    version: 1,
    title: doc.title,
    subtitle: typeof doc.subtitle === "string" ? doc.subtitle : undefined,
    updatedOn: doc.updatedOn,
    header: header.success ? header.data : undefined,
    sections,
  };
}

export function applySectionUpdate(
  document: Dashboard,
  section: DashboardSection,
  position: number | undefined,
  updatedOn: string
): Dashboard {
  const sections = [...document.sections];
  const existing = sections.findIndex((item) => item.id === section.id);
  if (position == null) {
    if (existing >= 0) sections[existing] = section;
    else sections.push(section);
  } else {
    if (existing >= 0) sections.splice(existing, 1);
    const index = Math.max(0, Math.min(Math.trunc(position), sections.length));
    sections.splice(index, 0, section);
  }
  return { ...document, updatedOn, sections };
}
