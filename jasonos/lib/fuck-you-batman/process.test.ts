import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayQuestion,
  isProvisional,
  isQuestion,
  nextStep,
  partStatus,
  PROVISIONAL_SUFFIX,
  questionSet,
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

const heroPart: ProcessPart = {
  week: 2,
  label: "The Hero",
  why: "Who Dustin is.",
  questionSet: "hero",
};

describe("questionSet and isQuestion", () => {
  it("treats hero-3 with no options as a question", () => {
    const card = sampleDecision({ decision_key: "hero-3", status: "open" });
    assert.equal(questionSet(card), "hero");
    assert.equal(isQuestion(card), true);
  });

  it("does not treat hero as a question set key by itself", () => {
    const card = sampleDecision({ decision_key: "hero", status: "open" });
    assert.equal(questionSet(card), null);
    assert.equal(isQuestion(card), false);
  });

  it("does not treat ending-and-hidden-purpose as a question", () => {
    const card = sampleDecision({
      decision_key: "ending-and-hidden-purpose",
      status: "open",
      options: [{ key: "a", label: "A", summary: "", strengths: [], holes: [] }],
    });
    assert.equal(questionSet(card), null);
    assert.equal(isQuestion(card), false);
  });
});

describe("stepStatus", () => {
  it("marks Voice done, Story foundation now, Outline next in week 1", () => {
    assert.equal(stepStatus(1, 1), "done");
    assert.equal(stepStatus(2, 1), "now");
    assert.equal(stepStatus(3, 1), "next");
    assert.equal(stepStatus(4, 1), "later");
  });

  it("stays on Story foundation through week 4", () => {
    assert.equal(stepStatus(1, 4), "done");
    assert.equal(stepStatus(2, 4), "now");
    assert.equal(stepStatus(3, 4), "next");
    assert.equal(stepStatus(5, 4), "later");
  });

  it("moves to Outline in week 5", () => {
    assert.equal(stepStatus(1, 5), "done");
    assert.equal(stepStatus(2, 5), "done");
    assert.equal(stepStatus(3, 5), "now");
    assert.equal(stepStatus(4, 5), "next");
    assert.equal(stepStatus(5, 5), "later");
  });

  it("marks every phase done after the plan ends", () => {
    for (const phase of [1, 2, 3, 4, 5, 6, 7, 8]) {
      assert.equal(stepStatus(phase, 40), "done");
    }
  });
});

describe("partStatus", () => {
  it("treats question sets with 0, some, and all answered", () => {
    assert.deepEqual(partStatus(heroPart, [], []), { status: "not-posted", answered: 0, total: 0 });
    const some = [
      sampleDecision({ decision_key: "hero-1", status: "decided", week: 2, sort_order: 0 }),
      sampleDecision({ decision_key: "hero-2", status: "open", week: 2, sort_order: 1 }),
    ];
    assert.deepEqual(partStatus(heroPart, some, []), { status: "waiting", answered: 1, total: 2 });
    const all = [
      sampleDecision({ decision_key: "hero-1", status: "decided", week: 2, sort_order: 0 }),
      sampleDecision({ decision_key: "hero-2", status: "decided", week: 2, sort_order: 1 }),
    ];
    assert.deepEqual(partStatus(heroPart, all, []), { status: "done", answered: 2, total: 2 });
  });

  it("treats a decided decision as done and entry kinds by approval", () => {
    const ending: ProcessPart = {
      week: 1,
      label: "Ending",
      why: "It",
      decisionKey: "ending-and-hidden-purpose",
    };
    const bible: ProcessPart = {
      week: 4,
      label: "Story Bible",
      why: "Facts",
      entryKinds: FYB_BIBLE_KINDS,
    };
    assert.deepEqual(
      partStatus(ending, [sampleDecision({ decision_key: "ending-and-hidden-purpose", status: "decided" })], []),
      { status: "done" }
    );
    assert.deepEqual(partStatus(bible, [], []), { status: "not-posted" });
    assert.deepEqual(
      partStatus(bible, [], [sampleEntry("bible_character", "hero", "Hero", "approved")]),
      { status: "done" }
    );
    assert.deepEqual(
      partStatus(bible, [], [
        sampleEntry("bible_character", "hero", "Hero", "approved"),
        sampleEntry("bible_world", "city", "City", "draft"),
      ]),
      { status: "waiting" }
    );
  });
});

describe("nextStep", () => {
  it("returns answer when an open question exists", () => {
    const answered = sampleDecision({
      decision_key: "hero-1",
      status: "decided",
      week: 2,
      sort_order: 0,
      question: "Who is Dustin?",
    });
    const open = sampleDecision({
      decision_key: "hero-2",
      status: "open",
      week: 2,
      sort_order: 1,
      question: "What does he want?",
    });
    const step = nextStep(2, [answered, open], []);
    assert.equal(step.kind, "answer");
    assert.equal(step.title, "What does he want?");
    assert.equal(step.detail, "Question 2 of 2 in The Hero. Answer in your own words.");
    assert.equal(step.href, "/projects/fuck-you-batman/decisions#hero-2");
    assert.equal(step.hrefLabel, "Answer this question");
    assert.deepEqual(step.stepOf, { index: 2, total: 2 });
  });

  it("returns review when only draft entries exist", () => {
    const draft = sampleEntry("bible_character", "hero", "The hero", "draft");
    const reference = sampleEntry("reference", "style-profile", "Style Profile", "draft");
    const step = nextStep(3, [], [reference, draft]);
    assert.equal(step.kind, "review");
    assert.equal(step.title, "Review: The hero");
    assert.equal(
      step.detail,
      "1 entries built from your answers are waiting. Approve each one, or request changes with a note."
    );
    assert.equal(step.href, "/projects/fuck-you-batman/bible");
    assert.equal(step.hrefLabel, "Review");
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
    assert.match(step.detail, /Your next questions arrive Mon Oct 26/);
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
