import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeAdditionalPrograms,
  normalizeProgramOptions,
} from "./additional-programs";

test("normalizeAdditionalPrograms rejects non-arrays", () => {
  assert.deepEqual(normalizeAdditionalPrograms(null), []);
  assert.deepEqual(normalizeAdditionalPrograms({}), []);
  assert.deepEqual(normalizeAdditionalPrograms("robots"), []);
});

test("normalizeAdditionalPrograms skips empty names and missing ids", () => {
  assert.deepEqual(
    normalizeAdditionalPrograms([
      { id: "a", name: "Robotics" },
      { id: "b", name: "   " },
      { id: "", name: "Mechatronics" },
      { name: "No id" },
      null,
    ]),
    [{ id: "a", name: "Robotics", sourceUrl: "", category: "", source: "manual" }],
  );
});

test("normalizeAdditionalPrograms trims fields and defaults sourceUrl", () => {
  assert.deepEqual(
    normalizeAdditionalPrograms([
      {
        id: "  r1  ",
        name: "  Robotics Engineering (BS)  ",
        sourceUrl: "  https://example.edu/robotics  ",
      },
      { id: "r2", name: "Controls" },
    ]),
    [
      {
        id: "r1",
        name: "Robotics Engineering (BS)",
        sourceUrl: "https://example.edu/robotics",
        category: "",
        source: "manual",
      },
      { id: "r2", name: "Controls", sourceUrl: "", category: "", source: "manual" },
    ],
  );
});

test("normalizeAdditionalPrograms defaults old entries to source manual", () => {
  assert.deepEqual(
    normalizeAdditionalPrograms([
      { id: "legacy", name: "Robotics", sourceUrl: "https://example.edu" },
      {
        id: "cat",
        name: "Bioengineering",
        sourceUrl: "",
        category: "Biomedical Engineering",
        source: "catalog",
      },
    ]),
    [
      {
        id: "legacy",
        name: "Robotics",
        sourceUrl: "https://example.edu",
        category: "",
        source: "manual",
      },
      {
        id: "cat",
        name: "Bioengineering",
        sourceUrl: "",
        category: "Biomedical Engineering",
        source: "catalog",
      },
    ],
  );
});

test("normalizeProgramOptions rejects non-arrays", () => {
  assert.deepEqual(normalizeProgramOptions(null), []);
  assert.deepEqual(normalizeProgramOptions({}), []);
});

test("normalizeProgramOptions skips missing id or name and applies defaults", () => {
  assert.deepEqual(
    normalizeProgramOptions([
      { id: "a", name: "Robotics" },
      { id: "b", name: "   " },
      { id: "", name: "Civil" },
      { name: "No id" },
      {
        id: "  c  ",
        name: "  Chemical Engineering  ",
        category: "  Chemical Engineering  ",
        sourceUrl: "  https://example.edu  ",
        notes: "  New program  ",
        source: "scorecard",
      },
    ]),
    [
      {
        id: "a",
        name: "Robotics",
        category: "Other",
        sourceUrl: "",
        notes: "",
        source: "catalog",
      },
      {
        id: "c",
        name: "Chemical Engineering",
        category: "Chemical Engineering",
        sourceUrl: "https://example.edu",
        notes: "New program",
        source: "scorecard",
      },
    ],
  );
});
