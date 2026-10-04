import assert from "node:assert/strict";
import test from "node:test";
import { createActivity, emptyJournal, normalizeJournal } from "./activities-journal";
import {
  activityStates,
  activityYears,
  applyTrackToJournal,
  cellStyle,
  copyTrackNotes,
  emptyTrack,
  gradeName,
  gridStates,
  mergeStates,
  migrateTrackFromJournal,
  nextBand,
  normalizeTrack,
  nudgeFor,
  questionsFor,
  rebuildPeriodsForSpan,
  threadLengthBar,
  yearsInStates,
  type TrackActivity,
  type TrackPlanStep,
} from "./activities-track";

function act(partial: Partial<TrackActivity> & { name: string }): TrackActivity {
  return {
    id: partial.id ?? "a1",
    name: partial.name,
    thread: partial.thread ?? null,
    start: partial.start ?? 9,
    still: partial.still ?? true,
    end: partial.end ?? 11,
    type: partial.type ?? "other",
    answers: partial.answers ?? {},
    role: partial.role ?? "",
    org: partial.org ?? "",
    desc: partial.desc ?? "",
    hours: partial.hours ?? "",
    weeks: partial.weeks ?? "",
    college: partial.college ?? "",
    status: partial.status ?? "draft",
    ...(partial.icon ? { icon: partial.icon } : {}),
  };
}

test("activityStates: still doing fills past done, now, and planned 12", () => {
  const a = act({ name: "Trumpet", start: 6, still: true, end: 11 });
  const steps: TrackPlanStep[] = [{ id: "p1", actId: "a1", year: 12, lens: "deeper", text: "All-State" }];
  assert.deepEqual(activityStates(a, steps, { "a1:12": "up" }, 11), ["e", "d", "d", "d", "d", "d", "n", "p"]);
});

test("activityStates: finish in 12 leaves senior year empty", () => {
  const a = act({ name: "Trumpet", start: 9, still: true, end: 11 });
  assert.deepEqual(activityStates(a, [], { "a1:12": "finish" }, 11), ["e", "e", "e", "e", "d", "d", "n", "e"]);
});

test("activityStates: stopped activity has no now or planned cells", () => {
  const a = act({ name: "Soccer", start: 6, still: false, end: 8 });
  assert.deepEqual(activityStates(a, [], {}, 11), ["e", "d", "d", "d", "e", "e", "e", "e"]);
});

test("activityStates marks the Earlier cell done when start is before 6th", () => {
  const a = act({ name: "Piano", start: 2, still: true, end: 11 });
  assert.equal(activityStates(a, [], {}, 11)[0], "d");
  assert.deepEqual(gridStates(activityStates(a, [], {}, 11), false)[0], "d");
});

test("mergeStates prefers now over done over planned over empty", () => {
  assert.deepEqual(
    mergeStates([
      ["e", "d", "e", "e", "e", "e", "p"],
      ["e", "e", "e", "e", "e", "n", "e"],
    ]),
    ["e", "d", "e", "e", "e", "n", "p"],
  );
});

test("yearsInStates counts done and now only", () => {
  assert.equal(yearsInStates(["e", "d", "d", "d", "d", "d", "n", "p"]), 6);
  assert.equal(yearsInStates(["e", "e", "e", "e", "d", "d", "n", "e"]), 3);
});

test("threadLengthBar spans the longest activity's done/now cells", () => {
  const bar = threadLengthBar(["d", "d", "d", "d", "d", "n", "p"]);
  assert.equal(bar.left, 0);
  assert.equal(bar.width, 6 * 59 - 3);
  assert.equal(bar.years, 6);
  const late = threadLengthBar(["e", "e", "e", "d", "d", "n", "e"]);
  assert.equal(late.left, 3 * 59);
  assert.equal(late.width, 3 * 59 - 3);
  assert.equal(late.years, 3);
});

test("threadLengthBar spans from the Earlier column when the activity starts early", () => {
  const a = act({ name: "Piano", start: 2, still: true, end: 11 });
  const st = activityStates(a, [], { "a1:12": "up" }, 11);
  assert.equal(st.length, 8);
  assert.equal(st[0], "d");
  const bar = threadLengthBar(st);
  assert.equal(bar.left, 0);
  assert.equal(bar.width, 56 + 6 + 6 * 59 - 3);
});

test("planned cells are hatched, not the same fill as done or now", () => {
  const p = cellStyle("p");
  const d = cellStyle("d");
  const n = cellStyle("n");
  assert.match(p.background, /repeating-linear-gradient/);
  assert.match(p.border, /dashed/);
  assert.equal(d.background, "var(--color-accent-tint-2)");
  assert.equal(n.background, "var(--color-accent)");
  assert.notEqual(p.background, d.background);
  assert.notEqual(p.background, n.background);
});

test("nudgeFor fires once-style rules without suggesting sentences", () => {
  const q = { layer: "What you do", id: "week", q: "Walk through a typical week.", ex: "Rehearse." };
  assert.equal(nudgeFor(q, "We run the meeting every week together"), "What was your part?");
  assert.equal(nudgeFor(q, "I am passionate about this"), "What is a specific example?");
  assert.equal(
    nudgeFor({ ...q, layer: "What changed", id: "diff" }, "Things got better"),
    "Any numbers? A placement, a count, a score, a time.",
  );
  assert.equal(nudgeFor(q, "I help"), "Can you say more? What did that look like?");
  assert.equal(nudgeFor({ ...q, id: "nums" }, "I help"), null);
  assert.equal(nudgeFor(q, ""), null);
});

test("questionsFor adds Growth at 2+ years and m2 at 3+ years", () => {
  const one = questionsFor(act({ name: "Job", start: 11, still: true, end: 11 }), 11);
  assert.equal(one.some((q) => q.layer === "Growth"), false);
  assert.equal(one.some((q) => q.id === "m2"), false);
  const two = questionsFor(act({ name: "Job", start: 10, still: true, end: 11 }), 11);
  assert.equal(two.filter((q) => q.layer === "Growth").length, 4);
  assert.equal(two.some((q) => q.id === "m2"), false);
  const three = questionsFor(act({ name: "Job", start: 9, still: true, end: 11 }), 11);
  assert.equal(three.some((q) => q.id === "m2"), true);
});

test("nextBand follows Shape, rest of high school, project, Prep, then done", () => {
  const loose = { ...emptyTrack(), acts: [act({ name: "Tutoring", thread: null })] };
  assert.equal(nextBand(loose).go, "shape");
  const threaded = {
    ...emptyTrack(),
    acts: [act({ name: "Band", thread: "music" })],
    threads: [{ id: "music", name: "Music" }],
  };
  assert.equal(nextBand(threaded).go, "rest");
  const rest = { ...threaded, intents: { "a1:11": "keep" as const } };
  assert.equal(nextBand(rest).go, "project");
  const withIdea = {
    ...rest,
    projects: [{ id: "j1", title: "Teach", partner: "", outcome: "", when: "" as const, why: "" }],
  };
  assert.equal(nextBand(withIdea).go, "prep");
  const ready = {
    ...withIdea,
    acts: [{ ...withIdea.acts[0]!, status: "ready" as const }],
  };
  assert.equal(nextBand(ready).go, "copy");
});

test("migrateTrackFromJournal copies live activities and keeps an existing track", () => {
  const created = createActivity({ name: "Robotics Club", category: "school-club", ongoing: true });
  created.threadId = "eng";
  created.reflections = { whyMatters: "I like building" };
  const journal = {
    ...emptyJournal(),
    activities: [created],
    threads: [{ id: "eng", name: "Engineering", createdAt: "t", updatedAt: "t" }],
  };
  const migrated = migrateTrackFromJournal(journal, 11);
  assert.equal(migrated.acts.length, 1);
  assert.equal(migrated.acts[0]!.name, "Robotics Club");
  assert.equal(migrated.acts[0]!.thread, "eng");
  assert.equal(migrated.acts[0]!.answers.m1, "I like building");
  const kept = migrateTrackFromJournal({ ...journal, track: migrated }, 11);
  assert.equal(kept.acts[0]!.answers.m1, "I like building");
});

test("applyTrackToJournal dual-writes names and threads without dropping other activities", () => {
  const existing = createActivity({ name: "Old name", category: "other", ongoing: true });
  const extra = createActivity({ name: "Keep me", category: "other", ongoing: false });
  const journal = { ...emptyJournal(), activities: [existing, extra], profile: { classOf: 2028 } };
  const track = {
    ...emptyTrack(),
    threads: [{ id: "music", name: "Music" }],
    acts: [act({ id: existing.id, name: "Trumpet", thread: "music", start: 6, still: true })],
  };
  const next = applyTrackToJournal(journal, track, 11);
  assert.equal(next.activities.find((a) => a.id === existing.id)?.name, "Trumpet");
  assert.equal(next.activities.find((a) => a.id === existing.id)?.threadId, "music");
  assert.equal(next.activities.find((a) => a.id === extra.id)?.name, "Keep me");
  assert.equal(next.threads?.[0]?.name, "Music");
  assert.equal((next.track as { acts: TrackActivity[] }).acts[0]!.name, "Trumpet");
});

test("normalizeJournal round-trips track and normalizeTrack drops nameless acts", () => {
  const track = {
    acts: [{ id: "a1", name: "Band", thread: null, start: 9, still: true, end: 11, type: "arts", answers: { week: "Rehearse" }, role: "", org: "", desc: "", hours: "6", weeks: "40", college: "", status: "draft" }],
    threads: [{ id: "music", name: "Music" }],
    plans: [],
    intents: { "a1:12": "up" },
    projects: [],
  };
  const stored = normalizeJournal({ activities: [], awards: [], applicationLists: [], track });
  assert.deepEqual(stored.track, track);
  const cleaned = normalizeTrack({ acts: [{ name: "" }, { name: "Ok", start: 9 }], threads: [{ name: "T" }] });
  assert.equal(cleaned.acts.length, 1);
  assert.equal(cleaned.acts[0]!.name, "Ok");
});

test("copyTrackNotes is the student's own words", () => {
  const text = copyTrackNotes([
    act({ name: "Trumpet", role: "First chair", org: "Band", desc: "Practice daily", start: 2 }),
  ]);
  assert.match(text, /Trumpet/);
  assert.match(text, /Practice daily/);
  assert.match(text, /Started: 2nd grade/);
  assert.doesNotMatch(text, /suggested|draft|score/i);
});

test("gradeName covers kindergarten and ordinals", () => {
  assert.equal(gradeName(0), "kindergarten");
  assert.equal(gradeName(1), "1st grade");
  assert.equal(gradeName(2), "2nd grade");
  assert.equal(gradeName(3), "3rd grade");
  assert.equal(gradeName(4), "4th grade");
  assert.equal(gradeName(11), "11th grade");
});

test("activityYears counts from the real start, not the grid cells", () => {
  assert.equal(activityYears(act({ name: "Piano", start: 2, still: true, end: 11 }), 11), 10);
  assert.equal(activityYears(act({ name: "Soccer", start: 6, still: false, end: 8 }), 11), 3);
});

test("normalizeTrack keeps start 0-5 and falls back to 9 for invalid values", () => {
  const early = normalizeTrack({ acts: [{ name: "Piano", start: 0, still: true }] }, 11);
  assert.equal(early.acts[0]!.start, 0);
  const fifth = normalizeTrack({ acts: [{ name: "Choir", start: 5, still: true }] }, 11);
  assert.equal(fifth.acts[0]!.start, 5);
  const bad = normalizeTrack({ acts: [{ name: "X", start: 15 }] }, 11);
  assert.equal(bad.acts[0]!.start, 9);
  const nan = normalizeTrack({ acts: [{ name: "Y", start: "nope" }] }, 11);
  assert.equal(nan.acts[0]!.start, 9);
});

test("applyTrackToJournal sets and clears earliestGrade and periods begin at 6th", () => {
  const existing = createActivity({ name: "Piano", category: "arts-music-theater", ongoing: true });
  const journal = { ...emptyJournal(), activities: [existing], profile: { classOf: 2028 } };
  const clock = new Date("2026-10-04T12:00:00Z");
  const early = applyTrackToJournal(
    journal,
    { ...emptyTrack(), acts: [act({ id: existing.id, name: "Piano", start: 2, still: true, end: 11 })] },
    11,
    clock,
  );
  const row = early.activities.find((a) => a.id === existing.id)!;
  assert.equal(row.earliestGrade, 2);
  assert.ok(row.periods.every((p) => p.grade === "post" || p.grade === "other" || Number(p.grade) >= 6));
  assert.equal(row.periods.some((p) => p.grade === "6"), true);
  const cleared = applyTrackToJournal(
    early,
    { ...emptyTrack(), acts: [act({ id: existing.id, name: "Piano", start: 9, still: true, end: 11 })] },
    11,
    clock,
  );
  assert.equal(cleared.activities.find((a) => a.id === existing.id)?.earliestGrade, undefined);
});

test("rebuildPeriodsForSpan keeps hours and role for grades that remain", () => {
  const activity = createActivity({
    name: "Band",
    category: "arts-music-theater",
    ongoing: true,
    periods: [
      {
        id: "p9",
        schoolYear: "2024–25",
        grade: "9",
        periodKind: "school_year",
        status: "completed",
        hoursPerWeek: 6,
        weeksActive: 36,
        role: "Section",
        createdAt: "t",
        updatedAt: "t",
      },
      {
        id: "p10",
        schoolYear: "2025–26",
        grade: "10",
        periodKind: "school_year",
        status: "completed",
        hoursPerWeek: 8,
        role: "Lead",
        createdAt: "t",
        updatedAt: "t",
      },
    ],
  });
  const next = rebuildPeriodsForSpan(
    activity,
    2028,
    { start: 2, still: true, end: 11 },
    new Date("2026-10-04T12:00:00Z"),
  );
  const g9 = next.find((p) => p.grade === "9");
  const g10 = next.find((p) => p.grade === "10");
  assert.equal(g9?.hoursPerWeek, 6);
  assert.equal(g9?.role, "Section");
  assert.equal(g10?.hoursPerWeek, 8);
  const grades = next.map((p) => p.grade);
  assert.equal(grades.includes("9"), true);
  assert.ok(grades.every((g) => g === "post" || g === "other" || Number(g) >= 6));
  const trimmed = rebuildPeriodsForSpan(
    activity,
    2028,
    { start: 11, still: true, end: 11 },
    new Date("2026-10-04T12:00:00Z"),
  );
  assert.equal(trimmed.some((p) => p.grade === "9"), false);
  assert.equal(trimmed.some((p) => p.grade === "11"), true);
});

test("migrateTrackFromJournal uses earliestGrade as start", () => {
  const created = createActivity({
    name: "Piano",
    category: "arts-music-theater",
    ongoing: true,
    earliestGrade: 3,
  });
  const journal = { ...emptyJournal(), activities: [created] };
  const migrated = migrateTrackFromJournal(journal, 11);
  assert.equal(migrated.acts[0]!.start, 3);
});
