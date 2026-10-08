import assert from "node:assert/strict";
import test from "node:test";
import {
  clipContext,
  feedbackKindLabel,
  feedbackStatusLabel,
  formatFeedbackWhen,
  isFeedbackKind,
  isFeedbackStatus,
  normalizeFeedbackBody,
} from "./site-feedback";

test("normalizeFeedbackBody trims and caps length", () => {
  assert.equal(normalizeFeedbackBody("  hello   world  "), "hello world");
  assert.equal(normalizeFeedbackBody(""), "");
  assert.equal(normalizeFeedbackBody(null), "");
  assert.equal(normalizeFeedbackBody("x".repeat(2500)).length, 2000);
});

test("kind and status guards", () => {
  assert.equal(isFeedbackKind("bug"), true);
  assert.equal(isFeedbackKind("idea"), true);
  assert.equal(isFeedbackKind("question"), true);
  assert.equal(isFeedbackKind("other"), false);
  assert.equal(isFeedbackStatus("new"), true);
  assert.equal(isFeedbackStatus("wont"), true);
  assert.equal(isFeedbackStatus("closed"), false);
  assert.equal(feedbackKindLabel("idea"), "Idea");
  assert.equal(feedbackStatusLabel("wont"), "Won't do");
});

test("clipContext blanks empty strings", () => {
  assert.equal(clipContext("  colleges  "), "colleges");
  assert.equal(clipContext("   "), null);
  assert.equal(clipContext(12), null);
});

test("formatFeedbackWhen is relative for recent times", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  assert.equal(formatFeedbackWhen("2026-10-08T11:59:30Z", now), "just now");
  assert.equal(formatFeedbackWhen("2026-10-08T11:30:00Z", now), "30m ago");
  assert.equal(formatFeedbackWhen("2026-10-08T09:00:00Z", now), "3h ago");
});
