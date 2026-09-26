import assert from "node:assert/strict";
import test from "node:test";
import {
  evidenceInSource,
  extractionResultSchema,
  refineExtractionResult,
} from "./extract-todos";

test("evidenceInSource matches with whitespace and case normalization", () => {
  const source = "Early Decision applications are due November 1 at most private colleges.";
  assert.equal(evidenceInSource("early decision applications are due November 1", source), true);
  assert.equal(evidenceInSource("not in the document at all", source), false);
});

test("refineExtractionResult drops low confidence, missing evidence, and bad schools", () => {
  const source =
    "Early Decision applications are due November 1. The CSS Profile is required for institutional aid.";
  const refined = refineExtractionResult(
    {
      document_summary: "A counseling handout about ED and aid.",
      todos: [
        {
          title: "Submit Early Decision application",
          details: "File ED by Nov 1.",
          category: "deadline",
          school: "Unknown College",
          due_date: "2026-11-01",
          due_date_basis: "explicit",
          conditional_on: null,
          updates_existing: null,
          evidence: "Early Decision applications are due November 1",
          confidence: 0.9,
        },
        {
          title: "Complete CSS Profile",
          details: "Required for institutional aid.",
          category: "financial_aid",
          school: "MIT",
          due_date: null,
          due_date_basis: null,
          conditional_on: null,
          updates_existing: null,
          evidence: "The CSS Profile is required for institutional aid",
          confidence: 0.4,
        },
        {
          title: "Invented task",
          details: "Not supported.",
          category: "decision",
          school: null,
          due_date: null,
          due_date_basis: null,
          conditional_on: null,
          updates_existing: null,
          evidence: "this quote is nowhere",
          confidence: 0.95,
        },
      ],
    },
    source,
    ["MIT", "Stanford"],
  );

  assert.equal(refined.todos.length, 1);
  assert.equal(refined.todos[0]?.title, "Submit Early Decision application");
  assert.equal(refined.todos[0]?.school, null);
});

test("extractionResultSchema accepts the brief JSON shape", () => {
  const parsed = extractionResultSchema.parse({
    document_summary: "AP registration email for CHS families.",
    todos: [
      {
        title: "Register for AP exams",
        details: "Finish College Board registration by Oct 31.",
        category: "submission",
        school: null,
        due_date: "2026-10-31",
        due_date_basis: "explicit",
        conditional_on: null,
        updates_existing: null,
        evidence: "Both steps must be finished by October 31st",
        confidence: 0.88,
      },
    ],
  });
  assert.equal(parsed.todos.length, 1);
});
