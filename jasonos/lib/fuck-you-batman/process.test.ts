import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayQuestion,
  isProvisional,
  nextStep,
  partStatus,
  PROVISIONAL_SUFFIX,
  SKETCH_DOC_URL,
  stepStatus,
  weekMonday,
  type ProcessPart,
} from "./process.ts";
import { FYB_BIBLE_KINDS, type FybDecision, type FybEntry, type FybEntryKind } from "./types.ts";

function sampleDecision(overrides: Partial<FybDecision> & Pick<FybDecision, "decision_key" | "status">): FybDecision {
  return {
    id: overrides.id ?? overrides.decision_key,
    week: 1,
    phase: 2,
    question: "How does the book end?",
    context: null,
    options: [],
    chosen_option_key: null,
    custom_answer: null,
    jason_note: null,
    decided_at: null,
    decided_by: null,
    sort_order: 0,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function sampleEntry(
  kind: FybEntryKind,
  entry_key: string,
  title: string,
  status: FybEntry["status"] = "draft"
): FybEntry {
  return {
    id: `${kind}:${entry_key}`,
    kind,
    entry_key,
    title,
    body_md: "",
    data: {},
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

const endingPart: ProcessPart = {
  week: 1,
  label: "Ending and hidden purpose",
  why: "Every clue and every stage of the drift points at it.",
  decisionKey: "ending-and-hidden-purpose",
};

const biblePart: ProcessPart = {
  week: 3,
  label: "Story Bible",
  why: "Characters, places, technology rules and timeline, kept consistent.",
  entryKinds: FYB_BIBLE_KINDS,
};

describe("stepStatus", () => {
  it("marks Voice done, Story foundation now, Outline next in week 1", () => {
    assert.equal(stepStatus(1, 1), "done");
    assert.equal(stepStatus(2, 1), "now");
    assert.equal(stepStatus(3, 1), "next");
    assert.equal(stepStatus(4, 1), "later");
    assert.equal(stepStatus(8, 1), "later");
  });

  it("stays on Story foundation through week 3", () => {
    assert.equal(stepStatus(1, 3), "done");
    assert.equal(stepStatus(2, 3), "now");
    assert.equal(stepStatus(3, 3), "next");
    assert.equal(stepStatus(4, 3), "later");
  });

  it("moves to Outline in week 4", () => {
    assert.equal(stepStatus(1, 4), "done");
    assert.equal(stepStatus(2, 4), "done");
    assert.equal(stepStatus(3, 4), "now");
    assert.equal(stepStatus(4, 4), "next");
    assert.equal(stepStatus(5, 4), "later");
  });

  it("marks every phase done after the plan ends", () => {
    for (const phase of [1, 2, 3, 4, 5, 6, 7, 8]) {
      assert.equal(stepStatus(phase, 39), "done");
    }
  });
});

describe("partStatus", () => {
  it("treats a decided decision as done, an open one as waiting, and a missing one as not-posted", () => {
    const decided = sampleDecision({ decision_key: "ending-and-hidden-purpose", status: "decided" });
    const open = sampleDecision({ decision_key: "ending-and-hidden-purpose", status: "open" });
    assert.equal(partStatus(endingPart, [decided], []), "done");
    assert.equal(partStatus(endingPart, [open], []), "waiting");
    assert.equal(partStatus(endingPart, [], []), "not-posted");
  });

  it("treats entry-kind parts as not-posted, done, or waiting", () => {
    assert.equal(partStatus(biblePart, [], []), "not-posted");
    const approved = [
      sampleEntry("bible_character", "hero", "Hero", "approved"),
      sampleEntry("bible_world", "city", "City", "approved"),
    ];
    assert.equal(partStatus(biblePart, [], approved), "done");
    const mixed = [
      sampleEntry("bible_character", "hero", "Hero", "approved"),
      sampleEntry("bible_world", "city", "City", "draft"),
    ];
    assert.equal(partStatus(biblePart, [], mixed), "waiting");
  });
});

describe("nextStep", () => {
  it("returns decide when an open decision exists", () => {
    const open = sampleDecision({
      decision_key: "ending-and-hidden-purpose",
      status: "open",
      week: 1,
      sort_order: 0,
      question: "How does the book end?",
    });
    const later = sampleDecision({
      decision_key: "reading-pick",
      status: "open",
      week: 1,
      sort_order: 1,
      question: "What should I read?",
    });
    const step = nextStep(1, [later, open], []);
    assert.equal(step.kind, "decide");
    assert.equal(step.title, "Decide: How does the book end?");
    assert.equal(step.detail, "Decision 1 of 2 this week. Pick an option or write your own, then press Record.");
    assert.equal(step.href, "/projects/fuck-you-batman/decisions#ending-and-hidden-purpose");
    assert.equal(step.hrefLabel, "Open decision");
    assert.deepEqual(step.stepOf, { index: 1, total: 2 });
  });

  it("returns review when only drafts exist", () => {
    const draft = sampleEntry("bible_character", "hero", "The hero", "draft");
    const reference = sampleEntry("reference", "style-profile", "Style Profile", "draft");
    const step = nextStep(3, [], [reference, draft]);
    assert.equal(step.kind, "review");
    assert.equal(step.title, "Review: The hero");
    assert.equal(step.detail, "1 draft waiting. Approve each one, or request changes with a note.");
    assert.equal(step.href, "/projects/fuck-you-batman/bible");
    assert.equal(step.hrefLabel, "Review drafts");
  });

  it("returns write in week 10 with nothing open", () => {
    const step = nextStep(10, [], []);
    assert.equal(step.kind, "write");
    assert.equal(step.title, "Write today");
    assert.equal(step.detail, "About 1,000 words. Your weekly target is 5,000.");
    assert.equal(step.href, SKETCH_DOC_URL);
    assert.equal(step.hrefLabel, "Open Google Docs");
  });

  it("returns none in week 2 with nothing open", () => {
    const step = nextStep(2, [], []);
    assert.equal(step.kind, "none");
    assert.equal(step.title, "Nothing waiting on you");
    assert.match(step.detail, /Claude posts the Week 3 work on Mon Oct 26/);
    assert.match(step.detail, /You can sketch scenes in the FYB doc in the meantime/);
    assert.equal(step.href, SKETCH_DOC_URL);
    assert.equal(step.hrefLabel, "Open sketch doc");
  });
});

describe("displayQuestion", () => {
  it("strips the provisional suffix", () => {
    const question = `Who is the hero?${PROVISIONAL_SUFFIX}`;
    assert.equal(displayQuestion({ question }), "Who is the hero?");
    assert.equal(isProvisional({ question }), true);
    assert.equal(isProvisional({ question: "Who is the hero?" }), false);
    assert.equal(displayQuestion({ question: "Who is the hero?" }), "Who is the hero?");
  });
});

describe("weekMonday", () => {
  it("labels the Monday of a plan week", () => {
    assert.equal(weekMonday(1), "Mon Oct 12");
    assert.equal(weekMonday(2), "Mon Oct 19");
  });
});
