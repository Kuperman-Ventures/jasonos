import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CallSheetBlock } from "./call-sheet.ts";
import {
  budgetProgress,
  budgetSegments,
  buildLiveSheet,
  helpThemLine,
  isSheetStep,
  liveSteps,
  reactionsFromObjections,
  referenceItems,
  topicFor,
} from "./live-sheet.ts";
import { REACTION_SHAPES } from "./reactions.ts";

function block(partial: Partial<CallSheetBlock> & Pick<CallSheetBlock, "key" | "kind">): CallSheetBlock {
  return {
    id: partial.key,
    position: 0,
    title: partial.key,
    required: false,
    body: null,
    lines: [],
    rule: null,
    confirmedAt: null,
    updatedAt: "2026-10-23T00:00:00Z",
    ...partial,
  };
}

const BLOCKS: CallSheetBlock[] = [
  block({ key: "who", kind: "text", title: "Who", body: "Molly runs partnerships." }),
  block({ key: "why", kind: "lines", title: "Why", lines: [{ label: "Why this person", text: "She knows agencies", sourceHint: null }] }),
  block({
    key: "what_how",
    kind: "lines",
    title: "What and how",
    lines: [
      { label: "What I hope to learn", text: "", sourceHint: null },
      { label: "How I can help them", text: "I know two agency CMOs.", sourceHint: null },
    ],
  }),
  block({ key: "expectations", kind: "text", title: "Set expectations", body: "Twenty minutes." }),
  block({ key: "conversation", kind: "points", title: "The conversation" }),
  block({ key: "turn_to_me", kind: "lines", title: "Turn to me" }),
  block({
    key: "ask",
    kind: "ask",
    title: "The ask",
    body: null,
    lines: [{ label: "Soft ask", text: "Who should I put on my radar?", sourceHint: null }],
  }),
  block({ key: "close", kind: "text", title: "Close", body: "Two weeks from today?" }),
  block({ key: "after", kind: "after", title: "After", body: "Thank you for the time today." }),
];

describe("budget", () => {
  const segments = budgetSegments({ expectations: 2, rapport: 5, main: 20, close: 3 });

  it("keeps the budget order and drops empty parts", () => {
    assert.deepEqual(
      segments.map((segment) => [segment.label, segment.minutes]),
      [
        ["Expectations", 2],
        ["Rapport", 5],
        ["Conversation", 20],
        ["Close", 3],
      ]
    );
    assert.deepEqual(budgetSegments({ main: 20 }).map((segment) => segment.key), ["main"]);
    assert.deepEqual(budgetSegments(null), []);
  });

  it("finds the current segment and how far into it", () => {
    assert.deepEqual(budgetProgress(segments, 60), { index: 0, fraction: 0.5, overMinutes: 0, totalMinutes: 30 });
    const main = budgetProgress(segments, 17 * 60);
    assert.equal(main.index, 2);
    assert.equal(main.fraction, 0.5);
    assert.deepEqual(budgetProgress(segments, 34 * 60), { index: 4, fraction: 1, overMinutes: 4, totalMinutes: 30 });
  });
});

describe("liveSteps", () => {
  it("adds the ask and close after the conversation", () => {
    const { steps, thenIds } = liveSteps([], BLOCKS, []);
    assert.deepEqual(thenIds, ["sheet:ask", "sheet:close"]);
    assert.equal(steps[0].kind, "ask");
    assert.equal(steps[0].detail, "Soft ask: Who should I put on my radar?");
    assert.equal(steps[1].detail, "Two weeks from today?");
    assert.ok(isSheetStep(steps[0].id));
    assert.ok(!isSheetStep("8f0e"));
  });

  it("gives the ask a reaction tray only when all six shapes have a pivot", () => {
    const full = REACTION_SHAPES.map((shape) => ({ shape, soundsLike: `says ${shape}`, pivot: `pivot ${shape}` }));
    assert.equal(reactionsFromObjections(full).length, 6);
    assert.equal(reactionsFromObjections([...full, ...full]).length, 6);
    assert.equal(reactionsFromObjections(full.slice(1)).length, 0);
  });
});

describe("reference and help", () => {
  it("shows Who, Why, What and how, Turn to me on Live with words only", () => {
    assert.deepEqual(
      referenceItems(BLOCKS, "live").map((item) => item.key),
      ["who", "why", "what_how"]
    );
    assert.deepEqual(
      referenceItems(BLOCKS, "rehearse").map((item) => item.key),
      ["who", "why", "what_how", "expectations", "ask", "close"]
    );
  });

  it("pins How I can help them", () => {
    assert.equal(helpThemLine(BLOCKS), "I know two agency CMOs.");
  });

  it("builds the Live feed from the sheet", () => {
    const { steps, feed } = buildLiveSheet({
      blocks: BLOCKS,
      playbook: {
        name: "",
        family: "net102_first",
        timeBudget: { expectations: 2, rapport: 5, main: 20, close: 3 },
        objections: [],
      },
      touchNumber: 1,
      personName: "Molly Ramos",
      points: [],
      mode: "live",
    });
    assert.deepEqual(steps.map((step) => step.id), ["sheet:ask", "sheet:close"]);
    assert.equal(feed.personName, "Molly Ramos");
    assert.ok(feed.playbookName);
    assert.equal(feed.budget.length, 4);
    assert.deepEqual(feed.thenIds, ["sheet:ask", "sheet:close"]);
    assert.equal(feed.helpThem, "I know two agency CMOs.");
  });

  it("finds the agenda topic above a point", () => {
    const points = [
      { id: "a", kind: "agenda" as const, headline: "The four topics" },
      { id: "1", kind: "question" as const, headline: "Q" },
    ];
    assert.equal(topicFor(points, "1"), "The four topics");
    assert.equal(topicFor(points, "a"), null);
  });
});
