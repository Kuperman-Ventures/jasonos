/** Project Management section — parent nav with submenus. */

export type ProjectSectionId = "timeline" | "todos" | "calendar";

export type ProjectSection = {
  id: ProjectSectionId;
  label: string;
  /** Short line under the submenu for context. */
  blurb: string;
  /** ready = live content; soon = placeholder until we build it. */
  status: "ready" | "soon";
};

export const PROJECT_SECTIONS: ProjectSection[] = [
  {
    id: "timeline",
    label: "Timeline",
    blurb: "Process ledger and phase checklist for the college runway.",
    status: "ready",
  },
  {
    id: "todos",
    label: "To-dos",
    blurb: "",
    status: "ready",
  },
  {
    id: "calendar",
    label: "Calendar",
    blurb: "Month view of events from Ingest and Notes.",
    status: "ready",
  },
];

export const DEFAULT_PROJECT_SECTION: ProjectSectionId = "timeline";

export function isProjectSectionId(value: string): value is ProjectSectionId {
  return PROJECT_SECTIONS.some((section) => section.id === value);
}

export function projectSectionById(id: ProjectSectionId): ProjectSection {
  return PROJECT_SECTIONS.find((section) => section.id === id) ?? PROJECT_SECTIONS[0];
}

/** Map legacy ?tab=timeline / pm=ingest|board onto a live section. */
export function resolveProjectSection(raw: string | null): ProjectSectionId {
  if (raw && isProjectSectionId(raw)) return raw;
  return DEFAULT_PROJECT_SECTION;
}
