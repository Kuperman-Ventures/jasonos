import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activityFromRecall,
  activityNeedsDetails,
  ACTIVITY_CATEGORIES,
  APP_DRAFT_LIMITS,
  activityStatusLabel,
  addPeriod,
  applyRecallSpan,
  archiveActivity,
  charCount,
  createActivity,
  createApplicationList,
  classStanding,
  currentGrade,
  currentSchoolYearEnd,
  emptyJournal,
  graduationYearOptions,
  estimatedHours,
  exportListMarkdown,
  filterActivities,
  formatSchoolYear,
  gradeCells,
  isHighSchoolGrade,
  markDraftsStaleForActivity,
  normalizeJournal,
  recallPeriods,
  recallSpanText,
  recordSpanText,
  recordSummary,
  removeActivity,
  restoreActivity,
  resolveClassOf,
  schoolYearForGrade,
  setClassOf,
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

test("normalizeJournal keeps profile.classOf, middle-school grades, and recallSource", () => {
  const stamp = "2026-10-03T12:00:00.000Z";
  const journal: ActivitiesJournal = {
    activities: [
      {
        id: "activity_band",
        name: "Band",
        category: "arts-music-theater",
        ongoing: true,
        recallSource: true,
        periods: [
          {
            id: "p6",
            schoolYear: "2021–22",
            grade: "6",
            periodKind: "school_year",
            status: "completed",
            createdAt: stamp,
            updatedAt: stamp,
          },
          {
            id: "p7",
            schoolYear: "2022–23",
            grade: "7",
            periodKind: "school_year",
            status: "completed",
            createdAt: stamp,
            updatedAt: stamp,
          },
          {
            id: "p8",
            schoolYear: "2023–24",
            grade: "8",
            periodKind: "school_year",
            status: "completed",
            createdAt: stamp,
            updatedAt: stamp,
          },
        ],
        updates: [],
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    awards: [
      {
        id: "award_ms",
        title: "Beginner belt",
        grade: "6",
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    applicationLists: [],
    profile: { classOf: 2028 },
  };
  const again = normalizeJournal(JSON.parse(JSON.stringify(journal)));
  assert.equal(again.profile?.classOf, 2028);
  assert.equal(again.activities[0]!.recallSource, true);
  assert.deepEqual(
    again.activities[0]!.periods.map((p) => p.grade),
    ["6", "7", "8"],
  );
  assert.equal(again.awards[0]!.grade, "6");
});

test("normalizeJournal drops invalid classOf", () => {
  assert.equal(normalizeJournal({ profile: { classOf: 2019 } }).profile, undefined);
  assert.equal(normalizeJournal({ profile: { classOf: 2041 } }).profile, undefined);
  assert.equal(normalizeJournal({ profile: { classOf: 2020 } }).profile?.classOf, 2020);
  assert.equal(normalizeJournal({ profile: { classOf: 2040 } }).profile?.classOf, 2040);
});

test("currentSchoolYearEnd maps Aug-Dec to the next June", () => {
  assert.equal(currentSchoolYearEnd(new Date(2026, 9, 3)), 2027);
  assert.equal(currentSchoolYearEnd(new Date(2027, 4, 15)), 2027);
  assert.equal(currentSchoolYearEnd(new Date(2027, 7, 1)), 2028);
});

test("currentGrade from classOf", () => {
  assert.equal(currentGrade(2028, new Date(2026, 9, 3)), 11);
  assert.equal(currentGrade(undefined), null);
  assert.equal(currentGrade(0, new Date(2026, 9, 3)), null);
});

test("graduationYearOptions covers this June through three years out", () => {
  assert.deepEqual(graduationYearOptions(new Date(2026, 9, 3)), [2027, 2028, 2029, 2030]);
});

test("classStanding names high-school years", () => {
  assert.equal(classStanding(11), "junior");
  assert.equal(classStanding(null), "");
});

test("setClassOf stores the graduation year", () => {
  const next = setClassOf(emptyJournal(), 2028);
  assert.equal(next.profile?.classOf, 2028);
  assert.equal(normalizeJournal(JSON.parse(JSON.stringify(next))).profile?.classOf, 2028);
});

test("resolveClassOf falls back to 2028 when the year was never saved", () => {
  const now = new Date(2026, 9, 3);
  assert.equal(resolveClassOf(undefined, now), 2028);
  assert.equal(resolveClassOf(0, now), 2028);
  assert.equal(resolveClassOf(2028, now), 2028);
});

test("tapping a start grade without saved classOf fills through junior year", () => {
  const now = new Date(2026, 9, 3);
  const year = resolveClassOf(undefined, now);
  const periods = recallPeriods(year, { sinceGrade: 9, stillDoing: true }, now);
  assert.deepEqual(
    periods.map((p) => p.grade),
    ["9", "10", "11"],
  );
  let journal = emptyJournal();
  const activity = activityFromRecall(
    { name: "Marching Band", category: "other", stillDoing: true },
    year,
    now,
  );
  journal = upsertActivity(journal, activity);
  journal = applyRecallSpan(journal, activity.id, year, { sinceGrade: 9, stillDoing: true }, now);
  assert.deepEqual(
    journal.activities[0]!.periods.map((p) => p.grade),
    ["9", "10", "11"],
  );
  assert.equal(recordSpanText(journal.activities[0]!, 11), "Since 9th grade · still doing it");
});

test("schoolYearForGrade uses classOf", () => {
  assert.equal(schoolYearForGrade(2028, 6), "2021–22");
  assert.equal(schoolYearForGrade(2028, 11), "2026–27");
});

test("isHighSchoolGrade is 9-12 only", () => {
  assert.equal(isHighSchoolGrade("8"), false);
  assert.equal(isHighSchoolGrade("9"), true);
  assert.equal(isHighSchoolGrade("12"), true);
  assert.equal(isHighSchoolGrade("post"), false);
});

test("activityFromRecall since 6 still doing fills 6-11", () => {
  const now = new Date(2026, 9, 3);
  const activity = activityFromRecall(
    {
      name: "Trumpet",
      category: "arts-music-theater",
      sinceGrade: 6,
      stillDoing: true,
    },
    2028,
    now,
  );
  assert.equal(activity.recallSource, true);
  assert.equal(activity.ongoing, true);
  assert.equal(activity.startYear, 2021);
  assert.equal(activity.periods.length, 6);
  assert.deepEqual(
    activity.periods.map((p) => p.grade),
    ["6", "7", "8", "9", "10", "11"],
  );
  assert.deepEqual(
    activity.periods.map((p) => p.status),
    ["completed", "completed", "completed", "completed", "completed", "in_progress"],
  );
  const again = normalizeJournal(
    JSON.parse(JSON.stringify(upsertActivity(emptyJournal(), activity))),
  );
  assert.equal(again.activities[0]!.recallSource, true);
  assert.equal(again.activities[0]!.periods.length, 6);
});

test("activityFromRecall since 9 until 10 not still doing", () => {
  const activity = activityFromRecall(
    {
      name: "Summer camp",
      category: "academic-enrichment",
      sinceGrade: 9,
      untilGrade: 10,
      stillDoing: false,
    },
    2028,
    new Date(2026, 9, 3),
  );
  assert.equal(activity.ongoing, false);
  assert.equal(activity.periods.length, 2);
  assert.equal(activity.periods.every((p) => p.status === "completed"), true);
  assert.deepEqual(
    activity.periods.map((p) => p.grade),
    ["9", "10"],
  );
});

test("activityFromRecall with no since grade has no periods", () => {
  const activity = activityFromRecall(
    { name: "Babysitting", category: "paid-work", stillDoing: true },
    2028,
    new Date(2026, 9, 3),
  );
  assert.equal(activity.periods.length, 0);
  assert.equal(activity.startYear, undefined);
});

test("recallSpanText still doing, stopped, and one year", () => {
  assert.equal(
    recallSpanText(6, null, true, 11),
    "Since 6th grade · still doing it · 6 school years",
  );
  assert.equal(recallSpanText(9, 10, false, 11), "9th to 10th grade · 2 school years");
  assert.equal(
    recallSpanText(11, null, true, 11),
    "Since 11th grade · still doing it · 1 school year",
  );
});

test("activityNeedsDetails when role and responsibilities are blank", () => {
  const blank = createActivity({ name: "Robotics", category: "school-club" });
  assert.equal(activityNeedsDetails(blank), true);
  assert.equal(activityNeedsDetails({ ...blank, role: "Builder" }), false);
  assert.equal(activityNeedsDetails({ ...blank, responsibilities: "Build robots" }), false);
});

test("recallPeriods matches activityFromRecall periods", () => {
  const now = new Date(2026, 9, 3);
  const span = { sinceGrade: 6, stillDoing: true };
  const fromActivity = activityFromRecall(
    { name: "Trumpet", category: "arts-music-theater", ...span },
    2028,
    now,
  );
  const periods = recallPeriods(2028, span, now);
  assert.equal(periods.length, fromActivity.periods.length);
  assert.deepEqual(
    periods.map((p) => p.grade),
    fromActivity.periods.map((p) => p.grade),
  );
  assert.deepEqual(
    periods.map((p) => p.status),
    fromActivity.periods.map((p) => p.status),
  );
});

test("recallPeriods still writes the start grade when classOf is missing", () => {
  const now = new Date(2026, 9, 3);
  const periods = recallPeriods(0, { sinceGrade: 9, stillDoing: true }, now);
  assert.equal(periods.length, 1);
  assert.equal(periods[0]!.grade, "9");
  assert.equal(periods[0]!.status, "in_progress");
  const stopped = recallPeriods(0, { sinceGrade: 9, untilGrade: 10, stillDoing: false }, now);
  assert.deepEqual(
    stopped.map((p) => p.grade),
    ["9", "10"],
  );
  assert.equal(stopped.every((p) => p.status === "completed"), true);
});

test("applyRecallSpan with no classOf keeps the tapped start grade", () => {
  const now = new Date(2026, 9, 3);
  let journal = emptyJournal();
  const activity = activityFromRecall(
    { name: "Marching Band", category: "other", stillDoing: true },
    0,
    now,
  );
  assert.equal(activity.periods.length, 0);
  journal = upsertActivity(journal, activity);
  journal = applyRecallSpan(journal, activity.id, 0, { sinceGrade: 9, stillDoing: true }, now);
  const saved = journal.activities[0]!;
  assert.equal(saved.periods.length, 1);
  assert.equal(saved.periods[0]!.grade, "9");
  assert.equal(saved.ongoing, true);
  assert.equal(recordSpanText(saved, null), "9th grade");
});

test("applyRecallSpan since 6 still doing then stopped at 9", () => {
  const now = new Date(2026, 9, 3);
  let journal = emptyJournal();
  const activity = activityFromRecall(
    { name: "Band", category: "arts-music-theater", stillDoing: true },
    2028,
    now,
  );
  journal = upsertActivity(journal, activity);
  journal = applyRecallSpan(
    journal,
    activity.id,
    2028,
    { sinceGrade: 6, stillDoing: true },
    now,
  );
  const first = journal.activities[0]!;
  assert.equal(first.periods.length, 6);
  assert.equal(first.ongoing, true);
  assert.deepEqual(
    first.periods.map((p) => p.grade),
    ["6", "7", "8", "9", "10", "11"],
  );
  journal = applyRecallSpan(
    journal,
    activity.id,
    2028,
    { sinceGrade: 6, untilGrade: 9, stillDoing: false },
    now,
  );
  const stopped = journal.activities[0]!;
  assert.equal(stopped.periods.length, 4);
  assert.equal(stopped.ongoing, false);
  assert.deepEqual(
    stopped.periods.map((p) => p.grade),
    ["6", "7", "8", "9"],
  );
  assert.equal(stopped.periods.every((p) => p.status === "completed"), true);
});

test("removeActivity hard-deletes and restoreActivity unarchives", () => {
  let journal = emptyJournal();
  const keep = createActivity({ name: "Band", category: "arts-music-theater" });
  const drop = createActivity({ name: "Temp", category: "other" });
  journal = upsertActivity(journal, keep);
  journal = upsertActivity(journal, drop);
  journal = removeActivity(journal, drop.id);
  assert.equal(journal.activities.length, 1);
  assert.equal(journal.activities[0]!.id, keep.id);

  journal = archiveActivity(journal, keep.id);
  assert.equal(journal.activities[0]!.archived, true);
  journal = restoreActivity(journal, keep.id);
  assert.equal(journal.activities[0]!.archived, false);
});

test("gradeCells uses strongest state and ignores post and other", () => {
  const stamp = "2026-10-03T00:00:00.000Z";
  const activity = createActivity({ name: "Robotics", category: "school-club" });
  activity.periods = [
    {
      id: "p1",
      schoolYear: "2024–25",
      grade: "10",
      periodKind: "school_year",
      status: "planned",
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: "p2",
      schoolYear: "2024–25",
      grade: "10",
      periodKind: "summer",
      status: "completed",
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: "p3",
      schoolYear: "2025–26",
      grade: "11",
      periodKind: "school_year",
      status: "in_progress",
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: "p4",
      schoolYear: "2026–27",
      grade: "post",
      periodKind: "custom",
      status: "completed",
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: "p5",
      schoolYear: "2023–24",
      grade: "other",
      periodKind: "custom",
      status: "completed",
      createdAt: stamp,
      updatedAt: stamp,
    },
  ];
  const cells = gradeCells(activity);
  assert.equal(cells[10], "completed");
  assert.equal(cells[11], "in_progress");
  assert.equal(Object.keys(cells).length, 2);
});

test("recordSpanText still doing, stopped span, one year, and no periods", () => {
  const now = new Date(2026, 9, 3);
  const trumpet = activityFromRecall(
    { name: "Trumpet", category: "arts-music-theater", sinceGrade: 6, stillDoing: true },
    2028,
    now,
  );
  assert.equal(recordSpanText(trumpet, 11), "Since 6th grade · still doing it");

  const camp = activityFromRecall(
    {
      name: "Summer camp",
      category: "academic-enrichment",
      sinceGrade: 9,
      untilGrade: 10,
      stillDoing: false,
    },
    2028,
    now,
  );
  assert.equal(recordSpanText(camp, 11), "9th to 10th grade");

  const job = activityFromRecall(
    {
      name: "Cafe",
      category: "paid-work",
      sinceGrade: 10,
      untilGrade: 10,
      stillDoing: false,
    },
    2028,
    now,
  );
  assert.equal(recordSpanText(job, 11), "10th grade");

  const blank = createActivity({ name: "Taekwondo", category: "other" });
  assert.equal(recordSpanText(blank, 11), "Start grade not set");
});

test("recordSummary one longest, two tied, three tied, and no grades", () => {
  const now = new Date(2026, 9, 3);
  const trumpet = activityFromRecall(
    { name: "Trumpet", category: "arts-music-theater", sinceGrade: 6, stillDoing: true },
    2028,
    now,
  );
  const band = activityFromRecall(
    { name: "Band", category: "arts-music-theater", sinceGrade: 6, stillDoing: true },
    2028,
    now,
  );
  const marching = activityFromRecall(
    { name: "Marching band", category: "arts-music-theater", sinceGrade: 6, stillDoing: true },
    2028,
    now,
  );
  const robotics = activityFromRecall(
    { name: "Robotics club", category: "school-club", sinceGrade: 8, stillDoing: true },
    2028,
    now,
  );
  const blank = createActivity({ name: "Taekwondo", category: "other" });

  let journal = emptyJournal();
  journal = upsertActivity(journal, trumpet);
  journal = upsertActivity(journal, robotics);
  journal = upsertActivity(journal, blank);
  assert.equal(
    recordSummary(journal, 11),
    "3 activities. Your longest is Trumpet, at 6 school years.",
  );

  journal = upsertActivity(journal, band);
  assert.equal(
    recordSummary(journal, 11),
    "4 activities. Your longest are Band and Trumpet, at 6 school years each.",
  );

  journal = upsertActivity(journal, marching);
  assert.equal(
    recordSummary(journal, 11),
    "5 activities. Your longest are Band and Marching band, and 1 more, at 6 school years each.",
  );

  journal = emptyJournal();
  journal = upsertActivity(journal, blank);
  journal = upsertActivity(journal, createActivity({ name: "Chess", category: "hobby-personal-pursuit" }));
  assert.equal(recordSummary(journal, 11), "2 activities.");
});
