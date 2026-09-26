import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACTIVITY_CATEGORIES,
  APP_DRAFT_LIMITS,
  activityStatusLabel,
  addPeriod,
  archiveActivity,
  charCount,
  createActivity,
  createApplicationList,
  emptyJournal,
  estimatedHours,
  exportListMarkdown,
  filterActivities,
  formatSchoolYear,
  markDraftsStaleForActivity,
  normalizeJournal,
  upsertActivity,
  upsertAward,
  upsertDraft,
  type ActivitiesJournal,
  type ApplicationDraft,
  type Award,
  type ParticipationPeriod,
} from "./activities-journal";

test("normalize empty / invalid yields empty journal", () => {
  assert.deepEqual(normalizeJournal(null), emptyJournal());
  assert.deepEqual(normalizeJournal(undefined), emptyJournal());
  assert.deepEqual(normalizeJournal("nope"), emptyJournal());
  assert.deepEqual(normalizeJournal({}), emptyJournal());
  assert.equal(normalizeJournal({ activities: [{ name: "" }] }).activities.length, 0);
});

test("ACTIVITY_CATEGORIES use stable kebab ids", () => {
  assert.ok(ACTIVITY_CATEGORIES.length >= 14);
  for (const cat of ACTIVITY_CATEGORIES) {
    assert.match(cat.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(cat.label.length > 0);
  }
  assert.ok(ACTIVITY_CATEGORIES.some((c) => c.id === "family-household-responsibilities"));
});

test("create minimal activity with name and category only", () => {
  const activity = createActivity({ name: "Robotics", category: "school-club" });
  assert.equal(activity.name, "Robotics");
  assert.equal(activity.category, "school-club");
  assert.equal(activity.organization, undefined);
  assert.equal(activity.periods.length, 0);
  assert.equal(activity.updates.length, 0);
  assert.ok(activity.id.startsWith("activity_"));
  assert.ok(activity.createdAt);
  assert.ok(activity.updatedAt);
});

test("home responsibility works without organization", () => {
  const activity = createActivity({
    name: "Sibling care",
    category: "family-household-responsibilities",
    categoryExtras: { familyTasks: "After-school pickup", regularity: "Weekdays" },
  });
  assert.equal(activity.organization, undefined);
  assert.equal(activity.categoryExtras?.familyTasks, "After-school pickup");
  let journal = emptyJournal();
  journal = upsertActivity(journal, activity);
  const again = normalizeJournal(JSON.parse(JSON.stringify(journal)));
  assert.equal(again.activities[0]!.organization, undefined);
  assert.equal(again.activities[0]!.category, "family-household-responsibilities");
});

test("multi-year periods are preserved", () => {
  let journal = emptyJournal();
  const activity = createActivity({ name: "Soccer", category: "athletics" });
  journal = upsertActivity(journal, activity);
  journal = addPeriod(journal, activity.id, {
    schoolYear: formatSchoolYear(2024),
    grade: "10",
    periodKind: "school_year",
    status: "completed",
    role: "JV midfielder",
    hoursPerWeek: 8,
    weeksActive: 20,
  });
  journal = addPeriod(journal, activity.id, {
    schoolYear: formatSchoolYear(2025),
    grade: "11",
    periodKind: "summer",
    status: "completed",
    role: "Varsity midfielder",
    startDate: "2025-06-01",
    endDate: "2025-08-15",
    hoursPerWeek: 12,
    weeksActive: 10,
  });
  const stored = normalizeJournal(JSON.parse(JSON.stringify(journal)));
  const periods = stored.activities[0]!.periods;
  assert.equal(periods.length, 2);
  assert.equal(periods[0]!.schoolYear, "2024–25");
  assert.equal(periods[0]!.role, "JV midfielder");
  assert.equal(periods[1]!.schoolYear, "2025–26");
  assert.equal(periods[1]!.periodKind, "summer");
  assert.equal(periods[1]!.role, "Varsity midfielder");
});

test("linked vs standalone awards", () => {
  let journal = emptyJournal();
  const activity = createActivity({ name: "Debate", category: "school-club" });
  journal = upsertActivity(journal, activity);
  const stamp = new Date().toISOString();
  const linked: Award = {
    id: "award_linked",
    title: "State Finalist",
    activityId: activity.id,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const standalone: Award = {
    id: "award_solo",
    title: "National Merit Commended",
    activityId: null,
    academic: true,
    createdAt: stamp,
    updatedAt: stamp,
  };
  journal = upsertAward(journal, linked);
  journal = upsertAward(journal, standalone);
  const again = normalizeJournal(JSON.parse(JSON.stringify(journal)));
  assert.equal(again.awards.length, 2);
  assert.equal(again.awards.find((a) => a.id === "award_linked")!.activityId, activity.id);
  assert.equal(again.awards.find((a) => a.id === "award_solo")!.activityId, null);
});

test("filterActivities by query, category, grade, status", () => {
  const club = createActivity({ name: "Math Club", category: "school-club", ongoing: true });
  const work = createActivity({
    name: "Cafe job",
    category: "paid-work",
    organization: "Corner Cafe",
    ongoing: false,
    endYear: 2025,
  });
  work.periods = [
    {
      id: "p1",
      schoolYear: "2025–26",
      grade: "11",
      periodKind: "school_year",
      status: "completed",
      createdAt: club.createdAt,
      updatedAt: club.updatedAt,
    },
  ];
  const archived = createActivity({ name: "Old Hobby", category: "hobby-personal-pursuit" });
  archived.archived = true;

  const list = [club, work, archived];
  assert.equal(filterActivities(list, { query: "cafe" }).length, 1);
  assert.equal(filterActivities(list, { category: "school-club" })[0]!.name, "Math Club");
  assert.equal(filterActivities(list, { grade: "11" })[0]!.name, "Cafe job");
  assert.equal(filterActivities(list, { status: "ongoing" }).length, 1);
  assert.equal(filterActivities(list, { status: "completed" })[0]!.name, "Cafe job");
  assert.equal(filterActivities(list, {}).every((a) => !a.archived), true);
});

test("updating activity marks draft stale without overwriting draft text", () => {
  let journal = emptyJournal();
  const activity = createActivity({
    name: "Orchestra",
    category: "arts-music-theater",
    role: "Violin section",
    organization: "School Orchestra",
  });
  journal = upsertActivity(journal, activity);
  const created = createApplicationList(journal, "Common App top 10");
  journal = created.journal;
  const listId = created.list.id;
  const draft: ApplicationDraft = {
    id: "draft_1",
    activityId: activity.id,
    sortOrder: 0,
    draftRole: "First violin",
    draftOrg: "HS Orchestra (draft)",
    shortDescription: "Led sectionals and performed at regionals.",
    longDescription: "Longer draft text stays put.",
    reviewStatus: "reviewed",
    reviewedAt: activity.createdAt,
    sourceUpdatedAtSnapshot: activity.updatedAt,
  };
  journal = upsertDraft(journal, listId, draft);

  const updated = {
    ...activity,
    role: "Concertmaster",
    responsibilities: "Lead rehearsals",
    updatedAt: new Date().toISOString(),
  };
  journal = upsertActivity(journal, updated);
  journal = markDraftsStaleForActivity(journal, activity.id, updated.updatedAt);

  const entry = journal.applicationLists[0]!.entries[0]!;
  assert.equal(entry.reviewStatus, "stale");
  assert.equal(entry.draftRole, "First violin");
  assert.equal(entry.draftOrg, "HS Orchestra (draft)");
  assert.equal(entry.shortDescription, "Led sectionals and performed at regionals.");
  assert.equal(entry.longDescription, "Longer draft text stays put.");
  assert.equal(entry.sourceUpdatedAtSnapshot, updated.updatedAt);
  assert.notEqual(journal.activities[0]!.role, entry.draftRole);
});

test("estimatedHours multiplies hours and weeks", () => {
  const period: ParticipationPeriod = {
    id: "p",
    schoolYear: "2026–27",
    grade: "12",
    periodKind: "school_year",
    status: "completed",
    hoursPerWeek: 5,
    weeksActive: 30,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(estimatedHours(period), 150);
  assert.equal(estimatedHours({ ...period, weeksActive: undefined }), null);
  assert.equal(estimatedHours({ ...period, hoursPerWeek: undefined }), null);
});

test("exportListMarkdown excludes reflections and mentor email by default", () => {
  let journal: ActivitiesJournal = emptyJournal();
  const activity = createActivity({
    name: "Community garden",
    category: "volunteering-community-service",
    organization: "Neighborhood Garden",
    mentorName: "Ms. Lee",
    mentorEmail: "lee@example.com",
    reflections: {
      whyMatters: "Private reflection — do not export",
      skills: "Patience",
    },
    links: [{ id: "l1", label: "Photos", url: "https://example.com/photos" }],
  });
  journal = upsertActivity(journal, activity);
  const created = createApplicationList(journal, "Counselor share");
  journal = created.journal;
  journal = upsertDraft(journal, created.list.id, {
    id: "d1",
    activityId: activity.id,
    sortOrder: 0,
    draftRole: "Volunteer",
    shortDescription: "Grew vegetables for food bank.",
  });
  const list = journal.applicationLists[0]!;
  const md = exportListMarkdown(list, journal);
  assert.match(md, /Community garden/);
  assert.match(md, /Grew vegetables for food bank/);
  assert.doesNotMatch(md, /Private reflection/);
  assert.doesNotMatch(md, /lee@example\.com/);
  assert.doesNotMatch(md, /Photos/);

  const privateMd = exportListMarkdown(list, journal, { includePrivate: true });
  assert.match(privateMd, /Private reflection/);
  assert.match(privateMd, /lee@example\.com/);
});

test("formatSchoolYear and APP_DRAFT_LIMITS / charCount", () => {
  assert.equal(formatSchoolYear(2026), "2026–27");
  assert.equal(formatSchoolYear(1999), "1999–00");
  assert.equal(APP_DRAFT_LIMITS.role, 50);
  assert.equal(APP_DRAFT_LIMITS.org, 100);
  assert.equal(APP_DRAFT_LIMITS.short, 150);
  assert.equal(APP_DRAFT_LIMITS.long, 350);
  assert.equal(charCount("hi"), 2);
  assert.equal(charCount(""), 0);
});

test("activityStatusLabel and archiveActivity", () => {
  const ongoing = createActivity({ name: "Band", category: "arts-music-theater", ongoing: true });
  assert.equal(activityStatusLabel(ongoing), "Ongoing");
  let journal = upsertActivity(emptyJournal(), ongoing);
  journal = archiveActivity(journal, ongoing.id);
  assert.equal(activityStatusLabel(journal.activities[0]!), "Archived");
});
