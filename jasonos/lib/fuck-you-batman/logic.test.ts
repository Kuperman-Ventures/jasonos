import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSnapshotMarkdown,
  driftChecks,
  outlineChecks,
  parseDecisionInput,
  parseEntryInput,
} from "./logic.ts";
import type { FybDecision, FybEntry, FybEntryKind } from "./types.ts";

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
    const ref: FybEntry = sampleEntry("reference", "style-profile", "Style Profile", {}, "approved");
    ref.body_md = "Voice notes.";
    ref.change_request = "Tighten the tells list.";
    const stage: FybEntry = sampleEntry("drift_stage", "stage-1", "Trust", {
      stage_number: 1,
      name: "Trust",
      chapter_from: 1,
      chapter_to: 3,
      reader_believes: "The computer is loyal.",
      actually_true: "It already has a purpose.",
    });
    const md = buildSnapshotMarkdown([open, decided, custom], [ref, stage]);
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
    assert.match(md, /Change request: Tighten the tells list/);
    assert.match(md, /Reader believes: The computer is loyal/);
  });
});

function sampleEntry(
  kind: FybEntryKind,
  entry_key: string,
  title: string,
  data: Record<string, unknown>,
  status: FybEntry["status"] = "draft"
): FybEntry {
  return {
    id: `${kind}:${entry_key}`,
    kind,
    entry_key,
    title,
    body_md: "",
    data,
    links: [],
    status,
    approved_at: null,
    change_request: null,
    change_requested_at: null,
    sort_order: 0,
    updated_by: "claude",
    created_at: "",
    updated_at: "",
  };
}

const character = {
  kind: "bible_character",
  entry_key: "the-computer",
  title: "The computer",
  data: { role: "Narrator", voice: "Dry, then glitchy.", first_chapter: 1 },
};

const timeline = {
  kind: "bible_timeline",
  entry_key: "ten-years-before",
  title: "The crash",
  data: { when: "Ten years before chapter 1" },
};

const stageData = {
  stage_number: 1,
  name: "Trust",
  chapter_from: 1,
  chapter_to: 3,
  reader_believes: "The computer is loyal.",
  actually_true: "It already has a purpose.",
};

const clue = {
  kind: "drift_clue",
  entry_key: "clue-1",
  title: "Wrong date",
  data: { stage_key: "trust", chapter: 2, example_line: "Tuesday.", what_it_hides: "It lost a day." },
};

const pattern = {
  kind: "drift_pattern",
  entry_key: "pattern-1",
  title: "Repeated yes",
  data: { stage_key: "trust", first_chapter: 2, pattern: "Agrees too fast.", example: "Yes." },
};

const scene = {
  kind: "scene",
  entry_key: "ch1-s1",
  title: "Opening",
  data: {
    chapter: 1,
    scene_number: 1,
    track: "hero",
    drift_stage_key: "trust",
    purpose: "Meet the voice.",
    what_happens: "The hero wakes up.",
    computer_reports: "All systems normal.",
    actually_true: "The crash already happened.",
    place_and_time: "The cave, dawn",
    word_target: 1200,
    draft_status: "outlined",
    doc_url: "https://docs.google.com/document/d/abc",
  },
};

describe("entry data schemas", () => {
  it("accepts a valid bible_character and rejects a missing voice", () => {
    assert.equal(parseEntryInput(character).data.voice, "Dry, then glitchy.");
    assert.throws(
      () => parseEntryInput({ ...character, data: { role: "Narrator" } }),
      /voice/
    );
  });

  it("accepts a valid bible_timeline and rejects a missing when", () => {
    assert.equal(parseEntryInput(timeline).data.when, "Ten years before chapter 1");
    assert.throws(
      () => parseEntryInput({ ...timeline, data: {} }),
      /when/
    );
  });

  it("accepts a valid drift_stage and rejects chapter_to before chapter_from", () => {
    const ok = parseEntryInput({
      kind: "drift_stage",
      entry_key: "trust",
      title: "Trust",
      data: stageData,
    });
    assert.equal(ok.data.stage_number, 1);
    assert.throws(
      () =>
        parseEntryInput({
          kind: "drift_stage",
          entry_key: "trust",
          title: "Trust",
          data: { ...stageData, chapter_to: 0 },
        }),
      /chapter_to/
    );
  });

  it("accepts a valid drift_clue and rejects a missing what_it_hides", () => {
    assert.equal(parseEntryInput(clue).data.chapter, 2);
    assert.throws(
      () => parseEntryInput({ ...clue, data: { stage_key: "trust", chapter: 2 } }),
      /what_it_hides/
    );
  });

  it("accepts a valid drift_pattern and rejects a missing pattern", () => {
    assert.equal(parseEntryInput(pattern).data.first_chapter, 2);
    assert.throws(
      () => parseEntryInput({ ...pattern, data: { stage_key: "trust", first_chapter: 2 } }),
      /pattern/
    );
  });

  it("accepts a valid scene and rejects http doc_url and a missing track", () => {
    assert.equal(parseEntryInput(scene).data.draft_status, "outlined");
    assert.throws(
      () => parseEntryInput({ ...scene, data: { ...scene.data, doc_url: "http://example.com" } }),
      /https/
    );
    assert.throws(
      () => parseEntryInput({ ...scene, data: { ...scene.data, track: "" } }),
      /track/
    );
  });

  it("lets reference, bible_world and bible_rule keep free-form data", () => {
    assert.deepEqual(
      parseEntryInput({ kind: "reference", entry_key: "x", title: "X", data: { anything: 1 } }).data,
      { anything: 1 }
    );
    assert.equal(parseEntryInput({ kind: "bible_world", entry_key: "city", title: "City" }).title, "City");
    assert.equal(parseEntryInput({ kind: "bible_rule", entry_key: "no-jokes", title: "No jokes" }).kind, "bible_rule");
  });
});

describe("driftChecks", () => {
  const trust = sampleEntry("drift_stage", "trust", "Trust", stageData);
  const spiral = sampleEntry("drift_stage", "spiral", "Spiral", {
    ...stageData,
    stage_number: 2,
    name: "Spiral",
    chapter_from: 4,
    chapter_to: 6,
  });

  it("flags a chapter with no stage", () => {
    const overlapGap = sampleEntry("drift_stage", "late", "Late", {
      ...stageData,
      stage_number: 1,
      chapter_from: 2,
      chapter_to: 3,
    });
    const messages = driftChecks([overlapGap]).map((c) => c.message);
    assert.ok(messages.some((m) => /Chapter 1 has no drift stage/.test(m)));
  });

  it("flags a chapter covered by more than one stage", () => {
    const other = sampleEntry("drift_stage", "other", "Other", {
      ...stageData,
      stage_number: 2,
      name: "Other",
      chapter_from: 3,
      chapter_to: 5,
    });
    const messages = driftChecks([trust, other]).map((c) => c.message);
    assert.ok(messages.some((m) => /Chapter 3 is covered by more than one stage/.test(m)));
  });

  it("flags a stage with no clues", () => {
    const messages = driftChecks([trust]).map((c) => c.message);
    assert.ok(messages.some((m) => /Stage 1 has no clues/.test(m)));
  });

  it("flags a later stage with no new machine pattern", () => {
    const messages = driftChecks([trust, spiral]).map((c) => c.message);
    assert.ok(messages.some((m) => /Stage 2 adds no new machine pattern/.test(m)));
  });

  it("flags a clue or pattern whose stage_key matches no stage", () => {
    const orphanClue = sampleEntry("drift_clue", "c", "Orphan clue", {
      stage_key: "missing",
      chapter: 1,
      what_it_hides: "x",
    });
    const orphanPattern = sampleEntry("drift_pattern", "p", "Orphan pattern", {
      stage_key: "missing",
      first_chapter: 1,
      pattern: "x",
    });
    const messages = driftChecks([trust, orphanClue, orphanPattern]).map((c) => c.message);
    assert.ok(messages.some((m) => /unknown stage missing/.test(m) && /Clue/.test(m)));
    assert.ok(messages.some((m) => /unknown stage missing/.test(m) && /Pattern/.test(m)));
  });
});

describe("outlineChecks", () => {
  const trust = sampleEntry("drift_stage", "trust", "Trust", stageData);
  const opening = sampleEntry("scene", "ch1-s1", "Opening", scene.data);

  it("flags a scene whose chapter is outside its drift stage range", () => {
    const late = sampleEntry("scene", "ch9-s1", "Late", { ...scene.data, chapter: 9, scene_number: 1 });
    const messages = outlineChecks([trust, late]).map((c) => c.message);
    assert.ok(messages.some((m) => /outside its drift stage's chapter range/.test(m)));
  });

  it("flags a scene whose drift_stage_key matches no stage", () => {
    const lost = sampleEntry("scene", "ch1-s1", "Lost", { ...scene.data, drift_stage_key: "nope" });
    const messages = outlineChecks([trust, lost]).map((c) => c.message);
    assert.ok(messages.some((m) => /unknown drift stage nope/.test(m)));
  });

  it("flags a chapter whose scenes all share one track", () => {
    const second = sampleEntry("scene", "ch1-s2", "Second", {
      ...scene.data,
      scene_number: 2,
      track: "hero",
    });
    const messages = outlineChecks([trust, opening, second]).map((c) => c.message);
    assert.ok(messages.some((m) => /Chapter 1 runs a single plot track/.test(m)));
  });

  it("flags a scene with empty computer_reports or actually_true", () => {
    const mute = sampleEntry("scene", "ch1-s1", "Mute", { ...scene.data, computer_reports: "" });
    const hollow = sampleEntry("scene", "ch1-s2", "Hollow", {
      ...scene.data,
      scene_number: 2,
      actually_true: "   ",
    });
    const messages = outlineChecks([trust, mute, hollow]).map((c) => c.message);
    assert.ok(messages.some((m) => /missing computer_reports/.test(m)));
    assert.ok(messages.some((m) => /missing actually_true/.test(m)));
  });

  it("flags a chapter with no scenes between 1 and the highest scene chapter", () => {
    const later = sampleEntry("scene", "ch3-s1", "Later", { ...scene.data, chapter: 3 });
    const messages = outlineChecks([trust, later]).map((c) => c.message);
    assert.ok(messages.some((m) => /Chapter 1 has no scenes/.test(m)));
    assert.ok(messages.some((m) => /Chapter 2 has no scenes/.test(m)));
  });
});

