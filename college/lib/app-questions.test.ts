import assert from "node:assert/strict";
import test from "node:test";
import {
  WORD_AXIS_MAX,
  appQuestions,
  barLayout,
  sourceCounts,
  tocMetaEssay,
  wordPct,
} from "./app-questions";

test("app questions data covers thirty matrix rows and six sources", () => {
  assert.equal(appQuestions.questions.items.length, 30);
  assert.equal(appQuestions.core.tiles.length, 6);
  assert.equal(appQuestions.essay.prompts.length, 7);
  assert.equal(appQuestions.prep.banks.length, 6);
  assert.equal(appQuestions.questions.sources.length, 6);
  assert.ok(appQuestions.prep.closing.length > 40);
  assert.match(appQuestions.schools.themes.find((t) => t.name === "Diversity / Perspective")?.wants ?? "", /lived experience/i);
  assert.match(appQuestions.schools.formats.find((f) => f.name === "Yale")?.format ?? "", /400 words/);
  assert.match(appQuestions.schools.formats.find((f) => f.name === "Tufts")?.format ?? "", /75–150/);
});

test("TOC meta is derived from data counts", () => {
  assert.equal(tocMetaEssay(appQuestions.essay.prompts, 250, 650), "1 of 7 · 250–650");
  assert.equal(appQuestions.toc.find((t) => t.num === "06")?.meta, "30 questions");
  assert.equal(appQuestions.toc.find((t) => t.num === "06")?.accent, true);
});

test("word-limit bar layout marks long bars as inside labels", () => {
  assert.equal(WORD_AXIS_MAX, 650);
  assert.ok(Math.abs(wordPct(250) - 250 / 650 * 100) < 0.001);
  const personal = barLayout(250, 650);
  assert.equal(personal.labelInside, true);
  assert.ok(personal.widthPct > 60);
  const short = barLayout(0, 35);
  assert.equal(short.labelInside, false);
});

test("source column totals match matrix dots", () => {
  const counts = sourceCounts([...appQuestions.questions.items]);
  assert.equal(counts.commonApp, 18);
  assert.equal(counts.uc, 9);
  assert.equal(counts.yale, 8);
  assert.equal(counts.mit, 9);
  assert.equal(counts.michigan, 4);
  assert.equal(counts.tufts, 2);
});
