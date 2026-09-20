import assert from "node:assert/strict";
import test from "node:test";
import {
  appendIngestNotes,
  formatIngestNotesBlock,
  heuristicSuggestions,
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
  assert.ok(suggestions.length >= 3);
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

test("normalizePersistedSteps keeps valid rows only", () => {
  const steps = normalizePersistedSteps([
    {
      id: "ing-1",
      label: "Email counselor",
      owner: "jason",
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
