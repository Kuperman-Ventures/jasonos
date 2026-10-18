import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMeetingPointsUserMessage,
  clampDetail,
  coveredTally,
  draftContextLines,
  fillScriptPlaceholders,
  fillStrategySettings,
  firstOpenIndex,
  formatElapsed,
  markableIndexAt,
  meetingPointsSystemPrompt,
  moveMarkableIndex,
  newDrafts,
  nextOpenIndex,
  parseDraftPoints,
} from "./points.ts";

const sample = [
  { kind: "agenda", state: "open" },
  { kind: "point", state: "open" },
  { kind: "question", state: "covered" },
  { kind: "agenda", state: "open" },
  { kind: "ask", state: "open" },
];

describe("parseDraftPoints", () => {
  it("reads a fenced JSON array and clamps a long headline", () => {
    const headline = `Say the quiet part ${"out loud ".repeat(20)}`;
    const parsed = parseDraftPoints(
      "```json\n" +
        JSON.stringify([
          { kind: "agenda", headline: "Open", detail: "Start with why we are here." },
          { kind: "point", headline, detail: "" },
          { kind: "nope", headline: "Skip me", detail: null },
        ]) +
        "\n```"
    );
    assert.ok(parsed);
    assert.equal(parsed!.length, 2);
    assert.equal(parsed![0].kind, "agenda");
    assert.equal(parsed![0].detail, "Start with why we are here.");
    assert.equal(parsed![1].headline.length <= 80, true);
    assert.equal(parsed![1].detail, null);
  });

  it("returns null when the model does not return JSON", () => {
    assert.equal(parseDraftPoints("Here are some ideas."), null);
    assert.equal(parseDraftPoints("[]"), null);
  });
});

describe("newDrafts", () => {
  it("skips headlines Jason already has, ignoring case and space", () => {
    const added = newDrafts(
      ["  Open ", "The ask"],
      [
        { kind: "agenda", headline: "open", detail: null },
        { kind: "ask", headline: "The Ask", detail: null },
        { kind: "question", headline: "Who owns the pilot?", detail: "Get a name." },
      ]
    );
    assert.deepEqual(
      added.map((item) => item.headline),
      ["Who owns the pilot?"]
    );
  });
});

describe("live navigation", () => {
  it("counts covered markable items and skips agenda rows", () => {
    assert.deepEqual(coveredTally(sample), { covered: 1, total: 3 });
    assert.equal(firstOpenIndex(sample), 1);
    assert.equal(nextOpenIndex(sample, 1), 4);
    assert.equal(nextOpenIndex([{ kind: "point", state: "covered" }], 0), -1);
    assert.equal(nextOpenIndex(sample, 4), 1);
  });

  it("moves and jumps only among markable items", () => {
    assert.equal(moveMarkableIndex(sample, 1, 1), 2);
    assert.equal(moveMarkableIndex(sample, 4, 1), 1);
    assert.equal(moveMarkableIndex(sample, 1, -1), 4);
    assert.equal(markableIndexAt(sample, 1), 1);
    assert.equal(markableIndexAt(sample, 3), 4);
    assert.equal(markableIndexAt(sample, 9), -1);
  });

  it("formats the call clock as minutes and seconds", () => {
    assert.equal(formatElapsed(0), "00:00");
    assert.equal(formatElapsed(65), "01:05");
    assert.equal(formatElapsed(3599), "59:59");
    assert.equal(formatElapsed(3600), "60:00");
  });
});

describe("clampDetail", () => {
  it("keeps line breaks and drops extra blank lines", () => {
    assert.equal(clampDetail("  First line.  \n\n\nSecond line.  "), "First line.\n\nSecond line.");
  });
});

describe("fillScriptPlaceholders", () => {
  it("fills tokens from the first person and leaves the rest written out", () => {
    assert.equal(
      fillScriptPlaceholders("Ask {{ name }} at {{company}} about the {{title}} role", {
        name: "Alex Chen",
        company: "Northwind",
        title: null,
      }),
      "Ask Alex Chen at Northwind about the {{title}} role"
    );
    assert.equal(fillScriptPlaceholders("Hi {{company}}", null), "Hi {{company}}");
    assert.equal(fillScriptPlaceholders(null, { name: "Alex" }), null);
  });
});

describe("fillStrategySettings", () => {
  it("joins target companies and leaves an empty snapshot token in place", () => {
    assert.equal(
      fillStrategySettings("{{snapshot}} Target companies: {{targets}}.", {
        targetCompanies: ["OUTFRONT", "Omnicom"],
        snapshot: "I run marketing.",
      }),
      "I run marketing. Target companies: OUTFRONT, Omnicom."
    );
    assert.equal(
      fillStrategySettings("{{targets}}. Who do you know?", {
        targetCompanies: [],
        snapshot: null,
      }),
      "{{targets}}. Who do you know?"
    );
  });
});

describe("draft prompt", () => {
  it("labels open commitments, keeps four earlier meetings, and says when a field is empty", () => {
    const message = buildMeetingPointsUserMessage({
      title: "Pilot check-in",
      attendees: [{ name: "Alex Chen", title: "VP Sales", company: "Northwind" }],
      purpose: "Leave with a yes on the pilot.",
      outcomeSentence: null,
      summary: "They asked for a scoped pilot.",
      nextMove: "Send the one-pager.",
      openCommitments: [
        { text: "Send the deck", direction: "theirs", due: "March 3", personName: "Alex Chen" },
        { text: "Make the intro", direction: "mine", due: null, personName: "Alex Chen" },
      ],
      topics: ["pilot scope"],
      whereItStands: "Waiting on their security review.",
      yourStake: "Jason wants the pilot started this month.",
      introduction: null,
      referrer: null,
      personalGoal: "Wants a board seat.",
      projectGoal: null,
      relationshipGoal: "Wants a board seat.",
      lastNextStep: null,
      granolaSummaries: [],
      pastMeetings: [
        { title: "Newest", debriefNotes: "They liked the demo.", nextStep: "Send pricing." },
        { title: "Second", debriefNotes: "Agreed to regroup.", nextStep: null },
        { title: "Third", debriefNotes: "Talked scope.", nextStep: null },
        { title: "Fourth", debriefNotes: "Still in.", nextStep: null },
        { title: "Oldest", debriefNotes: "Should not be included.", nextStep: "Ignore." },
      ],
      jobSearch: [],
    });
    assert.match(message, /What Jason wants out of this: Leave with a yes on the pilot\./);
    assert.match(message, /Outcome sentence: None on file/);
    assert.match(message, /Referrer: None on file/);
    assert.match(message, /Personal goal: Wants a board seat\./);
    assert.match(message, /Project goal: None on file/);
    assert.match(message, /Goal for this relationship: Wants a board seat\./);
    assert.match(message, /theirs \(Alex Chen, due March 3\): Send the deck/);
    assert.match(message, /his \(Alex Chen\): Make the intro/);
    assert.match(message, /Newest/);
    assert.match(message, /Fourth/);
    assert.equal(message.includes("Oldest"), false);
    assert.match(message, /Granola notes: None on file/);
    assert.match(message, /Job search: None on file/);
    const system = meetingPointsSystemPrompt("NO AI SLOP");
    assert.match(system, /sourceHint/);
    assert.match(system, /Return JSON only/);
    assert.match(system, /NO AI SLOP/);
  });
});

describe("draftContextLines", () => {
  it("splits what was on file from what was missing", () => {
    const lines = draftContextLines({
      purpose: "Leave with a yes.",
      outcomeSentence: null,
      relationshipBrief: "They asked for a pilot.",
      openCommitments: 0,
      referrer: null,
      personalGoal: null,
      projectGoal: null,
      relationshipGoal: null,
      granolaNotes: 2,
      earlierMeetings: 1,
      jobSearch: 0,
    });
    assert.deepEqual(lines.contextUsed, [
      "Purpose",
      "Relationship brief",
      "Granola notes (2)",
      "Earlier meetings (1)",
    ]);
    assert.deepEqual(lines.contextMissing, [
      "Outcome sentence",
      "Open commitments",
      "Referrer",
      "Personal goal",
      "Project goal",
      "Goal for this relationship",
      "Job search",
    ]);
  });
});
