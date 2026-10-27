import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMentionsIndex,
  computeTalkShare,
  coverageMinutes,
  extractMentionTerms,
  findTermLines,
  formatNumberedTranscript,
  numberTranscriptLines,
  quoteInTranscript,
  stripInvalidLineRefs,
} from "./review-engine.ts";

describe("review engine", () => {
  it("numbers transcript lines and formats them", () => {
    const lines = numberTranscriptLines("Speaker 1: Hi\nSpeaker 2: Hello");
    assert.equal(lines.length, 2);
    assert.equal(lines[0]?.speaker, "Speaker 1");
    assert.match(formatNumberedTranscript(lines), /^0001 Speaker 1: Hi/);
  });

  it("computes Jason talk share from speaker labels", () => {
    const lines = numberTranscriptLines(
      "Speaker 1: short\nSpeaker 2: a much longer line of words here"
    );
    const share = computeTalkShare(lines, "Speaker 1");
    assert.ok(share.jason_chars < share.others_chars);
    assert.ok(share.jason_pct < 50);
  });

  it("finds Ronnie with one-character fuzzy match for Ronny", () => {
    const lines = numberTranscriptLines("Speaker 1: I spoke with Ronny yesterday");
    assert.deepEqual(findTermLines(lines, "Ronnie"), [1]);
  });

  it("builds a mentions index with found and missing terms", () => {
    const lines = numberTranscriptLines(
      "Speaker 1: BigQuery and Attio are in the stack\nSpeaker 2: ok"
    );
    const index = buildMentionsIndex(lines, [
      { label: "Slide 1", text: "Ask about BigQuery Attio and Code AI Labs" },
    ]);
    assert.equal(index[0]?.found.some((hit) => hit.term === "BigQuery"), true);
    assert.equal(index[0]?.notFound.includes("Code AI Labs") || index[0]?.found.every((h) => h.term !== "Code AI Labs"), true);
  });

  it("validates evidence quotes and strips bad line refs", () => {
    assert.equal(quoteInTranscript("hello world", "She said hello world today"), true);
    assert.equal(quoteInTranscript("not in here", "something else entirely"), false);
    assert.equal(stripInvalidLineRefs("Good [L2] bad [L99]", 10), "Good [L2] bad");
  });

  it("estimates coverage minutes from run length", () => {
    const coverage = coverageMinutes(
      9000,
      "2026-10-27T14:00:00.000Z",
      "2026-10-27T14:20:00.000Z"
    );
    assert.ok(coverage);
    assert.equal(coverage!.recordedMinutes, 20);
    assert.ok(coverage!.ratio < 0.6);
  });

  it("extracts capitalised mention terms", () => {
    const terms = extractMentionTerms('Talk about "Code AI Labs" and BigQuery');
    assert.ok(terms.includes("Code AI Labs"));
    assert.ok(terms.includes("BigQuery"));
  });
});
