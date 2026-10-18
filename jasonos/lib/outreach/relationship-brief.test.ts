import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_RELATIONSHIP_BRIEF_PROMPT,
  briefSourceLinkLabel,
  fillBriefPrompt,
  mergeDoneCommitments,
  missingRequiredBriefVariables,
  unknownBriefVariables,
} from "./relationship-brief.ts";

describe("relationship brief prompt", () => {
  it("ships the required email and meeting variables", () => {
    assert.deepEqual(missingRequiredBriefVariables(DEFAULT_RELATIONSHIP_BRIEF_PROMPT), []);
    assert.deepEqual(unknownBriefVariables(DEFAULT_RELATIONSHIP_BRIEF_PROMPT), []);
  });

  it("flags unknown and missing variables", () => {
    const prompt = "Hello {{contact_name}} {{mystery}}";
    assert.deepEqual(unknownBriefVariables(prompt), ["mystery"]);
    assert.deepEqual(missingRequiredBriefVariables(prompt), ["emails", "meetings"]);
  });

  it("fills variables and drops unknown names", () => {
    const filled = fillBriefPrompt("Hi {{contact_name}} {{emails}} {{nope}}", {
      contact_name: "Mike",
      emails: "one",
    });
    assert.equal(filled, "Hi Mike one ");
  });

  it("keeps done commitments across regenerations by matching text", () => {
    const next = mergeDoneCommitments(
      [
        { text: "Intro to Tracy", status: "open" },
        { text: "Send deck", status: "awaiting" },
      ],
      [{ text: "Intro to Tracy", status: "done" }]
    );
    assert.equal(next[0]?.status, "done");
    assert.equal(next[1]?.status, "awaiting");
  });

  it("keeps commitment dates when the same line is regenerated", () => {
    const next = mergeDoneCommitments(
      [{ text: "Intro to Tracy", status: "open", createdAt: null, doneAt: null }],
      [{ text: "Intro to Tracy", status: "done", createdAt: "2026-01-02T00:00:00.000Z", doneAt: "2026-02-02T00:00:00.000Z" }]
    );
    assert.equal(next[0]?.status, "done");
    assert.equal(next[0]?.createdAt, "2026-01-02T00:00:00.000Z");
    assert.equal(next[0]?.doneAt, "2026-02-02T00:00:00.000Z");
  });

  it("labels a source as KIND + date", () => {
    assert.equal(
      briefSourceLinkLabel({ type: "meeting", date: "2026-09-30" }),
      "MEETING SEP 30"
    );
  });
});
