import assert from "node:assert/strict";
import test from "node:test";
import { createActivity, emptyJournal, normalizeJournal } from "./activities-journal";
import {
  activityStates,
  applyTrackToJournal,
  cellStyle,
  copyTrackNotes,
  emptyTrack,
  mergeStates,
  migrateTrackFromJournal,
  nextBand,
  normalizeTrack,
  nudgeFor,
  questionsFor,
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
  assert.deepEqual(activityStates(a, steps, { "a1:12": "up" }, 11), ["d", "d", "d", "d", "d", "n", "p"]);
});

test("activityStates: finish in 12 leaves senior year empty", () => {
  const a = act({ name: "Trumpet", start: 9, still: true, end: 11 });
  assert.deepEqual(activityStates(a, [], { "a1:12": "finish" }, 11), ["e", "e", "e", "d", "d", "n", "e"]);
});

test("activityStates: stopped activity has no now or planned cells", () => {
  const a = act({ name: "Soccer", start: 6, still: false, end: 8 });
  assert.deepEqual(activityStates(a, [], {}, 11), ["d", "d", "d", "e", "e", "e", "e"]);
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
  assert.equal(yearsInStates(["d", "d", "d", "d", "d", "n", "p"]), 6);
  assert.equal(yearsInStates(["e", "e", "e", "d", "d", "n", "e"]), 3);
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
    act({ name: "Trumpet", role: "First chair", org: "Band", desc: "Practice daily" }),
  ]);
  assert.match(text, /Trumpet/);
  assert.match(text, /Practice daily/);
  assert.doesNotMatch(text, /suggested|draft|score/i);
});
