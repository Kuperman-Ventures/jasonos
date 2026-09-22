/** Apps & Materials — parent nav with subsections. */

export type AppsSectionId = "questions" | "materials";

export type AppsSection = {
  id: AppsSectionId;
  label: string;
  /** Short line under the submenu for context. */
  blurb: string;
  /** ready = live content; soon = placeholder until we build it. */
  status: "ready" | "soon";
};

export const APPS_SECTIONS: AppsSection[] = [
  {
    id: "questions",
    label: "App Questions",
    blurb:
      "Common App core fields, essay prompts, and what each school adds on top for the 2026-27 cycle.",
    status: "ready",
  },
  {
    id: "materials",
    label: "Materials",
    blurb: "Transcripts, recs, resumes, and other application packets — coming next.",
    status: "soon",
  },
];

export const DEFAULT_APPS_SECTION: AppsSectionId = "questions";

export function isAppsSectionId(value: string): value is AppsSectionId {
  return APPS_SECTIONS.some((section) => section.id === value);
}

export function appsSectionById(id: AppsSectionId): AppsSection {
  return APPS_SECTIONS.find((section) => section.id === id) ?? APPS_SECTIONS[0];
}

/** Map ?am=… (and legacy bare ?tab=questions) onto a live section. */
export function resolveAppsSection(raw: string | null): AppsSectionId {
  if (raw && isAppsSectionId(raw)) return raw;
  return DEFAULT_APPS_SECTION;
}
