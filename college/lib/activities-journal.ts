/** Student Activities journal — persisted as one JSON blob on app_state. */

import { isActivityIconId, pickActivityIcon } from "./activity-icons";

export type ActivityCategoryId =
  | "school-club"
  | "athletics"
  | "arts-music-theater"
  | "volunteering-community-service"
  | "paid-work"
  | "internship"
  | "research"
  | "independent-project-business"
  | "academic-enrichment"
  | "other-coursework-training"
  | "family-household-responsibilities"
  | "faith-community-group"
  | "hobby-personal-pursuit"
  | "other";

export type ActivityCategory = {
  id: ActivityCategoryId;
  label: string;
};

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  { id: "school-club", label: "School club" },
  { id: "athletics", label: "Athletics" },
  { id: "arts-music-theater", label: "Arts/music/theater" },
  { id: "volunteering-community-service", label: "Volunteering/community service" },
  { id: "paid-work", label: "Paid work" },
  { id: "internship", label: "Internship" },
  { id: "research", label: "Research" },
  { id: "independent-project-business", label: "Independent project/business" },
  { id: "academic-enrichment", label: "Academic enrichment" },
  { id: "other-coursework-training", label: "Other coursework/training" },
  { id: "family-household-responsibilities", label: "Family/household responsibilities" },
  { id: "faith-community-group", label: "Faith/community group" },
  { id: "hobby-personal-pursuit", label: "Hobby/personal pursuit" },
  { id: "other", label: "Other" },
];

const CATEGORY_IDS = new Set<string>(ACTIVITY_CATEGORIES.map((c) => c.id));

export type CategoryExtras = {
  paidUnpaid?: string;
  employer?: string;
  jobTitle?: string;
  promotions?: string;
  earningsUse?: string;
  familyTasks?: string;
  regularity?: string;
  familyContext?: string;
  researchGoal?: string;
  teamOrIndependent?: string;
  collaborators?: string;
  mentor?: string;
  personalContribution?: string;
  deliverables?: string;
  portfolioLinks?: string;
  orgMission?: string;
  communityServed?: string;
  serviceTasks?: string;
  serviceOutcomes?: string;
  serviceHoursEvidence?: string;
  provider?: string;
  programTitle?: string;
  topics?: string;
  selectionProcess?: string;
  certificateOrProject?: string;
  [key: string]: string | boolean | undefined;
};

export type ActivityReflections = {
  whyMatters?: string;
  skills?: string;
  growth?: string;
  memorable?: string;
};

export type ActivityLink = {
  id: string;
  label: string;
  url: string;
  note?: string;
  dated?: string;
};

export type GradeLevel = "6" | "7" | "8" | "9" | "10" | "11" | "12" | "post" | "other";

export type PeriodKind = "school_year" | "summer" | "all_year" | "custom";

export type HoursBasis = "estimate" | "schedule" | "calendar" | "timesheet" | "other";

export type PeriodStatus = "completed" | "in_progress" | "planned";

export type ParticipationPeriod = {
  id: string;
  schoolYear: string;
  grade: GradeLevel;
  periodKind: PeriodKind;
  startDate?: string;
  endDate?: string;
  role?: string;
  responsibilities?: string;
  hoursPerWeek?: number;
  weeksActive?: number;
  hoursBasis?: HoursBasis;
  scheduleNotes?: string;
  status: PeriodStatus;
  achievements?: string;
  createdAt: string;
  updatedAt: string;
};

export type MetricAttribution = "individual" | "team";

export type ActivityMetric = {
  id: string;
  name: string;
  value: string;
  unit?: string;
  timeframe?: string;
  attribution?: MetricAttribution;
};

export type ActivityUpdate = {
  id: string;
  activityId: string;
  date: string;
  whatHappened: string;
  outcomes?: string;
  recognition?: string;
  learned?: string;
  roleChange?: string;
  scheduleChange?: string;
  metrics?: ActivityMetric[];
  linkUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type Activity = {
  id: string;
  name: string;
  category: ActivityCategoryId;
  organization?: string;
  orgPurpose?: string;
  locationFormat?: string;
  startMonth?: number;
  startYear?: number;
  endMonth?: number;
  endYear?: number;
  ongoing: boolean;
  role?: string;
  responsibilities?: string;
  stillParticipating?: boolean;
  categoryExtras?: CategoryExtras;
  reflections?: ActivityReflections;
  mentorName?: string;
  mentorRole?: string;
  mentorEmail?: string;
  links?: ActivityLink[];
  periods: ParticipationPeriod[];
  updates: ActivityUpdate[];
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  recallSource?: boolean;
  /** Phosphor icon id from the activity-icons allowlist. */
  icon?: string;
  /** Thread this activity belongs to, if any. */
  threadId?: string;
  /** Self-started project answers (category independent-project-business). */
  project?: SelfStartedProject;
};

export type PartnerStatus =
  | "not_contacted"
  | "contacted"
  | "meeting_held"
  | "approved"
  | "declined";

export type ProjectPartner = {
  id: string;
  organization: string;
  contactName?: string;
  contactRole?: string;
  status: PartnerStatus;
  notes?: string;
};

export type ProjectMilestone = {
  id: string;
  label: string;
  targetMonth?: string;
  done: boolean;
  doneDate?: string;
};

export type SelfStartedProject = {
  need?: string;
  beneficiaries?: string;
  buildsOnActivityIds?: string[];
  partners: ProjectPartner[];
  deliverable?: string;
  milestones: ProjectMilestone[];
  evidencePlan?: string;
  afterGraduation?: string;
};

export const PARTNER_STATUSES: PartnerStatus[] = [
  "not_contacted",
  "contacted",
  "meeting_held",
  "approved",
  "declined",
];

export const PARTNER_STATUS_LABEL: Record<PartnerStatus, string> = {
  not_contacted: "Not contacted",
  contacted: "Contacted",
  meeting_held: "Meeting held",
  approved: "Approved",
  declined: "Declined",
};

export const DEFAULT_PROJECT_MILESTONE_LABELS = [
  "Research",
  "Design",
  "Get approval",
  "Build or create",
  "Launch or install",
  "Follow up",
] as const;

export type ThreadPlan = {
  deeper?: string;
  lead?: string;
  outsideSchool?: string;
  makeSomething?: string;
  connect?: string;
};

export type ThreadPlanKey = keyof ThreadPlan;

export const THREAD_PLAN_QUESTIONS: {
  key: ThreadPlanKey;
  label: string;
  question: string;
  helper: string;
}[] = [
  {
    key: "deeper",
    label: "Deeper",
    question: "What skill level could you reach by the end of senior year?",
    helper:
      "Move up a chair or section, earn the next rank or level, make a higher team, pass the next certification.",
  },
  {
    key: "lead",
    label: "Lead",
    question: "What role could you take on, or who could you teach?",
    helper:
      "Section leader, captain, officer, mentoring newer members, running a practice or workshop.",
  },
  {
    key: "outsideSchool",
    label: "Outside school",
    question: "Where else does this happen beyond your school?",
    helper:
      "Regional or state competitions, community groups, summer programs, college or industry events.",
  },
  {
    key: "makeSomething",
    label: "Make something",
    question: "What could you build, record or show?",
    helper:
      "A recording, a design you can share, a written guide, a portfolio, a performance you organize.",
  },
  {
    key: "connect",
    label: "Connect",
    question: "Does this thread overlap with another one?",
    helper: "A skill from one thread used to solve a problem in another.",
  },
];

export type ActivityThread = {
  id: string;
  name: string;
  plan?: ThreadPlan; // used by Plan in step 2
  createdAt: string;
  updatedAt: string;
};

export type Award = {
  id: string;
  title: string;
  organization?: string;
  date?: string;
  grade?: GradeLevel;
  activityId?: string | null;
  academic?: boolean | null;
  recognitionLevel?: string;
  eligibility?: string;
  selectivity?: string;
  whatDid?: string;
  teamOrIndividual?: string;
  linkUrl?: string;
  recurringNote?: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
};

export type DraftReviewStatus = "draft" | "reviewed" | "stale";

export type ApplicationDraft = {
  id: string;
  activityId: string;
  sortOrder: number;
  draftRole?: string;
  draftOrg?: string;
  shortDescription?: string;
  longDescription?: string;
  gradesReviewed?: string;
  timeCommitmentReviewed?: string;
  continueInCollege?: string;
  /** Yes / No for the Common App college question. Replaces free-text continueInCollege in the UI. */
  continueInCollegeChoice?: boolean | null;
  reviewStatus?: DraftReviewStatus;
  reviewedAt?: string;
  sourceUpdatedAtSnapshot?: string;
};

export type HonorLevel = "school" | "state_regional" | "national" | "international";

export type HonorDraft = {
  id: string;
  awardId: string;
  sortOrder: number;
  title: string;
  grades: number[];
  level: HonorLevel | null;
  reviewStatus?: "draft" | "reviewed";
};

export const HONOR_LIMITS = { count: 5, title: 100 } as const;

export const HONOR_LEVEL_LABEL: Record<HonorLevel, string> = {
  school: "School",
  state_regional: "State or regional",
  national: "National",
  international: "International",
};

export type ApplicationList = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  entries: ApplicationDraft[];
  honors?: HonorDraft[];
};

export const COMMON_APP_LIST_ID = "common-app";

export const APP_DRAFT_LIMITS = {
  role: 50,
  org: 100,
  short: 150,
  long: 350,
} as const;

export type JournalProfile = {
  classOf?: number; // high school graduation year, e.g. 2028
};

/** This portal's student enrolls Fall 2028. Used when profile.classOf was never saved. */
export const DEFAULT_CLASS_OF = 2028;

export type ActivitiesJournal = {
  activities: Activity[];
  awards: Award[];
  applicationLists: ApplicationList[];
  threads?: ActivityThread[];
  profile?: JournalProfile;
  /** Four-stage Activities track (Gather / Shape / Plan / Prep). Opaque blob; normalized in activities-track. */
  track?: unknown;
};

export type ActivityStatusFilter = "all" | "ongoing" | "completed";

export type ActivityFilter = {
  query?: string;
  category?: ActivityCategoryId | string;
  grade?: GradeLevel | string;
  status?: ActivityStatusFilter;
};

const GRADE_LEVELS = new Set<string>(["6", "7", "8", "9", "10", "11", "12", "post", "other"]);
const PERIOD_KINDS = new Set<string>(["school_year", "summer", "all_year", "custom"]);
const HOURS_BASES = new Set<string>(["estimate", "schedule", "calendar", "timesheet", "other"]);
const PERIOD_STATUSES = new Set<string>(["completed", "in_progress", "planned"]);
const DRAFT_STATUSES = new Set<string>(["draft", "reviewed", "stale"]);
const METRIC_ATTRS = new Set<string>(["individual", "team"]);
const PARTNER_STATUS_IDS = new Set<string>(PARTNER_STATUSES);

function nowIso(): string {
  return new Date().toISOString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value;
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asOptionalBool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function asOptionalNullBool(value: unknown): boolean | null | undefined {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  return undefined;
}

export function newId(prefix: string): string {
  const safe = prefix.trim() || "id";
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${safe}_${rand}`;
}

export function emptyJournal(): ActivitiesJournal {
  return { activities: [], awards: [], applicationLists: [] };
}

export function formatSchoolYear(startYear: number): string {
  const year = Math.trunc(startYear);
  const next = String((year + 1) % 100).padStart(2, "0");
  return `${year}–${next}`;
}

export function isHighSchoolGrade(grade: GradeLevel | string): boolean {
  return grade === "9" || grade === "10" || grade === "11" || grade === "12";
}

/** School year that ends in June. Aug-Dec count toward the next calendar year. */
export function currentSchoolYearEnd(now: Date = new Date()): number {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 8 ? year + 1 : year;
}

/** 6-12 for a student in school, null if classOf is missing or the grade is outside 6-12. */
export function currentGrade(classOf: number | undefined, now: Date = new Date()): number | null {
  if (classOf == null || !Number.isFinite(classOf)) return null;
  const g = 12 - (Math.trunc(classOf) - currentSchoolYearEnd(now));
  if (g < 6 || g > 12) return null;
  return g;
}

/** Graduation years a student still in grades 9-12 could pick. */
export function graduationYearOptions(now: Date = new Date()): number[] {
  const start = currentSchoolYearEnd(now);
  return [start, start + 1, start + 2, start + 3];
}

/** "junior" for 11, empty when grade is unknown. */
export function classStanding(grade: number | null): string {
  if (grade === 9) return "freshman";
  if (grade === 10) return "sophomore";
  if (grade === 11) return "junior";
  if (grade === 12) return "senior";
  if (grade != null) return `${grade}th grader`;
  return "";
}

export function setClassOf(journal: ActivitiesJournal, classOf: number): ActivitiesJournal {
  return { ...journal, profile: { ...journal.profile, classOf: Math.trunc(classOf) } };
}

/** Saved graduation year, or this portal's default when that was never set. */
export function resolveClassOf(classOf: number | undefined, now: Date = new Date()): number {
  if (currentGrade(classOf, now) != null) return Math.trunc(classOf!);
  return DEFAULT_CLASS_OF;
}

/** "2021–22" for grade 6 when classOf is 2028. Uses the existing formatSchoolYear(). */
export function schoolYearForGrade(classOf: number, grade: number): string {
  const endYear = Math.trunc(classOf) - (12 - grade);
  return formatSchoolYear(endYear - 1);
}

export function recallSpanText(
  since: number,
  until: number | null,
  stillDoing: boolean,
  currentGrade: number,
): string {
  const end = stillDoing ? currentGrade : (until ?? currentGrade);
  const n = Math.max(1, end - since + 1);
  const yrs = n === 1 ? "1 school year" : `${n} school years`;
  if (stillDoing) return `Since ${since}th grade · still doing it · ${yrs}`;
  return `${since}th to ${end}th grade · ${yrs}`;
}

function normalizeProfile(raw: unknown): JournalProfile | undefined {
  const row = asRecord(raw);
  if (!row) return undefined;
  const n = asOptionalNumber(row.classOf);
  if (n === undefined) return undefined;
  const classOf = Math.trunc(n);
  if (classOf < 2020 || classOf > 2040) return undefined;
  return { classOf };
}

export function charCount(text: string | null | undefined): number {
  if (!text) return 0;
  return [...text].length;
}

function isCategoryId(value: unknown): value is ActivityCategoryId {
  return typeof value === "string" && CATEGORY_IDS.has(value);
}

function normalizeCategoryExtras(raw: unknown): CategoryExtras | undefined {
  const row = asRecord(raw);
  if (!row) return undefined;
  const out: CategoryExtras = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "string") out[key] = value;
    else if (typeof value === "boolean") out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeReflections(raw: unknown): ActivityReflections | undefined {
  const row = asRecord(raw);
  if (!row) return undefined;
  const out: ActivityReflections = {};
  const whyMatters = asString(row.whyMatters);
  const skills = asString(row.skills);
  const growth = asString(row.growth);
  const memorable = asString(row.memorable);
  if (whyMatters !== undefined) out.whyMatters = whyMatters;
  if (skills !== undefined) out.skills = skills;
  if (growth !== undefined) out.growth = growth;
  if (memorable !== undefined) out.memorable = memorable;
  return Object.keys(out).length ? out : undefined;
}

function normalizePartnerStatus(value: unknown): PartnerStatus {
  if (typeof value === "string" && PARTNER_STATUS_IDS.has(value)) {
    return value as PartnerStatus;
  }
  return "not_contacted";
}

function normalizeProjectPartner(raw: unknown): ProjectPartner | null {
  const row = asRecord(raw);
  if (!row) return null;
  const organization = asOptionalString(row.organization);
  if (!organization) return null;
  const partner: ProjectPartner = {
    id: asOptionalString(row.id) ?? newId("partner"),
    organization,
    status: normalizePartnerStatus(row.status),
  };
  const contactName = asOptionalString(row.contactName);
  const contactRole = asOptionalString(row.contactRole);
  const notes = asString(row.notes);
  if (contactName) partner.contactName = contactName;
  if (contactRole) partner.contactRole = contactRole;
  if (notes !== undefined) partner.notes = notes;
  return partner;
}

function normalizeProjectMilestone(raw: unknown): ProjectMilestone | null {
  const row = asRecord(raw);
  if (!row) return null;
  const label = asOptionalString(row.label);
  if (!label) return null;
  const milestone: ProjectMilestone = {
    id: asOptionalString(row.id) ?? newId("milestone"),
    label,
    done: asBool(row.done, false),
  };
  const targetMonth = asOptionalString(row.targetMonth);
  const doneDate = asOptionalString(row.doneDate);
  if (targetMonth && /^\d{4}-\d{2}$/.test(targetMonth)) milestone.targetMonth = targetMonth;
  if (doneDate) milestone.doneDate = doneDate;
  return milestone;
}

export function normalizeSelfStartedProject(raw: unknown): SelfStartedProject | undefined {
  const row = asRecord(raw);
  if (!row) return undefined;
  const project: SelfStartedProject = {
    partners: Array.isArray(row.partners)
      ? row.partners
          .map(normalizeProjectPartner)
          .filter((p): p is ProjectPartner => Boolean(p))
      : [],
    milestones: Array.isArray(row.milestones)
      ? row.milestones
          .map(normalizeProjectMilestone)
          .filter((m): m is ProjectMilestone => Boolean(m))
      : [],
  };
  const need = asString(row.need);
  const beneficiaries = asString(row.beneficiaries);
  const deliverable = asString(row.deliverable);
  const evidencePlan = asString(row.evidencePlan);
  const afterGraduation = asString(row.afterGraduation);
  if (need !== undefined) project.need = need;
  if (beneficiaries !== undefined) project.beneficiaries = beneficiaries;
  if (deliverable !== undefined) project.deliverable = deliverable;
  if (evidencePlan !== undefined) project.evidencePlan = evidencePlan;
  if (afterGraduation !== undefined) project.afterGraduation = afterGraduation;
  if (Array.isArray(row.buildsOnActivityIds)) {
    const ids = row.buildsOnActivityIds
      .map((id) => asOptionalString(id))
      .filter((id): id is string => Boolean(id));
    if (ids.length) project.buildsOnActivityIds = [...new Set(ids)];
  }
  return project;
}

export function emptySelfStartedProject(): SelfStartedProject {
  return { partners: [], milestones: [] };
}

export function defaultProjectMilestones(): ProjectMilestone[] {
  return DEFAULT_PROJECT_MILESTONE_LABELS.map((label) => ({
    id: newId("milestone"),
    label,
    done: false,
  }));
}

export function isSelfStartedProject(activity: Activity): boolean {
  return activity.category === "independent-project-business";
}

/** Unfinished milestones whose target month is before the current calendar month. */
export function overdueMilestones(
  project: SelfStartedProject,
  now: Date = new Date(),
): ProjectMilestone[] {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const current = `${year}-${String(month).padStart(2, "0")}`;
  return project.milestones.filter(
    (m) => !m.done && m.targetMonth != null && m.targetMonth < current,
  );
}

export type PlannedStep = {
  activityId: string;
  activityName: string;
  periodId: string;
  grade: GradeLevel;
  text: string;
};

/** Planned periods on activities in a thread, newest-first by grade then name. */
export function plannedStepsForThread(
  journal: ActivitiesJournal,
  threadId: string,
): PlannedStep[] {
  const steps: PlannedStep[] = [];
  for (const activity of journal.activities) {
    if (activity.archived || activity.threadId !== threadId) continue;
    for (const period of activity.periods) {
      if (period.status !== "planned") continue;
      steps.push({
        activityId: activity.id,
        activityName: activity.name,
        periodId: period.id,
        grade: period.grade,
        text: (period.responsibilities ?? "").trim(),
      });
    }
  }
  return steps.sort((a, b) => {
    const ag = a.grade === "post" || a.grade === "other" ? 99 : Number(a.grade);
    const bg = b.grade === "post" || b.grade === "other" ? 99 : Number(b.grade);
    if (ag !== bg) return ag - bg;
    return a.activityName.localeCompare(b.activityName);
  });
}

export function setThreadPlan(
  journal: ActivitiesJournal,
  threadId: string,
  plan: ThreadPlan,
): ActivitiesJournal {
  const stamp = nowIso();
  return {
    ...journal,
    threads: (journal.threads ?? []).map((t) =>
      t.id === threadId ? { ...t, plan: { ...plan }, updatedAt: stamp } : t,
    ),
  };
}

export function answeredPlanCount(plan: ThreadPlan | undefined): number {
  if (!plan) return 0;
  return THREAD_PLAN_QUESTIONS.filter((q) => (plan[q.key] ?? "").trim().length > 0).length;
}

/** True when Plan should open the grouping step: no threads, or none with 2+ activities. */
export function needsGrouping(journal: ActivitiesJournal): boolean {
  const threads = journal.threads ?? [];
  if (threads.length === 0) return true;
  return !threads.some(
    (thread) =>
      journal.activities.filter((a) => !a.archived && a.threadId === thread.id).length >= 2,
  );
}

/** Non-archived, non-project activities available to put in threads. */
export function groupableActivities(journal: ActivitiesJournal): Activity[] {
  return sortRecordActivities(
    journal.activities.filter((a) => !a.archived && !isSelfStartedProject(a)),
  );
}

function normalizeLink(raw: unknown): ActivityLink | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asOptionalString(row.id) ?? newId("link");
  const label = asOptionalString(row.label) ?? "Link";
  const url = asOptionalString(row.url);
  if (!url) return null;
  const link: ActivityLink = { id, label, url };
  const note = asString(row.note);
  const dated = asOptionalString(row.dated);
  if (note !== undefined) link.note = note;
  if (dated) link.dated = dated;
  return link;
}

function normalizeMetric(raw: unknown): ActivityMetric | null {
  const row = asRecord(raw);
  if (!row) return null;
  const name = asOptionalString(row.name);
  const value = asOptionalString(row.value) ?? (typeof row.value === "number" ? String(row.value) : "");
  if (!name || value === "") return null;
  const metric: ActivityMetric = {
    id: asOptionalString(row.id) ?? newId("metric"),
    name,
    value,
  };
  const unit = asOptionalString(row.unit);
  const timeframe = asOptionalString(row.timeframe);
  if (unit) metric.unit = unit;
  if (timeframe) metric.timeframe = timeframe;
  if (typeof row.attribution === "string" && METRIC_ATTRS.has(row.attribution)) {
    metric.attribution = row.attribution as MetricAttribution;
  }
  return metric;
}

function normalizePeriod(raw: unknown): ParticipationPeriod | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asOptionalString(row.id) ?? newId("period");
  const schoolYear = asOptionalString(row.schoolYear) ?? "";
  const grade =
    typeof row.grade === "string" && GRADE_LEVELS.has(row.grade)
      ? (row.grade as GradeLevel)
      : "other";
  const periodKind =
    typeof row.periodKind === "string" && PERIOD_KINDS.has(row.periodKind)
      ? (row.periodKind as PeriodKind)
      : "school_year";
  const status =
    typeof row.status === "string" && PERIOD_STATUSES.has(row.status)
      ? (row.status as PeriodStatus)
      : "completed";
  const stamp = nowIso();
  const period: ParticipationPeriod = {
    id,
    schoolYear,
    grade,
    periodKind,
    status,
    createdAt: asOptionalString(row.createdAt) ?? stamp,
    updatedAt: asOptionalString(row.updatedAt) ?? stamp,
  };
  const startDate = asOptionalString(row.startDate);
  const endDate = asOptionalString(row.endDate);
  const role = asString(row.role);
  const responsibilities = asString(row.responsibilities);
  const hoursPerWeek = asOptionalNumber(row.hoursPerWeek);
  const weeksActive = asOptionalNumber(row.weeksActive);
  const scheduleNotes = asString(row.scheduleNotes);
  const achievements = asString(row.achievements);
  if (startDate) period.startDate = startDate;
  if (endDate) period.endDate = endDate;
  if (role !== undefined) period.role = role;
  if (responsibilities !== undefined) period.responsibilities = responsibilities;
  if (hoursPerWeek !== undefined) period.hoursPerWeek = hoursPerWeek;
  if (weeksActive !== undefined) period.weeksActive = weeksActive;
  if (typeof row.hoursBasis === "string" && HOURS_BASES.has(row.hoursBasis)) {
    period.hoursBasis = row.hoursBasis as HoursBasis;
  }
  if (scheduleNotes !== undefined) period.scheduleNotes = scheduleNotes;
  if (achievements !== undefined) period.achievements = achievements;
  return period;
}

function normalizeUpdate(raw: unknown, fallbackActivityId?: string): ActivityUpdate | null {
  const row = asRecord(raw);
  if (!row) return null;
  const whatHappened = asOptionalString(row.whatHappened);
  if (!whatHappened) return null;
  const activityId = asOptionalString(row.activityId) ?? fallbackActivityId;
  if (!activityId) return null;
  const stamp = nowIso();
  const update: ActivityUpdate = {
    id: asOptionalString(row.id) ?? newId("update"),
    activityId,
    date: asOptionalString(row.date) ?? stamp.slice(0, 10),
    whatHappened,
    createdAt: asOptionalString(row.createdAt) ?? stamp,
    updatedAt: asOptionalString(row.updatedAt) ?? stamp,
  };
  const outcomes = asString(row.outcomes);
  const recognition = asString(row.recognition);
  const learned = asString(row.learned);
  const roleChange = asString(row.roleChange);
  const scheduleChange = asString(row.scheduleChange);
  const linkUrl = asOptionalString(row.linkUrl);
  if (outcomes !== undefined) update.outcomes = outcomes;
  if (recognition !== undefined) update.recognition = recognition;
  if (learned !== undefined) update.learned = learned;
  if (roleChange !== undefined) update.roleChange = roleChange;
  if (scheduleChange !== undefined) update.scheduleChange = scheduleChange;
  if (linkUrl) update.linkUrl = linkUrl;
  if (Array.isArray(row.metrics)) {
    const metrics = row.metrics.map(normalizeMetric).filter((m): m is ActivityMetric => Boolean(m));
    if (metrics.length) update.metrics = metrics;
  }
  return update;
}

function normalizeActivity(raw: unknown): Activity | null {
  const row = asRecord(raw);
  if (!row) return null;
  const name = asOptionalString(row.name);
  if (!name) return null;
  const category: ActivityCategoryId = isCategoryId(row.category) ? row.category : "other";
  const stamp = nowIso();
  const id = asOptionalString(row.id) ?? newId("activity");
  const periods = Array.isArray(row.periods)
    ? row.periods.map(normalizePeriod).filter((p): p is ParticipationPeriod => Boolean(p))
    : [];
  const updates = Array.isArray(row.updates)
    ? row.updates
        .map((u) => normalizeUpdate(u, id))
        .filter((u): u is ActivityUpdate => Boolean(u))
    : [];
  const activity: Activity = {
    id,
    name,
    category,
    ongoing: asBool(row.ongoing, false),
    periods,
    updates,
    createdAt: asOptionalString(row.createdAt) ?? stamp,
    updatedAt: asOptionalString(row.updatedAt) ?? stamp,
  };
  const organization = asString(row.organization);
  const orgPurpose = asString(row.orgPurpose);
  const locationFormat = asString(row.locationFormat);
  const role = asString(row.role);
  const responsibilities = asString(row.responsibilities);
  const mentorName = asOptionalString(row.mentorName);
  const mentorRole = asOptionalString(row.mentorRole);
  const mentorEmail = asOptionalString(row.mentorEmail);
  const createdBy = asOptionalString(row.createdBy);
  const startMonth = asOptionalNumber(row.startMonth);
  const startYear = asOptionalNumber(row.startYear);
  const endMonth = asOptionalNumber(row.endMonth);
  const endYear = asOptionalNumber(row.endYear);
  const stillParticipating = asOptionalBool(row.stillParticipating);
  const archived = asOptionalBool(row.archived);
  const recallSource = asOptionalBool(row.recallSource);
  const icon = asOptionalString(row.icon);
  const categoryExtras = normalizeCategoryExtras(row.categoryExtras);
  const reflections = normalizeReflections(row.reflections);
  if (organization !== undefined) activity.organization = organization;
  if (orgPurpose !== undefined) activity.orgPurpose = orgPurpose;
  if (locationFormat !== undefined) activity.locationFormat = locationFormat;
  if (role !== undefined) activity.role = role;
  if (responsibilities !== undefined) activity.responsibilities = responsibilities;
  if (mentorName) activity.mentorName = mentorName;
  if (mentorRole) activity.mentorRole = mentorRole;
  if (mentorEmail) activity.mentorEmail = mentorEmail;
  if (createdBy) activity.createdBy = createdBy;
  if (startMonth !== undefined) activity.startMonth = startMonth;
  if (startYear !== undefined) activity.startYear = startYear;
  if (endMonth !== undefined) activity.endMonth = endMonth;
  if (endYear !== undefined) activity.endYear = endYear;
  if (stillParticipating !== undefined) activity.stillParticipating = stillParticipating;
  if (archived !== undefined) activity.archived = archived;
  if (recallSource !== undefined) activity.recallSource = recallSource;
  if (icon && isActivityIconId(icon)) activity.icon = icon;
  const threadId = asOptionalString(row.threadId);
  if (threadId) activity.threadId = threadId;
  if (categoryExtras) activity.categoryExtras = categoryExtras;
  if (reflections) activity.reflections = reflections;
  if (Array.isArray(row.links)) {
    const links = row.links.map(normalizeLink).filter((l): l is ActivityLink => Boolean(l));
    if (links.length) activity.links = links;
  }
  const project = normalizeSelfStartedProject(row.project);
  if (project) activity.project = project;
  return activity;
}

function normalizeAward(raw: unknown): Award | null {
  const row = asRecord(raw);
  if (!row) return null;
  const title = asOptionalString(row.title);
  if (!title) return null;
  const stamp = nowIso();
  const award: Award = {
    id: asOptionalString(row.id) ?? newId("award"),
    title,
    createdAt: asOptionalString(row.createdAt) ?? stamp,
    updatedAt: asOptionalString(row.updatedAt) ?? stamp,
  };
  const organization = asString(row.organization);
  const date = asOptionalString(row.date);
  const recognitionLevel = asOptionalString(row.recognitionLevel);
  const eligibility = asString(row.eligibility);
  const selectivity = asString(row.selectivity);
  const whatDid = asString(row.whatDid);
  const teamOrIndividual = asOptionalString(row.teamOrIndividual);
  const linkUrl = asOptionalString(row.linkUrl);
  const recurringNote = asString(row.recurringNote);
  const archived = asOptionalBool(row.archived);
  const academic = asOptionalNullBool(row.academic);
  if (organization !== undefined) award.organization = organization;
  if (date) award.date = date;
  if (typeof row.grade === "string" && GRADE_LEVELS.has(row.grade)) {
    award.grade = row.grade as GradeLevel;
  }
  if ("activityId" in row) {
    if (row.activityId === null || row.activityId === "") award.activityId = null;
    else if (typeof row.activityId === "string") award.activityId = row.activityId;
  }
  if (academic !== undefined) award.academic = academic;
  if (recognitionLevel) award.recognitionLevel = recognitionLevel;
  if (eligibility !== undefined) award.eligibility = eligibility;
  if (selectivity !== undefined) award.selectivity = selectivity;
  if (whatDid !== undefined) award.whatDid = whatDid;
  if (teamOrIndividual) award.teamOrIndividual = teamOrIndividual;
  if (linkUrl) award.linkUrl = linkUrl;
  if (recurringNote !== undefined) award.recurringNote = recurringNote;
  if (archived !== undefined) award.archived = archived;
  return award;
}

function normalizeDraft(raw: unknown): ApplicationDraft | null {
  const row = asRecord(raw);
  if (!row) return null;
  const activityId = asOptionalString(row.activityId);
  if (!activityId) return null;
  const draft: ApplicationDraft = {
    id: asOptionalString(row.id) ?? newId("draft"),
    activityId,
    sortOrder: asOptionalNumber(row.sortOrder) ?? 0,
  };
  const draftRole = asString(row.draftRole);
  const draftOrg = asString(row.draftOrg);
  const shortDescription = asString(row.shortDescription);
  const longDescription = asString(row.longDescription);
  const gradesReviewed = asString(row.gradesReviewed);
  const timeCommitmentReviewed = asString(row.timeCommitmentReviewed);
  const continueInCollege = asString(row.continueInCollege);
  const reviewedAt = asOptionalString(row.reviewedAt);
  const sourceUpdatedAtSnapshot = asOptionalString(row.sourceUpdatedAtSnapshot);
  if (draftRole !== undefined) draft.draftRole = draftRole;
  if (draftOrg !== undefined) draft.draftOrg = draftOrg;
  if (shortDescription !== undefined) draft.shortDescription = shortDescription;
  if (longDescription !== undefined) draft.longDescription = longDescription;
  if (gradesReviewed !== undefined) draft.gradesReviewed = gradesReviewed;
  if (timeCommitmentReviewed !== undefined) draft.timeCommitmentReviewed = timeCommitmentReviewed;
  if (continueInCollege !== undefined) draft.continueInCollege = continueInCollege;
  if ("continueInCollegeChoice" in row) {
    if (row.continueInCollegeChoice === null) draft.continueInCollegeChoice = null;
    else if (typeof row.continueInCollegeChoice === "boolean") {
      draft.continueInCollegeChoice = row.continueInCollegeChoice;
    }
  }
  if (typeof row.reviewStatus === "string" && DRAFT_STATUSES.has(row.reviewStatus)) {
    draft.reviewStatus = row.reviewStatus as DraftReviewStatus;
  }
  if (reviewedAt) draft.reviewedAt = reviewedAt;
  if (sourceUpdatedAtSnapshot) draft.sourceUpdatedAtSnapshot = sourceUpdatedAtSnapshot;
  return draft;
}

const HONOR_LEVELS = new Set<string>(["school", "state_regional", "national", "international"]);

function normalizeHonor(raw: unknown): HonorDraft | null {
  const row = asRecord(raw);
  if (!row) return null;
  const awardId = asOptionalString(row.awardId);
  if (!awardId) return null;
  const title = asString(row.title) ?? "";
  const grades = Array.isArray(row.grades)
    ? row.grades
        .map((g) => (typeof g === "number" ? g : Number(g)))
        .filter((g) => Number.isInteger(g) && g >= 9 && g <= 12)
    : [];
  let level: HonorLevel | null = null;
  if (typeof row.level === "string" && HONOR_LEVELS.has(row.level)) {
    level = row.level as HonorLevel;
  } else if (row.level === null) {
    level = null;
  }
  const honor: HonorDraft = {
    id: asOptionalString(row.id) ?? newId("honor"),
    awardId,
    sortOrder: asOptionalNumber(row.sortOrder) ?? 0,
    title,
    grades: [...new Set(grades)].sort((a, b) => a - b),
    level,
  };
  if (row.reviewStatus === "draft" || row.reviewStatus === "reviewed") {
    honor.reviewStatus = row.reviewStatus;
  }
  return honor;
}

function normalizeApplicationList(raw: unknown, awardIds?: Set<string>): ApplicationList | null {
  const row = asRecord(raw);
  if (!row) return null;
  const name = asOptionalString(row.name);
  if (!name) return null;
  const stamp = nowIso();
  const entries = Array.isArray(row.entries)
    ? row.entries.map(normalizeDraft).filter((d): d is ApplicationDraft => Boolean(d))
    : [];
  const list: ApplicationList = {
    id: asOptionalString(row.id) ?? newId("applist"),
    name,
    createdAt: asOptionalString(row.createdAt) ?? stamp,
    updatedAt: asOptionalString(row.updatedAt) ?? stamp,
    entries,
  };
  if (Array.isArray(row.honors)) {
    const honors = row.honors
      .map(normalizeHonor)
      .filter((h): h is HonorDraft => Boolean(h))
      .filter((h) => !awardIds || awardIds.has(h.awardId));
    if (honors.length) list.honors = honors;
  }
  return list;
}

function normalizeThreadPlan(raw: unknown): ThreadPlan | undefined {
  const row = asRecord(raw);
  if (!row) return undefined;
  const out: ThreadPlan = {};
  const deeper = asString(row.deeper);
  const lead = asString(row.lead);
  const outsideSchool = asString(row.outsideSchool);
  const makeSomething = asString(row.makeSomething);
  const connect = asString(row.connect);
  if (deeper !== undefined) out.deeper = deeper;
  if (lead !== undefined) out.lead = lead;
  if (outsideSchool !== undefined) out.outsideSchool = outsideSchool;
  if (makeSomething !== undefined) out.makeSomething = makeSomething;
  if (connect !== undefined) out.connect = connect;
  return Object.keys(out).length ? out : undefined;
}

function normalizeThread(raw: unknown): ActivityThread | null {
  const row = asRecord(raw);
  if (!row) return null;
  const name = asOptionalString(row.name);
  if (!name) return null;
  const stamp = nowIso();
  const thread: ActivityThread = {
    id: asOptionalString(row.id) ?? newId("thread"),
    name,
    createdAt: asOptionalString(row.createdAt) ?? stamp,
    updatedAt: asOptionalString(row.updatedAt) ?? stamp,
  };
  const plan = normalizeThreadPlan(row.plan);
  if (plan) thread.plan = plan;
  return thread;
}

export function normalizeJournal(raw: unknown): ActivitiesJournal {
  const empty = emptyJournal();
  const row = asRecord(raw);
  if (!row) return empty;
  const profile = normalizeProfile(row.profile);
  const threads = Array.isArray(row.threads)
    ? row.threads.map(normalizeThread).filter((t): t is ActivityThread => Boolean(t))
    : [];
  const threadIds = new Set(threads.map((t) => t.id));
  const activities = (
    Array.isArray(row.activities)
      ? row.activities.map(normalizeActivity).filter((a): a is Activity => Boolean(a))
      : []
  ).map((activity) => {
    if (!activity.threadId || threadIds.has(activity.threadId)) return activity;
    const { threadId: _drop, ...rest } = activity;
    return rest;
  });
  const awards = Array.isArray(row.awards)
    ? row.awards.map(normalizeAward).filter((a): a is Award => Boolean(a))
    : [];
  const awardIds = new Set(awards.map((a) => a.id));
  return {
    activities,
    awards,
    applicationLists: Array.isArray(row.applicationLists)
      ? row.applicationLists
          .map((list) => normalizeApplicationList(list, awardIds))
          .filter((a): a is ApplicationList => Boolean(a))
      : [],
    ...(threads.length ? { threads } : {}),
    ...(profile ? { profile } : {}),
    ...(row.track !== undefined ? { track: row.track } : {}),
  };
}

export type CreateActivityInput = {
  name: string;
  category: ActivityCategoryId | string;
  organization?: string;
  orgPurpose?: string;
  locationFormat?: string;
  startMonth?: number;
  startYear?: number;
  endMonth?: number;
  endYear?: number;
  ongoing?: boolean;
  role?: string;
  responsibilities?: string;
  stillParticipating?: boolean;
  categoryExtras?: CategoryExtras;
  reflections?: ActivityReflections;
  mentorName?: string;
  mentorRole?: string;
  mentorEmail?: string;
  links?: ActivityLink[];
  periods?: ParticipationPeriod[];
  updates?: ActivityUpdate[];
  createdBy?: string;
  id?: string;
  recallSource?: boolean;
  icon?: string;
  project?: SelfStartedProject;
};

export function createActivity(input: CreateActivityInput): Activity {
  const stamp = nowIso();
  const name = input.name.trim();
  if (!name) throw new Error("Activity name is required");
  const category: ActivityCategoryId = isCategoryId(input.category) ? input.category : "other";
  const activity: Activity = {
    id: input.id ?? newId("activity"),
    name,
    category,
    ongoing: input.ongoing ?? input.stillParticipating ?? false,
    periods: input.periods ? [...input.periods] : [],
    updates: input.updates ? [...input.updates] : [],
    createdAt: stamp,
    updatedAt: stamp,
  };
  if (input.organization !== undefined) activity.organization = input.organization;
  if (input.orgPurpose !== undefined) activity.orgPurpose = input.orgPurpose;
  if (input.locationFormat !== undefined) activity.locationFormat = input.locationFormat;
  if (input.startMonth !== undefined) activity.startMonth = input.startMonth;
  if (input.startYear !== undefined) activity.startYear = input.startYear;
  if (input.endMonth !== undefined) activity.endMonth = input.endMonth;
  if (input.endYear !== undefined) activity.endYear = input.endYear;
  if (input.role !== undefined) activity.role = input.role;
  if (input.responsibilities !== undefined) activity.responsibilities = input.responsibilities;
  if (input.stillParticipating !== undefined) activity.stillParticipating = input.stillParticipating;
  if (input.categoryExtras) activity.categoryExtras = input.categoryExtras;
  if (input.reflections) activity.reflections = input.reflections;
  if (input.mentorName !== undefined) activity.mentorName = input.mentorName;
  if (input.mentorRole !== undefined) activity.mentorRole = input.mentorRole;
  if (input.mentorEmail !== undefined) activity.mentorEmail = input.mentorEmail;
  if (input.links) activity.links = [...input.links];
  if (input.createdBy) activity.createdBy = input.createdBy;
  if (input.recallSource !== undefined) activity.recallSource = input.recallSource;
  if (input.project) {
    activity.project = normalizeSelfStartedProject(input.project) ?? emptySelfStartedProject();
  }
  activity.icon = pickActivityIcon({
    name,
    category,
    organization: input.organization,
    icon: input.icon,
  });
  return activity;
}

export function upsertActivity(journal: ActivitiesJournal, activity: Activity): ActivitiesJournal {
  const stamp = nowIso();
  const next = { ...activity, updatedAt: stamp };
  const idx = journal.activities.findIndex((a) => a.id === activity.id);
  const activities =
    idx >= 0
      ? journal.activities.map((a, i) => (i === idx ? { ...next, createdAt: a.createdAt } : a))
      : [...journal.activities, next];
  return { ...journal, activities };
}

export function archiveActivity(journal: ActivitiesJournal, activityId: string): ActivitiesJournal {
  const stamp = nowIso();
  return {
    ...journal,
    activities: journal.activities.map((a) =>
      a.id === activityId ? { ...a, archived: true, updatedAt: stamp } : a,
    ),
  };
}

/** Hard-delete an activity. Only used for activities created in the current Recall or quick-add session. */
export function removeActivity(journal: ActivitiesJournal, activityId: string): ActivitiesJournal {
  return {
    ...journal,
    activities: journal.activities.filter((a) => a.id !== activityId),
  };
}

export function restoreActivity(journal: ActivitiesJournal, activityId: string): ActivitiesJournal {
  const stamp = nowIso();
  return {
    ...journal,
    activities: journal.activities.map((a) =>
      a.id === activityId ? { ...a, archived: false, updatedAt: stamp } : a,
    ),
  };
}

export function createThread(
  journal: ActivitiesJournal,
  name: string,
): { journal: ActivitiesJournal; thread: ActivityThread } {
  const stamp = nowIso();
  const thread: ActivityThread = {
    id: newId("thread"),
    name: name.trim() || "Thread",
    createdAt: stamp,
    updatedAt: stamp,
  };
  return {
    journal: { ...journal, threads: [...(journal.threads ?? []), thread] },
    thread,
  };
}

export function renameThread(
  journal: ActivitiesJournal,
  threadId: string,
  name: string,
): ActivitiesJournal {
  const trimmed = name.trim();
  if (!trimmed) return journal;
  const stamp = nowIso();
  return {
    ...journal,
    threads: (journal.threads ?? []).map((t) =>
      t.id === threadId ? { ...t, name: trimmed, updatedAt: stamp } : t,
    ),
  };
}

export function deleteThread(journal: ActivitiesJournal, threadId: string): ActivitiesJournal {
  const stamp = nowIso();
  return {
    ...journal,
    threads: (journal.threads ?? []).filter((t) => t.id !== threadId),
    activities: journal.activities.map((a) => {
      if (a.threadId !== threadId) return a;
      const { threadId: _drop, ...rest } = a;
      return { ...rest, updatedAt: stamp };
    }),
  };
}

export function assignActivityToThread(
  journal: ActivitiesJournal,
  activityId: string,
  threadId: string | null,
): ActivitiesJournal {
  const stamp = nowIso();
  const valid =
    threadId == null || (journal.threads ?? []).some((t) => t.id === threadId) ? threadId : null;
  return {
    ...journal,
    activities: journal.activities.map((a) => {
      if (a.id !== activityId) return a;
      if (valid == null) {
        const { threadId: _drop, ...rest } = a;
        return { ...rest, updatedAt: stamp };
      }
      return { ...a, threadId: valid, updatedAt: stamp };
    }),
  };
}

export function addPeriod(
  journal: ActivitiesJournal,
  activityId: string,
  period: Omit<ParticipationPeriod, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
  },
): ActivitiesJournal {
  const stamp = nowIso();
  const full: ParticipationPeriod = {
    ...period,
    id: period.id ?? newId("period"),
    createdAt: period.createdAt ?? stamp,
    updatedAt: period.updatedAt ?? stamp,
  };
  return {
    ...journal,
    activities: journal.activities.map((a) => {
      if (a.id !== activityId) return a;
      return { ...a, periods: [...a.periods, full], updatedAt: stamp };
    }),
  };
}

export function updatePeriod(
  journal: ActivitiesJournal,
  activityId: string,
  periodId: string,
  patch: Partial<Omit<ParticipationPeriod, "id" | "createdAt">>,
): ActivitiesJournal {
  const stamp = nowIso();
  return {
    ...journal,
    activities: journal.activities.map((a) => {
      if (a.id !== activityId) return a;
      return {
        ...a,
        updatedAt: stamp,
        periods: a.periods.map((p) =>
          p.id === periodId ? { ...p, ...patch, id: p.id, createdAt: p.createdAt, updatedAt: stamp } : p,
        ),
      };
    }),
  };
}

export function removePeriod(
  journal: ActivitiesJournal,
  activityId: string,
  periodId: string,
): ActivitiesJournal {
  const stamp = nowIso();
  return {
    ...journal,
    activities: journal.activities.map((a) => {
      if (a.id !== activityId) return a;
      return {
        ...a,
        updatedAt: stamp,
        periods: a.periods.filter((p) => p.id !== periodId),
      };
    }),
  };
}

export function addUpdate(
  journal: ActivitiesJournal,
  activityId: string,
  update: Omit<ActivityUpdate, "id" | "activityId" | "createdAt" | "updatedAt"> & {
    id?: string;
    activityId?: string;
    createdAt?: string;
    updatedAt?: string;
  },
): ActivitiesJournal {
  const stamp = nowIso();
  const whatHappened = update.whatHappened.trim();
  if (!whatHappened) throw new Error("Update requires whatHappened");
  const full: ActivityUpdate = {
    ...update,
    id: update.id ?? newId("update"),
    activityId,
    whatHappened,
    date: update.date || stamp.slice(0, 10),
    createdAt: update.createdAt ?? stamp,
    updatedAt: update.updatedAt ?? stamp,
  };
  return {
    ...journal,
    activities: journal.activities.map((a) => {
      if (a.id !== activityId) return a;
      return { ...a, updates: [...a.updates, full], updatedAt: stamp };
    }),
  };
}

export function updateUpdate(
  journal: ActivitiesJournal,
  activityId: string,
  updateId: string,
  patch: Partial<Omit<ActivityUpdate, "id" | "activityId" | "createdAt">>,
): ActivitiesJournal {
  const stamp = nowIso();
  return {
    ...journal,
    activities: journal.activities.map((a) => {
      if (a.id !== activityId) return a;
      return {
        ...a,
        updatedAt: stamp,
        updates: a.updates.map((u) =>
          u.id === updateId
            ? {
                ...u,
                ...patch,
                id: u.id,
                activityId: u.activityId,
                createdAt: u.createdAt,
                updatedAt: stamp,
                whatHappened: patch.whatHappened?.trim() || u.whatHappened,
              }
            : u,
        ),
      };
    }),
  };
}

export function removeUpdate(
  journal: ActivitiesJournal,
  activityId: string,
  updateId: string,
): ActivitiesJournal {
  const stamp = nowIso();
  return {
    ...journal,
    activities: journal.activities.map((a) => {
      if (a.id !== activityId) return a;
      return {
        ...a,
        updatedAt: stamp,
        updates: a.updates.filter((u) => u.id !== updateId),
      };
    }),
  };
}

export function upsertAward(journal: ActivitiesJournal, award: Award): ActivitiesJournal {
  const stamp = nowIso();
  const next = { ...award, updatedAt: stamp };
  const idx = journal.awards.findIndex((a) => a.id === award.id);
  const awards =
    idx >= 0
      ? journal.awards.map((a, i) => (i === idx ? { ...next, createdAt: a.createdAt } : a))
      : [...journal.awards, next];
  return { ...journal, awards };
}

export function archiveAward(journal: ActivitiesJournal, awardId: string): ActivitiesJournal {
  const stamp = nowIso();
  return {
    ...journal,
    awards: journal.awards.map((a) =>
      a.id === awardId ? { ...a, archived: true, updatedAt: stamp } : a,
    ),
  };
}

export function createApplicationList(
  journal: ActivitiesJournal,
  name: string,
): { journal: ActivitiesJournal; list: ApplicationList } {
  const stamp = nowIso();
  const list: ApplicationList = {
    id: newId("applist"),
    name: name.trim() || "Application list",
    createdAt: stamp,
    updatedAt: stamp,
    entries: [],
  };
  return { journal: { ...journal, applicationLists: [...journal.applicationLists, list] }, list };
}

export function reorderDraft(
  journal: ActivitiesJournal,
  listId: string,
  draftId: string,
  newSortOrder: number,
): ActivitiesJournal {
  const stamp = nowIso();
  return {
    ...journal,
    applicationLists: journal.applicationLists.map((list) => {
      if (list.id !== listId) return list;
      const entries = list.entries.map((e) =>
        e.id === draftId ? { ...e, sortOrder: newSortOrder } : e,
      );
      entries.sort((a, b) => a.sortOrder - b.sortOrder);
      return { ...list, entries, updatedAt: stamp };
    }),
  };
}

export function upsertDraft(
  journal: ActivitiesJournal,
  listId: string,
  draft: ApplicationDraft,
): ActivitiesJournal {
  const stamp = nowIso();
  return {
    ...journal,
    applicationLists: journal.applicationLists.map((list) => {
      if (list.id !== listId) return list;
      const idx = list.entries.findIndex((e) => e.id === draft.id);
      const entries =
        idx >= 0
          ? list.entries.map((e, i) => (i === idx ? draft : e))
          : [...list.entries, draft];
      entries.sort((a, b) => a.sortOrder - b.sortOrder);
      return { ...list, entries, updatedAt: stamp };
    }),
  };
}

export function removeDraftFromList(
  journal: ActivitiesJournal,
  listId: string,
  draftId: string,
): ActivitiesJournal {
  const stamp = nowIso();
  return {
    ...journal,
    applicationLists: journal.applicationLists.map((list) => {
      if (list.id !== listId) return list;
      return {
        ...list,
        updatedAt: stamp,
        entries: list.entries.filter((e) => e.id !== draftId),
      };
    }),
  };
}

export function upsertHonor(
  journal: ActivitiesJournal,
  listId: string,
  honor: HonorDraft,
): ActivitiesJournal {
  const stamp = nowIso();
  return {
    ...journal,
    applicationLists: journal.applicationLists.map((list) => {
      if (list.id !== listId) return list;
      const current = list.honors ?? [];
      const idx = current.findIndex((h) => h.id === honor.id);
      const honors =
        idx >= 0 ? current.map((h, i) => (i === idx ? honor : h)) : [...current, honor];
      honors.sort((a, b) => a.sortOrder - b.sortOrder);
      return { ...list, honors, updatedAt: stamp };
    }),
  };
}

export function removeHonorFromList(
  journal: ActivitiesJournal,
  listId: string,
  honorId: string,
): ActivitiesJournal {
  const stamp = nowIso();
  return {
    ...journal,
    applicationLists: journal.applicationLists.map((list) => {
      if (list.id !== listId) return list;
      return {
        ...list,
        updatedAt: stamp,
        honors: (list.honors ?? []).filter((h) => h.id !== honorId),
      };
    }),
  };
}

export function estimatedHours(period: ParticipationPeriod): number | null {
  const hours = period.hoursPerWeek;
  const weeks = period.weeksActive;
  if (hours == null || weeks == null) return null;
  if (!Number.isFinite(hours) || !Number.isFinite(weeks)) return null;
  if (hours < 0 || weeks < 0) return null;
  return hours * weeks;
}

function periodRecency(period: ParticipationPeriod): number {
  if (period.startDate) {
    const t = Date.parse(period.startDate);
    if (!Number.isNaN(t)) return t;
  }
  const match = /^(\d{4})/.exec(period.schoolYear);
  if (match) return Date.parse(`${match[1]}-09-01`);
  return Date.parse(period.updatedAt) || 0;
}

export function latestPeriod(activity: Activity): ParticipationPeriod | null {
  if (!activity.periods.length) return null;
  return [...activity.periods].sort((a, b) => periodRecency(b) - periodRecency(a))[0] ?? null;
}

export function latestUpdate(activity: Activity): ActivityUpdate | null {
  if (!activity.updates.length) return null;
  return [...activity.updates].sort((a, b) => {
    const da = Date.parse(a.date) || 0;
    const db = Date.parse(b.date) || 0;
    if (db !== da) return db - da;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  })[0] ?? null;
}

export function activityStatusLabel(
  activity: Activity,
): "Ongoing" | "Completed" | "Planned" | "In progress" | "Archived" {
  if (activity.archived) return "Archived";
  if (activity.ongoing || activity.stillParticipating) return "Ongoing";
  const latest = latestPeriod(activity);
  if (latest?.status === "in_progress") return "In progress";
  if (latest?.status === "planned") return "Planned";
  if (latest?.status === "completed") return "Completed";
  if (activity.endYear || activity.endMonth) return "Completed";
  return "Ongoing";
}

function activityMatchesStatus(activity: Activity, status: ActivityStatusFilter): boolean {
  if (status === "all") return true;
  const label = activityStatusLabel(activity);
  if (status === "ongoing") {
    return label === "Ongoing" || label === "In progress";
  }
  return label === "Completed";
}

export function filterActivities(
  activities: Activity[],
  filter: ActivityFilter = {},
): Activity[] {
  const query = filter.query?.trim().toLowerCase() ?? "";
  return activities.filter((activity) => {
    if (activity.archived) return false;
    if (filter.category && activity.category !== filter.category) return false;
    if (filter.grade) {
      const hasGrade = activity.periods.some((p) => p.grade === filter.grade);
      if (!hasGrade) return false;
    }
    if (filter.status && !activityMatchesStatus(activity, filter.status)) return false;
    if (!query) return true;
    const haystack = [
      activity.name,
      activity.organization,
      activity.role,
      activity.responsibilities,
      activity.orgPurpose,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

/** Returns the journal with a "Common App" list, creating it if missing. Pure. */
export function ensureCommonAppList(journal: ActivitiesJournal): ActivitiesJournal {
  if (journal.applicationLists.some((list) => list.id === COMMON_APP_LIST_ID)) return journal;
  const stamp = nowIso();
  return {
    ...journal,
    applicationLists: [
      ...journal.applicationLists,
      {
        id: COMMON_APP_LIST_ID,
        name: "Common App",
        createdAt: stamp,
        updatedAt: stamp,
        entries: [],
      },
    ],
  };
}

export function getCommonAppList(journal: ActivitiesJournal): ApplicationList {
  const ensured = ensureCommonAppList(journal);
  return ensured.applicationLists.find((list) => list.id === COMMON_APP_LIST_ID)!;
}

/** Distinct grades 9-12 with a completed or in_progress period, ascending. */
export function commonAppGrades(activity: Activity): number[] {
  const grades = new Set<number>();
  for (const period of activity.periods) {
    if (period.status !== "completed" && period.status !== "in_progress") continue;
    if (period.grade === "post" || period.grade === "other") continue;
    const grade = Number(period.grade);
    if (Number.isInteger(grade) && grade >= 9 && grade <= 12) grades.add(grade);
  }
  return [...grades].sort((a, b) => a - b);
}

/** "School year", "School break" or "All year", from the periods' periodKind. */
export function commonAppTiming(activity: Activity): string | null {
  const kinds = new Set<PeriodKind>();
  for (const period of activity.periods) {
    if (period.status !== "completed" && period.status !== "in_progress") continue;
    kinds.add(period.periodKind);
  }
  const useful = [...kinds].filter((k) => k !== "custom");
  if (!useful.length) return null;
  if (useful.includes("all_year") || (useful.includes("school_year") && useful.includes("summer"))) {
    return "All year";
  }
  if (useful.length === 1 && useful[0] === "school_year") return "School year";
  if (useful.length === 1 && useful[0] === "summer") return "School break";
  if (useful.includes("school_year")) return "School year";
  if (useful.includes("summer")) return "School break";
  return null;
}

/** Hours per week and weeks per year from the latest period that has them. */
export function commonAppTime(activity: Activity): {
  hoursPerWeek: number | null;
  weeksPerYear: number | null;
} {
  const candidates = [...activity.periods]
    .filter(
      (p) =>
        (p.status === "completed" || p.status === "in_progress") &&
        (p.hoursPerWeek != null || p.weeksActive != null),
    )
    .sort((a, b) => periodRecency(b) - periodRecency(a));
  const latest = candidates[0];
  if (!latest) return { hoursPerWeek: null, weeksPerYear: null };
  return {
    hoursPerWeek: latest.hoursPerWeek ?? null,
    weeksPerYear: latest.weeksActive ?? null,
  };
}

/** True when the activity changed after the draft was marked ready. */
export function isDraftStale(draft: ApplicationDraft, activity: Activity): boolean {
  if (draft.reviewStatus !== "reviewed" || !draft.reviewedAt) return false;
  const reviewed = Date.parse(draft.reviewedAt);
  const updated = Date.parse(activity.updatedAt);
  if (Number.isNaN(reviewed) || Number.isNaN(updated)) return false;
  return updated > reviewed;
}

export function prepSummary(list: ApplicationList, journal: ActivitiesJournal): string {
  const entries = [...list.entries].sort((a, b) => a.sortOrder - b.sortOrder);
  const ready = entries.filter((draft) => {
    const activity = journal.activities.find((a) => a.id === draft.activityId);
    if (!activity) return false;
    if (isDraftStale(draft, activity)) return false;
    const roleOver = charCount(draft.draftRole) > APP_DRAFT_LIMITS.role;
    const orgOver = charCount(draft.draftOrg) > APP_DRAFT_LIMITS.org;
    const descOver = charCount(draft.shortDescription) > APP_DRAFT_LIMITS.short;
    return draft.reviewStatus === "reviewed" && !roleOver && !orgOver && !descOver;
  }).length;
  const honors = [...(list.honors ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  return `${entries.length} of 10 activities chosen, ${ready} ready. ${honors.length} of 5 honors chosen. Built from My Record, in Common App fields.`;
}

export function inferHonorLevel(recognitionLevel: string | undefined): HonorLevel | null {
  if (!recognitionLevel) return null;
  const text = recognitionLevel.toLowerCase();
  if (text.includes("international")) return "international";
  if (text.includes("national")) return "national";
  if (text.includes("state") || text.includes("regional")) return "state_regional";
  if (text.includes("school")) return "school";
  return null;
}

export function commonAppCopyText(list: ApplicationList, journal: ActivitiesJournal): string {
  const lines: string[] = ["ACTIVITIES", ""];
  const entries = [...list.entries].sort((a, b) => a.sortOrder - b.sortOrder);
  entries.forEach((draft, index) => {
    const activity = journal.activities.find((a) => a.id === draft.activityId);
    const name = activity?.name ?? draft.activityId;
    lines.push(`${index + 1}. ${name}`);
    if (draft.draftRole?.trim()) lines.push(`Position or leadership: ${draft.draftRole.trim()}`);
    if (draft.draftOrg?.trim()) lines.push(`Organization: ${draft.draftOrg.trim()}`);
    if (draft.shortDescription?.trim()) lines.push(`Description: ${draft.shortDescription.trim()}`);
    if (activity) {
      const grades = commonAppGrades(activity);
      if (grades.length) lines.push(`Grades: ${grades.join(", ")}`);
      const timing = commonAppTiming(activity);
      if (timing) lines.push(`Timing: ${timing}`);
      const time = commonAppTime(activity);
      if (time.hoursPerWeek != null) lines.push(`Hours per week: ${time.hoursPerWeek}`);
      if (time.weeksPerYear != null) lines.push(`Weeks per year: ${time.weeksPerYear}`);
    }
    if (draft.continueInCollegeChoice === true) lines.push("Plan to continue in college: Yes");
    if (draft.continueInCollegeChoice === false) lines.push("Plan to continue in college: No");
    lines.push("");
  });
  lines.push("HONORS", "");
  const honors = [...(list.honors ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  honors.forEach((honor, index) => {
    lines.push(`${index + 1}. ${honor.title.trim() || "Honor"}`);
    if (honor.grades.length) lines.push(`Grades: ${honor.grades.join(", ")}`);
    if (honor.level) lines.push(`Level: ${HONOR_LEVEL_LABEL[honor.level]}`);
    lines.push("");
  });
  return lines.join("\n").trimEnd() + "\n";
}

export function activityNeedsDetails(a: Activity): boolean {
  return !a.role?.trim() && !a.responsibilities?.trim();
}

export type RecallSpan = {
  sinceGrade?: number;
  untilGrade?: number;
  stillDoing: boolean;
};

/** The periods Recall creates for a span. */
export function recallPeriods(
  classOf: number,
  span: RecallSpan,
  now: Date = new Date(),
): ParticipationPeriod[] {
  const since = span.sinceGrade;
  if (since == null) return [];
  const current = currentGrade(Number.isFinite(classOf) ? classOf : undefined, now);
  const stillDoing = span.stillDoing;
  const last = stillDoing
    ? (current ?? since)
    : Math.min(span.untilGrade ?? since, current ?? span.untilGrade ?? since);
  if (current != null && since > current) return [];
  if (last < since) return [];
  const stamp = now.toISOString();
  const yearForLabel = current != null ? Math.trunc(classOf) : undefined;
  const periods: ParticipationPeriod[] = [];
  for (let g = since; g <= last; g++) {
    periods.push({
      id: newId("period"),
      schoolYear: yearForLabel != null ? schoolYearForGrade(yearForLabel, g) : "",
      grade: String(g) as GradeLevel,
      periodKind: "school_year",
      status: stillDoing && g === (current ?? last) ? "in_progress" : "completed",
      createdAt: stamp,
      updatedAt: stamp,
    });
  }
  return periods;
}

function startYearFromPeriods(periods: ParticipationPeriod[]): number | undefined {
  const startYear = periods[0] ? Number.parseInt(periods[0].schoolYear.slice(0, 4), 10) : undefined;
  return Number.isFinite(startYear) ? startYear : undefined;
}

export function activityFromRecall(
  input: {
    name: string;
    category: ActivityCategoryId;
    sinceGrade?: number;
    untilGrade?: number;
    stillDoing: boolean;
  },
  classOf: number,
  now: Date = new Date(),
): Activity {
  const periods = recallPeriods(
    classOf,
    {
      sinceGrade: input.sinceGrade,
      untilGrade: input.untilGrade,
      stillDoing: input.stillDoing,
    },
    now,
  );
  return createActivity({
    name: input.name,
    category: input.category,
    ongoing: input.stillDoing,
    periods,
    startYear: startYearFromPeriods(periods),
    recallSource: true,
  });
}

/** Replace an activity's periods with the Recall span. Sets ongoing, startYear, updatedAt. */
export function applyRecallSpan(
  journal: ActivitiesJournal,
  activityId: string,
  classOf: number,
  span: RecallSpan,
  now: Date = new Date(),
): ActivitiesJournal {
  const stamp = now.toISOString();
  const periods = recallPeriods(classOf, span, now);
  const startYear = startYearFromPeriods(periods);
  return {
    ...journal,
    activities: journal.activities.map((a) => {
      if (a.id !== activityId) return a;
      return {
        ...a,
        periods,
        ongoing: span.stillDoing,
        startYear,
        updatedAt: stamp,
      };
    }),
  };
}

const GRADE_STATE_RANK: Record<PeriodStatus, number> = {
  in_progress: 3,
  completed: 2,
  planned: 1,
};

export type GradeCellState = PeriodStatus | null;

/** Strongest period status per numeric grade. Ignores post and other. */
export function gradeCells(activity: Activity): Record<number, GradeCellState> {
  const cells: Record<number, GradeCellState> = {};
  for (const period of activity.periods) {
    if (period.grade === "post" || period.grade === "other") continue;
    const grade = Number(period.grade);
    if (!Number.isInteger(grade) || grade < 6 || grade > 12) continue;
    const current = cells[grade];
    if (!current || GRADE_STATE_RANK[period.status] > GRADE_STATE_RANK[current]) {
      cells[grade] = period.status;
    }
  }
  return cells;
}

function filledNumericGrades(activity: Activity): number[] {
  const grades = new Set<number>();
  for (const period of activity.periods) {
    if (period.status !== "completed" && period.status !== "in_progress") continue;
    if (period.grade === "post" || period.grade === "other") continue;
    const grade = Number(period.grade);
    if (Number.isInteger(grade) && grade >= 6 && grade <= 12) grades.add(grade);
  }
  return [...grades].sort((a, b) => a - b);
}

export function recordSchoolYears(activity: Activity): number {
  return filledNumericGrades(activity).length;
}

/** True when there is an in-progress period for the student's current grade. */
export function ongoingFromPeriods(
  activity: Pick<Activity, "periods">,
  gradeNow: number | null,
): boolean {
  if (gradeNow == null) return false;
  const key = String(gradeNow);
  return activity.periods.some((p) => p.status === "in_progress" && p.grade === key);
}

export function recordSpanText(activity: Activity, gradeNow: number | null): string {
  const grades = filledNumericGrades(activity);
  if (!grades.length) return "Start grade not set";
  const first = grades[0]!;
  const last = grades[grades.length - 1]!;
  const hasCurrent = gradeNow != null && grades.includes(gradeNow);
  if (activity.ongoing && hasCurrent) return `Since ${first}th grade · still doing it`;
  if (first === last) return `${first}th grade`;
  return `${first}th to ${last}th grade`;
}

export function recordSummary(journal: ActivitiesJournal, _gradeNow?: number | null): string {
  const activities = journal.activities.filter((a) => !a.archived);
  const n = activities.length;
  const noun = n === 1 ? "activity" : "activities";
  const ranked = activities
    .map((a) => ({ name: a.name, years: recordSchoolYears(a) }))
    .filter((a) => a.years > 0);
  if (!ranked.length) return `${n} ${noun}.`;
  const max = Math.max(...ranked.map((a) => a.years));
  const tied = ranked.filter((a) => a.years === max).sort((a, b) => a.name.localeCompare(b.name));
  const yearWord = max === 1 ? "school year" : "school years";
  if (tied.length === 1) {
    return `${n} ${noun}. Your longest is ${tied[0]!.name}, at ${max} ${yearWord}.`;
  }
  const named = tied.slice(0, 2).map((a) => a.name);
  const extra = tied.length - 2;
  if (extra > 0) {
    return `${n} ${noun}. Your longest are ${named[0]} and ${named[1]}, and ${extra} more, at ${max} ${yearWord} each.`;
  }
  return `${n} ${noun}. Your longest are ${named[0]} and ${named[1]}, at ${max} ${yearWord} each.`;
}

export function sortRecordActivities(activities: Activity[]): Activity[] {
  return [...activities].sort((a, b) => {
    const ag = filledNumericGrades(a)[0] ?? 99;
    const bg = filledNumericGrades(b)[0] ?? 99;
    if (ag !== bg) return ag - bg;
    return a.name.localeCompare(b.name);
  });
}

function categoryLabel(id: ActivityCategoryId): string {
  return ACTIVITY_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function exportListMarkdown(
  list: ApplicationList,
  journal: ActivitiesJournal,
  options: { includePrivate?: boolean } = {},
): string {
  const includePrivate = options.includePrivate === true;
  const lines: string[] = [`# ${list.name}`, ""];
  const ordered = [...list.entries].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const entry of ordered) {
    const activity = journal.activities.find((a) => a.id === entry.activityId);
    const title = activity?.name ?? entry.activityId;
    lines.push(`## ${title}`);
    if (activity) {
      lines.push(`- Category: ${categoryLabel(activity.category)}`);
      const org = entry.draftOrg ?? activity.organization;
      if (org) lines.push(`- Organization: ${org}`);
      const role = entry.draftRole ?? activity.role;
      if (role) lines.push(`- Role: ${role}`);
    } else {
      if (entry.draftOrg) lines.push(`- Organization: ${entry.draftOrg}`);
      if (entry.draftRole) lines.push(`- Role: ${entry.draftRole}`);
    }
    if (entry.shortDescription) {
      lines.push("", "### Short description", entry.shortDescription);
    }
    if (entry.longDescription) {
      lines.push("", "### Long description", entry.longDescription);
    }
    if (entry.gradesReviewed) lines.push("", `- Grades reviewed: ${entry.gradesReviewed}`);
    if (entry.timeCommitmentReviewed) {
      lines.push(`- Time commitment: ${entry.timeCommitmentReviewed}`);
    }
    if (entry.continueInCollege) {
      lines.push(`- Continue in college: ${entry.continueInCollege}`);
    }
    if (entry.reviewStatus) lines.push(`- Review status: ${entry.reviewStatus}`);

    if (includePrivate && activity) {
      if (activity.mentorName || activity.mentorRole || activity.mentorEmail) {
        lines.push("", "### Mentor");
        if (activity.mentorName) lines.push(`- Name: ${activity.mentorName}`);
        if (activity.mentorRole) lines.push(`- Role: ${activity.mentorRole}`);
        if (activity.mentorEmail) lines.push(`- Email: ${activity.mentorEmail}`);
      }
      if (activity.reflections) {
        lines.push("", "### Reflections");
        const r = activity.reflections;
        if (r.whyMatters) lines.push(`- Why it matters: ${r.whyMatters}`);
        if (r.skills) lines.push(`- Skills: ${r.skills}`);
        if (r.growth) lines.push(`- Growth: ${r.growth}`);
        if (r.memorable) lines.push(`- Memorable: ${r.memorable}`);
      }
      if (activity.links?.length) {
        lines.push("", "### Links");
        for (const link of activity.links) {
          const note = link.note ? ` — ${link.note}` : "";
          lines.push(`- [${link.label}](${link.url})${note}`);
        }
      }
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
