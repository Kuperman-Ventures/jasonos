import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alignRubricScores,
  averageRubricScores,
  bulletsFromJson,
  bulletsLinesToText,
  bulletsTextToLines,
  capWords,
  extractTranscriptSection,
  formatElapsed,
  normalizeRubricLines,
  normalizeSlideInputs,
  parseAiHelpSlidesJson,
  parseReviewJson,
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

  it("parseAiHelpSlidesJson accepts array or slides wrapper", () => {
    const fromArray = parseAiHelpSlidesJson(
      JSON.stringify([{ headline: "Hi", bullets: ["One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen"] }])
    );
    assert.equal(fromArray.ok, true);
    if (fromArray.ok) {
      assert.equal(fromArray.value[0].bullets[0].split(/\s+/).length, 14);
      assert.equal(fromArray.value[0].bullets.length, 1);
    }
    const wrapped = parseAiHelpSlidesJson(
      JSON.stringify({ slides: [{ headline: "Wrap", bullets: ["a", "b"] }] })
    );
    assert.equal(wrapped.ok, true);
    if (wrapped.ok) assert.equal(wrapped.value[0].headline, "Wrap");
  });

  it("parseReviewJson fills missing slides as skipped and caps lists", () => {
    const ids = ["s1", "s2", "s3"];
    const parsed = parseReviewJson(
      JSON.stringify({
        slides: [
          {
            slide_id: "s1",
            mark: "covered",
            evidence: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen",
          },
        ],
        goal: { mark: "hit", evidence: "Nailed it" },
        said: ["a", "b", "c", "d", "e", "f", "g"],
        committed: [],
        next_time: [],
      }),
      ids
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.slides.length, 3);
    assert.equal(parsed.value.slides[0].mark, "covered");
    assert.ok(parsed.value.slides[0].evidence.split(/\s+/).length <= 30);
    assert.equal(parsed.value.slides[1].mark, "skipped");
    assert.equal(parsed.value.said.length, 6);
    assert.equal(parsed.value.goal?.mark, "hit");
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

  it("parseAiHelpSlidesJson tolerates prose and fences", () => {
    const payload = '[{"headline":"Open","bullets":["One short line"]}]';
    const wrapped = parseAiHelpSlidesJson(
      `Here are the slides:\n\`\`\`json\n${payload}\n\`\`\`\nLet me know if you want changes.`
    );
    assert.equal(wrapped.ok, true);
    if (wrapped.ok) assert.equal(wrapped.value[0].headline, "Open");

    const trailingComma = parseAiHelpSlidesJson(
      '[{"headline":"Open","bullets":["One short line",]},]'
    );
    assert.equal(trailingComma.ok, true);

    const objectForm = parseAiHelpSlidesJson(
      'Sure.\n{"slides":[{"headline":"Open","bullets":["One short line"]}]}'
    );
    assert.equal(objectForm.ok, true);
  });

  it("extractTranscriptSection pulls transcript block", () => {
    const text = extractTranscriptSection("Summary\n\n--- Transcript ---\nJason: hi");
    assert.equal(text, "Jason: hi");
  });

  it("extractTranscriptSection ignores notes-only summary", () => {
    assert.equal(extractTranscriptSection("## Notes\n- Follow up with Alex"), null);
    assert.equal(extractTranscriptSection(""), null);
    assert.equal(extractTranscriptSection(undefined), null);
  });

  it("formatElapsed renders mm:ss", () => {
    assert.equal(formatElapsed(125), "02:05");
  });

  it("normalizeRubricLines trims, drops blanks, and caps", () => {
    assert.deepEqual(normalizeRubricLines(["  one  ", "", "two"]), ["one", "two"]);
    assert.deepEqual(normalizeRubricLines(["x".repeat(600)]), ["x".repeat(500)]);
  });

  it("averageRubricScores excludes na rows", () => {
    const avg = averageRubricScores([
      { score: 5, na: false },
      { score: 3, na: false },
      { score: null, na: true },
    ]);
    assert.equal(avg, 4);
    assert.equal(averageRubricScores([{ score: null, na: true }]), null);
  });

  it("alignRubricScores fills missing with score 1 and Not scored.", () => {
    const rows = alignRubricScores(["Line one", "Line two"], [{ score: 4, note: "Good", na: false }]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].score, 4);
    assert.equal(rows[1].score, 1);
    assert.equal(rows[1].note, "Not scored.");
  });
});
