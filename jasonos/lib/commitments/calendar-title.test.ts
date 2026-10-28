import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  commitmentEventDescription,
  fallbackCommitmentEventTitle,
  sanitizeCommitmentEventTitle,
} from "./calendar-title";

describe("fallbackCommitmentEventTitle", () => {
  it("uses the promise when the recipient is self", () => {
    assert.equal(
      fallbackCommitmentEventTitle({
        promise: "Send the intro to Maya",
        to: "self",
        due_date: "2026-10-29",
        context: null,
      }),
      "Send the intro to Maya"
    );
  });

  it("appends who it was promised to", () => {
    assert.equal(
      fallbackCommitmentEventTitle({
        promise: "Send the deck",
        to: "Jerry",
        due_date: null,
        context: "Catch up",
      }),
      "Send the deck (Jerry)"
    );
  });
});

describe("sanitizeCommitmentEventTitle", () => {
  it("strips quotes and Title: prefixes", () => {
    assert.equal(
      sanitizeCommitmentEventTitle('"Send intro to Maya"', "fallback"),
      "Send intro to Maya"
    );
    assert.equal(
      sanitizeCommitmentEventTitle("Title: Finish the brief", "fallback"),
      "Finish the brief"
    );
  });

  it("falls back on empty or banned shells", () => {
    assert.equal(sanitizeCommitmentEventTitle("  ", "fallback"), "fallback");
    assert.equal(sanitizeCommitmentEventTitle("Commitment:", "fallback"), "fallback");
  });
});

describe("commitmentEventDescription", () => {
  it("includes promise, recipient, and source", () => {
    const text = commitmentEventDescription({
      promise: "Send the intro",
      to: "Jerry",
      due_date: "2026-10-30",
      context: "Weekly call",
      source_url: "https://example.com",
    });
    assert.match(text, /Send the intro/);
    assert.match(text, /Jerry/);
    assert.match(text, /2026-10-30/);
    assert.match(text, /Weekly call/);
    assert.match(text, /example\.com/);
  });
});
