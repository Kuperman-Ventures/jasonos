import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMeetingFollowupSourceMaterial,
  MEETING_FOLLOWUP_SOURCE_MAX_CHARS,
} from "./meeting-followup-prompt.ts";

describe("buildMeetingFollowupSourceMaterial", () => {
  it("prefers transcript and keeps a short notes preface", () => {
    const { material, usedTranscript } = buildMeetingFollowupSourceMaterial({
      summary: "Hardik walked through franchise ops.",
      transcript: "Jason: How is the franchise work going?\nHardik: We are hiring two operators.",
    });
    assert.equal(usedTranscript, true);
    assert.match(material, /Meeting transcript:/);
    assert.match(material, /Hardik: We are hiring two operators/);
    assert.match(material, /Meeting notes:/);
    assert.match(material, /franchise ops/);
  });

  it("falls back to notes when there is no transcript", () => {
    const { material, usedTranscript } = buildMeetingFollowupSourceMaterial({
      summary: "Catch-up about Equity Labs intros.",
      transcript: null,
    });
    assert.equal(usedTranscript, false);
    assert.match(material, /^Meeting notes:/);
    assert.match(material, /Equity Labs/);
  });

  it("does not let a long summary crowd the transcript out", () => {
    const summary = "S".repeat(8_000);
    const transcript = `Jason: start\nThem: ${"talk ".repeat(3_000)}end`;
    const { material, usedTranscript } = buildMeetingFollowupSourceMaterial({
      summary,
      transcript,
      maxChars: MEETING_FOLLOWUP_SOURCE_MAX_CHARS,
    });
    assert.equal(usedTranscript, true);
    assert.ok(material.includes("Them:"));
    assert.ok(material.length <= MEETING_FOLLOWUP_SOURCE_MAX_CHARS + 80);
    // Transcript label must appear; notes preface must stay short.
    const transcriptAt = material.indexOf("Meeting transcript:");
    const notesAt = material.indexOf("Meeting notes:");
    assert.ok(notesAt >= 0 && transcriptAt > notesAt);
    assert.ok(transcriptAt < 2_000);
  });
});
