/** Student Activities journal — persisted as one JSON blob on app_state. */

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

export type GradeLevel = "9" | "10" | "11" | "12" | "post" | "other";

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
  reviewStatus?: DraftReviewStatus;
  reviewedAt?: string;
  sourceUpdatedAtSnapshot?: string;
};

export type ApplicationList = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  entries: ApplicationDraft[];
};

export type ActivitiesJournal = {
  activities: Activity[];
  awards: Award[];
  applicationLists: ApplicationList[];
};

export const APP_DRAFT_LIMITS = {
  role: 50,
  org: 100,
  short: 150,
  long: 350,
} as const;

export type ActivityStatusFilter = "all" | "ongoing" | "completed";

export type ActivityFilter = {
  query?: string;
  category?: ActivityCategoryId | string;
  grade?: GradeLevel | string;
  status?: ActivityStatusFilter;
};

const GRADE_LEVELS = new Set<string>(["9", "10", "11", "12", "post", "other"]);
const PERIOD_KINDS = new Set<string>(["school_year", "summer", "all_year", "custom"]);
const HOURS_BASES = new Set<string>(["estimate", "schedule", "calendar", "timesheet", "other"]);
const PERIOD_STATUSES = new Set<string>(["completed", "in_progress", "planned"]);
const DRAFT_STATUSES = new Set<string>(["draft", "reviewed", "stale"]);
const METRIC_ATTRS = new Set<string>(["individual", "team"]);

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
  if (categoryExtras) activity.categoryExtras = categoryExtras;
  if (reflections) activity.reflections = reflections;
  if (Array.isArray(row.links)) {
    const links = row.links.map(normalizeLink).filter((l): l is ActivityLink => Boolean(l));
    if (links.length) activity.links = links;
  }
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
  if (typeof row.reviewStatus === "string" && DRAFT_STATUSES.has(row.reviewStatus)) {
    draft.reviewStatus = row.reviewStatus as DraftReviewStatus;
  }
  if (reviewedAt) draft.reviewedAt = reviewedAt;
  if (sourceUpdatedAtSnapshot) draft.sourceUpdatedAtSnapshot = sourceUpdatedAtSnapshot;
  return draft;
}

function normalizeApplicationList(raw: unknown): ApplicationList | null {
  const row = asRecord(raw);
  if (!row) return null;
  const name = asOptionalString(row.name);
  if (!name) return null;
  const stamp = nowIso();
  const entries = Array.isArray(row.entries)
    ? row.entries.map(normalizeDraft).filter((d): d is ApplicationDraft => Boolean(d))
    : [];
  return {
    id: asOptionalString(row.id) ?? newId("applist"),
    name,
    createdAt: asOptionalString(row.createdAt) ?? stamp,
    updatedAt: asOptionalString(row.updatedAt) ?? stamp,
    entries,
  };
}

export function normalizeJournal(raw: unknown): ActivitiesJournal {
  const empty = emptyJournal();
  const row = asRecord(raw);
  if (!row) return empty;
  return {
    activities: Array.isArray(row.activities)
      ? row.activities.map(normalizeActivity).filter((a): a is Activity => Boolean(a))
      : [],
    awards: Array.isArray(row.awards)
      ? row.awards.map(normalizeAward).filter((a): a is Award => Boolean(a))
      : [],
    applicationLists: Array.isArray(row.applicationLists)
      ? row.applicationLists
          .map(normalizeApplicationList)
          .filter((a): a is ApplicationList => Boolean(a))
      : [],
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

export function markDraftsStaleForActivity(
  journal: ActivitiesJournal,
  activityId: string,
  sourceUpdatedAt: string,
): ActivitiesJournal {
  return {
    ...journal,
    applicationLists: journal.applicationLists.map((list) => {
      let changed = false;
      const entries = list.entries.map((entry) => {
        if (entry.activityId !== activityId) return entry;
        if (entry.reviewStatus === "draft" && !entry.reviewedAt) {
          return {
            ...entry,
            sourceUpdatedAtSnapshot: sourceUpdatedAt,
          };
        }
        changed = true;
        return {
          ...entry,
          reviewStatus: "stale" as const,
          sourceUpdatedAtSnapshot: sourceUpdatedAt,
        };
      });
      if (!changed && entries.every((e, i) => e === list.entries[i])) return list;
      return { ...list, entries, updatedAt: nowIso() };
    }),
  };
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
