import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAdditionalPrograms } from "./additional-programs";

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
    [{ id: "a", name: "Robotics", sourceUrl: "" }],
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
      },
      { id: "r2", name: "Controls", sourceUrl: "" },
    ],
  );
});
