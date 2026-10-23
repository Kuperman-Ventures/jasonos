import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_AFTER,
  afterDraftFromLines,
  afterDraftToLines,
  defaultNextContact,
  mergeAfterExtract,
  parseAfterExtract,
  plannedAgainstSaid,
  prefillAfter,
  sameAfterDraft,
  statusAfterTouch,
  thankYouDueBy,
  type AfterDraft,
} from "./after.ts";

const DRAFT: AfterDraft = {
  conversation: "Moving to Paramount in January.\nWants intros to agency CMOs.",
  contactsReceived: [
    { name: "Dana Ruiz", company: "Horizon", note: "Runs | partnerships", status: "accepted" },
    { name: "Sam Lee", company: null, note: null, status: "dismissed" },
  ],
  followUpWith: [
    { text: "Send my executive profile", owner: "me" },
    { text: "Intro me to Dana", owner: "them" },
  ],
  nextContactAt: "2026-11-06",
  toDiscussNext: "Her Q1 hiring plan",
};

describe("After draft lines", () => {
  it("round-trips through the After block lines", () => {
    const lines = afterDraftToLines(DRAFT);
    assert.equal(lines.length, 5);
    assert.deepEqual(
      lines.map((line) => line.label),
      ["Conversation", "Contacts received", "Follow up with", "Next contact", "To discuss next"]
    );
    const back = afterDraftFromLines(lines);
    assert.ok(back);
    assert.equal(back.conversation, DRAFT.conversation);
    assert.equal(back.contactsReceived[0].name, "Dana Ruiz");
    assert.equal(back.contactsReceived[0].note, "Runs / partnerships");
    assert.equal(back.contactsReceived[1].status, "dismissed");
    assert.deepEqual(back.followUpWith, DRAFT.followUpWith);
    assert.equal(back.nextContactAt, "2026-11-06");
    assert.ok(sameAfterDraft(back, { ...DRAFT, contactsReceived: back.contactsReceived }));
  });

  it("is null for a playbook After block that was never saved from Debrief", () => {
    assert.equal(afterDraftFromLines([]), null);
  });

  it("drops a bad date", () => {
    const lines = afterDraftToLines({ ...EMPTY_AFTER, nextContactAt: "next week" });
    assert.equal(afterDraftFromLines(lines)?.nextContactAt, null);
  });
});

describe("dates and status", () => {
  it("defaults the next contact to two weeks after a first call, three after later ones", () => {
    assert.equal(defaultNextContact("2026-10-23T18:00:00Z", 1), "2026-11-06");
    assert.equal(defaultNextContact("2026-10-23T18:00:00Z", 2), "2026-11-13");
  });

  it("uses the Eastern day of a late-evening call", () => {
    assert.equal(defaultNextContact("2026-10-24T02:30:00Z", 1), "2026-11-06");
  });

  it("moves status by held calls and leaves closed alone", () => {
    assert.equal(statusAfterTouch("referral", 1), "call_1");
    assert.equal(statusAfterTouch("call_1", 2), "call_2");
    assert.equal(statusAfterTouch(null, 5), "ongoing");
    assert.equal(statusAfterTouch("closed", 2), "closed");
  });

  it("puts the thank-you due 24 hours after the call ends", () => {
    assert.equal(thankYouDueBy("2026-10-23T19:00:00.000Z"), "2026-10-24T19:00:00.000Z");
  });
});

const POINTS = [
  { id: "a", kind: "agenda", headline: "The four topics", state: "open", note: null, confirmedState: null },
  { id: "1", kind: "question", headline: "Biggest challenge?", state: "covered", note: "Agency consolidation", confirmedState: null },
  { id: "2", kind: "question", headline: "Who is most connected?", state: "covered", note: null, confirmedState: null },
  { id: "3", kind: "question", headline: "Tools that helped?", state: "skipped", note: null, confirmedState: null },
  { id: "4", kind: "ask", headline: "The radar ask", state: "open", note: null, confirmedState: "covered" },
];

describe("plannedAgainstSaid", () => {
  it("marks covered, partial and skipped from the review and the live marks", () => {
    const rows = plannedAgainstSaid(POINTS, [
      { pointId: "1", match: "exact", nearest: "biggest challenge", timestamp: "04:10" },
      { pointId: "2", match: "close", nearest: null, timestamp: null },
      { pointId: "3", match: "none", nearest: null, timestamp: null },
    ]);
    assert.deepEqual(
      rows.map((row) => [row.id, row.status]),
      [
        ["1", "covered"],
        ["2", "partial"],
        ["3", "skipped"],
        ["4", "covered"],
      ]
    );
    assert.equal(rows[0].happened, "Agency consolidation · 04:10 · biggest challenge");
    assert.equal(rows[2].happened, "Skipped live");
  });

  it("falls back to live marks with no review", () => {
    const rows = plannedAgainstSaid(POINTS, null);
    assert.equal(rows.find((row) => row.id === "2")?.status, "covered");
    assert.equal(rows.find((row) => row.id === "3")?.status, "skipped");
  });
});

describe("prefillAfter", () => {
  it("fills the conversation from notes and the review, and discuss-next from open points", () => {
    const draft = prefillAfter({
      points: POINTS,
      review: { relationshipGoalNote: "She offered two names.", projectGoalNote: null, suggestedReason: "Ask landed." },
      occurredAt: "2026-10-23T18:00:00Z",
      touchNumber: 1,
    });
    assert.equal(draft.conversation, "Biggest challenge: Agency consolidation\nShe offered two names.");
    assert.equal(draft.toDiscussNext, "Pick up: Tools that helped?");
    assert.equal(draft.nextContactAt, "2026-11-06");
  });
});

describe("transcript extract", () => {
  it("parses the model JSON and merges without repeating rows", () => {
    const extract = parseAfterExtract(
      '```json\n{"conversation":"She is moving.","contactsReceived":[{"name":"Dana Ruiz","company":"Horizon"},{"name":"Ali Khan","note":"CMO"}],"followUps":[{"text":"Send my executive profile","owner":"me"},{"text":"Check with Ali","owner":"them"}],"toDiscussNext":""}\n```'
    );
    assert.ok(extract);
    const merged = mergeAfterExtract(DRAFT, extract);
    assert.equal(merged.conversation, "She is moving.");
    assert.deepEqual(
      merged.contactsReceived.map((row) => [row.name, row.status]),
      [
        ["Dana Ruiz", "accepted"],
        ["Sam Lee", "dismissed"],
        ["Ali Khan", "suggested"],
      ]
    );
    assert.equal(merged.followUpWith.length, 3);
    assert.equal(merged.toDiscussNext, DRAFT.toDiscussNext);
  });

  it("rejects text that is not JSON", () => {
    assert.equal(parseAfterExtract("no"), null);
  });
});
