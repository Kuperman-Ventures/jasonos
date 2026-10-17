import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceWeekly,
  clampBlurb,
  daysUntilDue,
  dueLabel,
  fallbackBlurb,
  includeOnNudgeTimeline,
  isCurrentWeekMilestone,
  nextFridayAt8,
  nudgeSubject,
  nudgeSummary,
  personWillReceive,
  recipientStatus,
  scheduleFromChoice,
  sendButtonLabel,
  stageFlagForRange,
  stillCurrentIds,
  weekRange,
  composeRecipientEmails,
  type NudgeCatalog,
} from "./nudge";

const TODAY = new Date("2026-10-17T15:00:00.000Z");

test("week of 17 Oct 2026 is Monday 12 through Sunday 18", () => {
  assert.deepEqual(weekRange(TODAY), { start: "2026-10-12", end: "2026-10-18" });
});

test("stage flags match the reminder handoff", () => {
  assert.deepEqual(
    stageFlagForRange({ start: "2026-09-15", end: "2026-11-30", isMilestone: false }, TODAY),
    { label: "Ends in 6 weeks", hot: false },
  );
  assert.deepEqual(
    stageFlagForRange({ start: "2026-10-14", end: "2026-10-14", isMilestone: true }, TODAY),
    { label: "This week", hot: true },
  );
  assert.deepEqual(
    stageFlagForRange({ start: "2026-10-10", end: "2026-11-30", isMilestone: false }, TODAY),
    { label: "Started", hot: false },
  );
  assert.deepEqual(
    stageFlagForRange({ start: "2026-09-21", end: "2027-03-31", isMilestone: false }, TODAY),
    { label: "Ongoing", hot: false },
  );
});

test("timeline list keeps current work and this week's milestone", () => {
  assert.equal(
    includeOnNudgeTimeline({ start: "2026-10-14", end: "2026-10-14", isMilestone: true, done: false }, TODAY),
    true,
  );
  assert.equal(isCurrentWeekMilestone({ start: "2026-10-14", end: "2026-10-14", isMilestone: true }, TODAY), true);
  assert.equal(
    includeOnNudgeTimeline({ start: "2028-01-01", end: "2028-01-01", isMilestone: true, done: false }, TODAY),
    false,
  );
  assert.equal(
    includeOnNudgeTimeline({ start: "2026-09-15", end: "2026-11-30", isMilestone: false, done: true }, TODAY),
    false,
  );
});

test("due labels and default window", () => {
  assert.equal(dueLabel(daysUntilDue("2026-10-05", TODAY)), "12 days overdue");
  assert.equal(dueLabel(daysUntilDue("2026-10-22", TODAY)), "Due in 5 days");
  assert.equal(dueLabel(daysUntilDue("2026-11-08", TODAY)), "Due later");
  assert.equal(dueLabel(null), "No date");
  assert.equal(daysUntilDue("2026-10-22", TODAY)! <= 7, true);
  assert.equal(daysUntilDue("2026-11-08", TODAY)! <= 7, false);
});

test("subject drops an empty half", () => {
  assert.equal(nudgeSubject(2, 3), "This week: 2 to-dos and 3 timeline stages");
  assert.equal(nudgeSubject(1, 0), "This week: 1 to-do");
  assert.equal(nudgeSubject(0, 1), "This week: 1 timeline stage");
});

test("summary and send labels", () => {
  assert.equal(nudgeSummary(0, 0, 0), "Select recipients and at least one item");
  assert.equal(nudgeSummary(2, 1, 3), "2 recipients · 1 timeline stage · 3 to-dos");
  assert.equal(sendButtonLabel("now", false), "Send");
  assert.equal(sendButtonLabel("fri", false), "Schedule");
  assert.equal(sendButtonLabel("weekly", true), "Scheduled ✓");
  assert.equal(recipientStatus(false, 2), "not sending");
  assert.equal(recipientStatus(true, 0), "timeline only");
  assert.equal(recipientStatus(true, 1), "1 to-do selected");
});

test("a recipient with nothing of their own is skipped when no stages are ticked", () => {
  assert.equal(personWillReceive(true, 0, 0), false);
  assert.equal(personWillReceive(true, 1, 0), true);
  assert.equal(personWillReceive(false, 2, 2), false);
});

test("Friday 8 am is the next Friday in New York", () => {
  const friday = nextFridayAt8(TODAY);
  assert.equal(friday.toISOString(), "2026-10-23T12:00:00.000Z");
  const earlyFriday = nextFridayAt8(new Date("2026-10-23T11:00:00.000Z"));
  assert.equal(earlyFriday.toISOString(), "2026-10-23T12:00:00.000Z");
  const after = nextFridayAt8(new Date("2026-10-23T13:00:00.000Z"));
  assert.equal(after.toISOString(), "2026-10-30T12:00:00.000Z");
});

test("schedule values", () => {
  assert.equal(scheduleFromChoice("now", TODAY), "now");
  assert.deepEqual(scheduleFromChoice("fri", TODAY), { at: "2026-10-23T12:00:00.000Z" });
  const weekly = scheduleFromChoice("weekly", TODAY);
  assert.equal(typeof weekly === "object" && "recurring" in weekly && weekly.day, "fri");
  if (typeof weekly === "object" && "recurring" in weekly) {
    const next = advanceWeekly(weekly, new Date("2026-10-23T12:05:00.000Z"));
    assert.equal("nextAt" in next && next.nextAt, "2026-10-30T12:00:00.000Z");
  }
});

test("blurbs stay one sentence without pressure marks", () => {
  assert.equal(clampBlurb("Keep going! You are close!! 🎉"), "Keep going. You are close.");
  const words = fallbackBlurb("Develop Your College List").split(/\s+/);
  assert.ok(words.length <= 25);
  assert.equal(fallbackBlurb("Develop Your College List").includes("!"), false);
});

test("recurring send drops items that are no longer open", () => {
  assert.deepEqual(stillCurrentIds(["a", "b", "c"], ["b"]), ["b"]);
});

test("each recipient gets only their to-dos plus the shared stages", () => {
  const catalog: NudgeCatalog = {
    people: [
      { id: "kyle", name: "Kyle", firstName: "Kyle", initials: "KY", email: "kyle@example.com", role: "student", avatarUrl: null, defaultOn: true },
      { id: "kat", name: "Kat", firstName: "Kat", initials: "KA", email: "kat@example.com", role: "parent", avatarUrl: null, defaultOn: true },
      { id: "jason", name: "Jason", firstName: "Jason", initials: "JA", email: null, role: "super_admin", avatarUrl: null, defaultOn: false },
    ],
    stages: [
      { id: "s1", title: "PSAT/NMSQT", sub: "Milestone · Oct 14 · Testing", flag: "This week", hot: true, defaultOn: true, blurb: "A calm practice run." },
    ],
    todos: [
      { id: "t1", ownerId: "kyle", title: "Develop Your College List", dateLabel: "Sep 12", dueLabel: "34 days overdue", daysUntil: -34, tone: "overdue", defaultOn: true, blurb: "A first draft is enough." },
      { id: "t2", ownerId: "kat", title: "Register Kyle for the next PSAT/NMSQT", dateLabel: "Oct 14", dueLabel: "3 days overdue", daysUntil: -3, tone: "overdue", defaultOn: true, blurb: "Registration is the step left." },
    ],
    noteDefault: "Note",
    trackerBase: "https://kyle-college.vercel.app",
  };
  const { emails, skipped } = composeRecipientEmails({
    recipients: ["kyle", "kat", "jason"],
    stageIds: ["s1", "gone"],
    todoIds: ["t1", "t2"],
    note: "Quick look.",
    catalog,
  });
  assert.equal(emails.length, 2);
  assert.deepEqual(
    skipped.map((row) => row.id),
    ["jason"],
  );
  const kyle = emails.find((row) => row.personId === "kyle")!;
  assert.equal(kyle.email.subject, "This week: 1 to-do and 1 timeline stage");
  assert.deepEqual(kyle.email.todos.map((row) => row.title), ["Develop Your College List"]);
  assert.equal(kyle.email.stages.length, 1);
  assert.equal(kyle.email.trackerUrl, "https://kyle-college.vercel.app/?tab=projects&pm=todos");
  assert.equal(emails.find((row) => row.personId === "kat")!.email.todos[0]?.title.includes("PSAT"), true);
});
