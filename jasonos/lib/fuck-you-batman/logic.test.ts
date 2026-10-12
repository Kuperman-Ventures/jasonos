import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSnapshotMarkdown, parseDecisionInput, parseEntryInput } from "./logic.ts";
import type { FybDecision, FybEntry } from "./types.ts";

const decision = {
  decision_key: "ending",
  week: 1,
  phase: 2,
  question: "How does the book end?",
  context: "This locks the hidden purpose.",
  options: [
    {
      key: "hero-wins",
      label: "The hero wins",
      summary: "He beats the computer.",
      strengths: ["Clear"],
      holes: ["Too neat"],
    },
    {
      key: "both-lose",
      label: "Both lose",
      summary: "Nobody gets what they wanted.",
      strengths: ["Bleak"],
      holes: ["Unsatisfying"],
    },
  ],
};

const entry = {
  kind: "reference",
  entry_key: "style-profile",
  title: "Style Profile",
  body_md: "Short sentences. No throat-clearing.",
  data: { source: "calibration" },
  links: ["reference:ai-tells"],
};

describe("parseDecisionInput", () => {
  it("accepts a valid decision object and JSON string", () => {
    const fromObject = parseDecisionInput(decision);
    assert.equal(fromObject.decision_key, "ending");
    assert.equal(fromObject.options.length, 2);
    assert.equal(fromObject.options[0].key, "hero-wins");
    const fromJson = parseDecisionInput(JSON.stringify(decision));
    assert.equal(fromJson.question, fromObject.question);
  });

  it("explains missing fields", () => {
    assert.throws(() => parseDecisionInput({ week: 1, phase: 2, question: "x" }), /decision_key/);
    assert.throws(() => parseDecisionInput({ decision_key: "ending", week: 1, phase: 2 }), /Question is required/);
    assert.throws(() => parseDecisionInput("not json"), /not valid JSON/);
    assert.throws(() => parseDecisionInput("   "), /empty/);
  });

  it("rejects a custom answer without text", () => {
    assert.throws(
      () => parseDecisionInput({ ...decision, chosen_option_key: "custom" }),
      /Write your own answer/
    );
    const ok = parseDecisionInput({
      ...decision,
      chosen_option_key: "custom",
      custom_answer: "The computer was right.",
    });
    assert.equal(ok.custom_answer, "The computer was right.");
  });
});

describe("parseEntryInput", () => {
  it("accepts a valid entry and fills defaults", () => {
    const parsed = parseEntryInput(entry);
    assert.equal(parsed.kind, "reference");
    assert.equal(parsed.title, "Style Profile");
    assert.deepEqual(parsed.links, ["reference:ai-tells"]);
  });

  it("explains missing fields and unknown kinds", () => {
    assert.throws(() => parseEntryInput({ kind: "reference", entry_key: "x" }), /Title is required/);
    assert.throws(() => parseEntryInput({ kind: "outline", entry_key: "x", title: "Nope" }), /kind/);
    assert.throws(() => parseEntryInput(""), /empty/);
  });
});

describe("buildSnapshotMarkdown", () => {
  it("lists decided answers, open questions, and entries by kind", () => {
    const decided: FybDecision = {
      id: "1",
      decision_key: "ending",
      week: 1,
      phase: 2,
      question: "How does the book end?",
      context: null,
      options: [{ key: "both-lose", label: "Both lose", summary: "", strengths: [], holes: [] }],
      status: "decided",
      chosen_option_key: "both-lose",
      custom_answer: null,
      jason_note: "Keep it bitter.",
      decided_at: "2026-10-12T16:00:00.000Z",
      decided_by: "jasonos",
      sort_order: 0,
      created_at: "",
      updated_at: "",
    };
    const open: FybDecision = {
      ...decided,
      id: "2",
      decision_key: "hidden-purpose",
      question: "What is the hidden purpose?",
      status: "open",
      chosen_option_key: null,
      jason_note: null,
      decided_at: null,
    };
    const custom: FybDecision = {
      ...decided,
      id: "3",
      decision_key: "tense",
      question: "Past or present?",
      status: "decided",
      chosen_option_key: "custom",
      custom_answer: "Present, until the drift.",
      jason_note: null,
      decided_at: "2026-10-13T16:00:00.000Z",
    };
    const ref: FybEntry = {
      id: "e1",
      kind: "reference",
      entry_key: "style-profile",
      title: "Style Profile",
      body_md: "Voice notes.",
      data: {},
      links: [],
      status: "approved",
      approved_at: "2026-10-10T00:00:00.000Z",
      sort_order: 0,
      updated_by: "claude",
      created_at: "",
      updated_at: "",
    };
    const md = buildSnapshotMarkdown([open, decided, custom], [ref]);
    assert.match(md, /## Decisions made/);
    assert.match(md, /How does the book end\?/);
    assert.match(md, /\*\*Answer:\*\* Both lose/);
    assert.match(md, /Keep it bitter/);
    assert.match(md, /Present, until the drift/);
    assert.match(md, /## Open decisions/);
    assert.match(md, /hidden-purpose/);
    assert.match(md, /## Reference/);
    assert.match(md, /Style Profile \(approved\)/);
    assert.match(md, /Voice notes/);
  });
});
