import assert from "node:assert/strict";
import test from "node:test";
import {
  appendIngestNotes,
  formatIngestNotesBlock,
  heuristicSuggestions,
  isActionableTodoLabel,
  isJunkTodoLabel,
  normalizeIngestSources,
  normalizePersistedSteps,
} from "./ingest";

test("heuristicSuggestions pulls actionable lines and assigns owners", () => {
  const text = `
College webinar notes
- Kyle should practice SAT reading every weeknight
- Kat can schedule the campus visit for October
- Follow up with counselor about transcript requests
https://example.com/ignore-me
Short
`;
  const suggestions = heuristicSuggestions(text);
  assert.ok(suggestions.length >= 2);
  assert.equal(
    suggestions.find((row) => /SAT/i.test(row.label))?.owner,
    "kyle",
  );
  assert.equal(
    suggestions.find((row) => /campus visit/i.test(row.label))?.owner,
    "kat",
  );
  assert.ok(suggestions.every((row) => row.route === "todo"));
  assert.ok(!suggestions.some((row) => /example.com/i.test(row.label)));
});

test("ingest ignores greetings, headers, and schedule blurbs that are not to-dos", () => {
  const email = `
Dear AP Students and Parents,

AP exam registration at Columbia High School requires two steps.
Both steps must be finished by October 31st without a late fee.

Students log into the College Board website using this school code.
STEP TWO: (Opens September 25th, 2026)
This is the link students can use to log into Total Registration.
AP Registration Timeline:
Sep 17, 2026 08:00 AM: Date and Time to begin registration
Oct 31, 2026 11:59 PM: LATE REGISTRATION FEE begins

Please register for AP exams on College Board by October 31.
Kyle should complete Total Registration once it opens September 25.
`;

  assert.equal(isJunkTodoLabel("Dear AP Students and Parents,"), true);
  assert.equal(isJunkTodoLabel("STEP TWO: (Opens September 25th, 2026)"), true);
  assert.equal(isJunkTodoLabel("AP Registration Timeline:"), true);
  assert.equal(isJunkTodoLabel("Sep 17, 2026 08:00 AM: Date and Time to begin registration"), true);
  assert.equal(isJunkTodoLabel("This is the link students can use to log into Total Registration."), true);
  assert.equal(isJunkTodoLabel("Students log into the College Board website using this school code."), true);
  assert.equal(isActionableTodoLabel("Please register for AP exams on College Board by October 31."), true);
  assert.equal(isActionableTodoLabel("Kyle should complete Total Registration once it opens September 25."), true);

  const suggestions = heuristicSuggestions(email);
  assert.ok(suggestions.length >= 1);
  assert.ok(suggestions.length <= 4);
  assert.ok(suggestions.every((row) => isActionableTodoLabel(row.label)));
  assert.ok(
    !suggestions.some((row) =>
      /Dear AP|STEP TWO|Timeline:|This is the link|Students log into/i.test(row.label),
    ),
  );
  assert.ok(suggestions.some((row) => /register/i.test(row.label)));
});

test("normalizePersistedSteps keeps valid rows only", () => {
  const steps = normalizePersistedSteps([
    {
      id: "ing-1",
      label: "Email counselor",
      owner: "jason",
      assignedBy: "kat",
      parentId: "inbox",
      dueDate: "2026-10-01",
      startDate: null,
      endDate: null,
      sourceId: "src-1",
      createdAt: "2026-09-20T12:00:00.000Z",
    },
    { id: 12, label: "bad" },
    null,
  ]);
  assert.equal(steps.length, 1);
  assert.equal(steps[0]?.owner, "jason");
  assert.equal(steps[0]?.assignedBy, "kat");
  assert.equal(steps[0]?.dueDate, "2026-10-01");
});

test("normalizeIngestSources maps history rows", () => {
  const sources = normalizeIngestSources([
    {
      id: "src-1",
      title: "Webinar",
      kind: "paste",
      excerpt: "notes",
      createdAt: "2026-09-20T12:00:00.000Z",
      stepCount: 3,
      noteCount: 2,
    },
    { title: "missing id" },
  ]);
  assert.equal(sources.length, 1);
  assert.equal(sources[0]?.stepCount, 3);
  assert.equal(sources[0]?.noteCount, 2);
});

test("formatIngestNotesBlock tags source and bullets notes", () => {
  const block = formatIngestNotesBlock({
    title: "Fall webinar",
    createdAt: "2026-09-20T12:00:00.000Z",
    notes: ["Ask about ED deadlines", "Campus culture felt strong"],
  });
  assert.match(block, /From Ingest · Fall webinar/);
  assert.match(block, /• Ask about ED deadlines/);
  assert.match(block, /• Campus culture felt strong/);
});

test("appendIngestNotes stacks blocks without wiping existing notes", () => {
  assert.equal(appendIngestNotes("", "fresh"), "fresh");
  assert.equal(appendIngestNotes("old", "fresh"), "old\n\nfresh");
});
