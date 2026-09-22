/** Apps & Materials — parent nav with subsections. */

export type AppsSectionId = "activities" | "questions" | "materials";

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
    id: "activities",
    label: "Activities",
    blurb: "",
    status: "ready",
  },
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

export const DEFAULT_APPS_SECTION: AppsSectionId = "activities";

/** In-page views inside Activities. */
export type ActivitiesViewId = "my" | "awards" | "prep";

export const ACTIVITIES_VIEWS: { id: ActivitiesViewId; label: string }[] = [
  { id: "my", label: "My Activities" },
  { id: "awards", label: "Awards & Milestones" },
  { id: "prep", label: "Application Prep" },
];

export const DEFAULT_ACTIVITIES_VIEW: ActivitiesViewId = "my";

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

export function isActivitiesViewId(value: string): value is ActivitiesViewId {
  return ACTIVITIES_VIEWS.some((view) => view.id === value);
}

export function resolveActivitiesView(raw: string | null): ActivitiesViewId {
  if (raw && isActivitiesViewId(raw)) return raw;
  return DEFAULT_ACTIVITIES_VIEW;
}
