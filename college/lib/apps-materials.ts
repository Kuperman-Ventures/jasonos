/** Apps & Materials — parent nav with subsections. */

export type AppsSectionId = "activities" | "materials";

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
    id: "materials",
    label: "Materials",
    blurb: "Transcripts, recs, resumes, and other application packets — coming next.",
    status: "soon",
  },
];

export const DEFAULT_APPS_SECTION: AppsSectionId = "activities";

/** In-page views inside Activities. */
export type ActivitiesViewId = "gather" | "shape" | "plan" | "prep";

export const ACTIVITIES_VIEWS: { id: ActivitiesViewId; label: string }[] = [
  { id: "gather", label: "1 Gather" },
  { id: "shape", label: "2 Shape" },
  { id: "plan", label: "3 Plan" },
  { id: "prep", label: "4 Application Prep" },
];

export const DEFAULT_ACTIVITIES_VIEW: ActivitiesViewId = "plan";

const LEGACY_ACTIVITIES_VIEW: Record<string, ActivitiesViewId> = {
  my: "shape",
  write: "prep",
  entry: "prep",
};

export function isAppsSectionId(value: string): value is AppsSectionId {
  return APPS_SECTIONS.some((section) => section.id === value);
}

export function appsSectionById(id: AppsSectionId): AppsSection {
  return APPS_SECTIONS.find((section) => section.id === id) ?? APPS_SECTIONS[0];
}

/** Map ?am=… onto a live section. Legacy am=questions is handled in Portal as the Guide tab. */
export function resolveAppsSection(raw: string | null): AppsSectionId {
  if (raw && isAppsSectionId(raw)) return raw;
  return DEFAULT_APPS_SECTION;
}

export function isActivitiesViewId(value: string): value is ActivitiesViewId {
  return ACTIVITIES_VIEWS.some((view) => view.id === value);
}

export function resolveActivitiesView(raw: string | null): ActivitiesViewId {
  if (raw && isActivitiesViewId(raw)) return raw;
  if (raw && raw in LEGACY_ACTIVITIES_VIEW) return LEGACY_ACTIVITIES_VIEW[raw]!;
  return DEFAULT_ACTIVITIES_VIEW;
}

/** Opening an activity goes to Application Prep. Clearing it must not change the current stage. */
export function viewForOpenedActivity(
  current: ActivitiesViewId,
  activityId: string | null,
): ActivitiesViewId {
  return activityId ? "prep" : current;
}
