import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bulletsFromJson,
  bulletsLinesToText,
  bulletsTextToLines,
  capWords,
  extractTranscriptSection,
  formatElapsed,
  normalizeSlideInputs,
  parseTailorJson,
  toJsonBullets,
} from "./decks-helpers.ts";

describe("decks pure helpers", () => {
  it("bulletsFromJson keeps string lines only", () => {
    assert.deepEqual(bulletsFromJson([" a ", 1, "b"]), ["a", "b"]);
  });

  it("bullet text round-trip", () => {
    const lines = ["One", "Two"];
    assert.deepEqual(bulletsTextToLines(bulletsLinesToText(lines)), lines);
  });

  it("toJsonBullets trims and drops blanks", () => {
    assert.deepEqual(toJsonBullets(["  hi ", "", "there "]), ["hi", "there"]);
  });

  it("capWords clips long text", () => {
    const text = "one two three four five";
    assert.equal(capWords(text, 3), "one two three…");
  });

  it("normalizeSlideInputs enforces limits", () => {
    const ok = normalizeSlideInputs([{ headline: "", bullets: ["a"] }]);
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.value[0].headline, "Untitled");
    const bad = normalizeSlideInputs([{ headline: "x", bullets: new Array(25).fill("b") }]);
    assert.equal(bad.ok, false);
  });

  it("parseTailorJson reads Claude payload", () => {
    const parsed = parseTailorJson(
      JSON.stringify({
        notes: "Tightened opener.",
        slides: [{ headline: "Hi", bullets: ["Line"] }],
      })
    );
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.value.notes, "Tightened opener.");
      assert.equal(parsed.value.slides[0].headline, "Hi");
    }
  });

  it("extractTranscriptSection pulls transcript block", () => {
    const text = extractTranscriptSection("Summary\n\n--- Transcript ---\nJason: hi");
    assert.equal(text, "Jason: hi");
  });

  it("formatElapsed renders mm:ss", () => {
    assert.equal(formatElapsed(125), "02:05");
  });
});
